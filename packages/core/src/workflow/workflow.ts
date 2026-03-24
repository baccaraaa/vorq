import type { EventBus } from "../events/event-bus.js";
import type { VorqEventMap } from "../events/types.js";
import type { VorqLogger } from "../logging/types.js";
import { RetryPolicy } from "../retry/retry-policy.js";
import type { StepContext, StepDefinition, WorkflowResult } from "./types.js";

type StepOutcome = { succeeded: true } | { succeeded: false; error: Error; attempts: number };

export class Workflow<TInput, TResults> {
  readonly steps: ReadonlyArray<{ name: string; options: StepDefinition["options"] }>;

  constructor(
    readonly name: string,
    private readonly stepDefs: StepDefinition[],
    private readonly logger: VorqLogger,
    private readonly eventBus: EventBus,
  ) {
    this.steps = stepDefs.map((s) => ({ name: s.name, options: s.options }));
  }

  async run(input: TInput, options?: { signal?: AbortSignal }): Promise<WorkflowResult<TResults>> {
    const workflowId = crypto.randomUUID();
    const startTime = Date.now();
    const results: Record<string, unknown> = {};

    await this.eventBus.emit("workflow.started", {
      workflowId,
      name: this.name,
      input: input as unknown,
    });

    for (const stepDef of this.stepDefs) {
      if (options?.signal?.aborted) {
        return {
          workflowId,
          status: "failed",
          results: results as Partial<TResults>,
          failedStep: stepDef.name,
          error: new Error("Workflow cancelled"),
          duration: Date.now() - startTime,
        };
      }

      const outcome = await this.executeStep(stepDef, input, results, workflowId, options);

      if (!outcome.succeeded) {
        await this.eventBus.emit("workflow.stepFailed", {
          workflowId,
          step: stepDef.name,
          error: outcome.error,
          attempts: outcome.attempts,
        });

        await this.eventBus.emit("workflow.failed", {
          workflowId,
          failedStep: stepDef.name,
          error: outcome.error,
        });

        return {
          workflowId,
          status: "failed",
          results: results as Partial<TResults>,
          failedStep: stepDef.name,
          error: outcome.error,
          duration: Date.now() - startTime,
        };
      }
    }

    await this.eventBus.emit("workflow.completed", {
      workflowId,
      results: results as unknown,
      duration: Date.now() - startTime,
    });

    return {
      workflowId,
      status: "completed",
      results: results as TResults,
      duration: Date.now() - startTime,
    };
  }

  on<E extends keyof VorqEventMap>(event: E, listener: (data: VorqEventMap[E]) => void): void {
    this.eventBus.on(event, listener);
  }

  private async executeStep(
    stepDef: StepDefinition,
    input: TInput,
    results: Record<string, unknown>,
    workflowId: string,
    options?: { signal?: AbortSignal },
  ): Promise<StepOutcome> {
    const retryPolicy = new RetryPolicy({
      maxRetries: stepDef.options.maxRetries ?? 0,
      backoff: stepDef.options.backoff,
    });

    let lastError = new Error("Unknown step error");
    let attempt = 1;

    while (attempt <= retryPolicy.maxRetries + 1) {
      try {
        const result = await this.executeAttempt(
          stepDef,
          input,
          results,
          workflowId,
          attempt,
          options,
        );
        results[stepDef.name] = result;
        return { succeeded: true };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (retryPolicy.shouldRetry(attempt, lastError)) {
          const delay = retryPolicy.getDelay(attempt);
          await this.eventBus.emit("workflow.stepRetrying", {
            workflowId,
            step: stepDef.name,
            attempt,
            nextDelay: delay,
          });
          await new Promise((r) => setTimeout(r, delay));
          attempt++;
        } else {
          break;
        }
      }
    }

    return { succeeded: false, error: lastError, attempts: attempt };
  }

  private async executeAttempt(
    stepDef: StepDefinition,
    input: TInput,
    results: Record<string, unknown>,
    workflowId: string,
    attempt: number,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    const signal = this.buildSignal(stepDef, options);
    const stepStart = Date.now();

    const ctx: StepContext<TInput, Record<string, unknown>> = {
      input,
      results: { ...results },
      workflowId,
      stepName: stepDef.name,
      attempt,
      signal,
      log: (message: string) => {
        this.logger.info(message, { workflowId, step: stepDef.name });
      },
    };

    const result = await stepDef.handler(ctx);

    await this.eventBus.emit("workflow.stepCompleted", {
      workflowId,
      step: stepDef.name,
      result: result as unknown,
      duration: Date.now() - stepStart,
    });

    return result;
  }

  private buildSignal(stepDef: StepDefinition, options?: { signal?: AbortSignal }): AbortSignal {
    const signals: AbortSignal[] = [];
    if (stepDef.options.timeout) {
      signals.push(AbortSignal.timeout(stepDef.options.timeout));
    }
    if (options?.signal) {
      signals.push(options.signal);
    }
    return signals.length > 0 ? AbortSignal.any(signals) : new AbortController().signal;
  }
}
