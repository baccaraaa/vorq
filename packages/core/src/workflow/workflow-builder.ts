import type { EventBus } from "../events/event-bus.js";
import type { VorqLogger } from "../logging/types.js";
import type { EnsureNewName, StepDefinition, StepHandler, StepOptions } from "./types.js";
import { Workflow } from "./workflow.js";

export class WorkflowBuilder<
  TInput,
  TResults extends Record<string, unknown> = Record<string, never>,
> {
  private readonly stepDefs: StepDefinition[] = [];

  constructor(
    private readonly name: string,
    private readonly logger: VorqLogger,
    private readonly eventBus: EventBus,
  ) {}

  step<TName extends string, TOutput>(
    name: EnsureNewName<TResults, TName>,
    handlerOrOptions: StepHandler<TInput, TResults, TOutput> | StepOptions,
    maybeHandler?: StepHandler<TInput, TResults, TOutput>,
  ): WorkflowBuilder<TInput, TResults & Record<TName, TOutput>> {
    let options: StepOptions = {};
    let handler: StepHandler<TInput, TResults, TOutput>;

    if (typeof handlerOrOptions === "function") {
      handler = handlerOrOptions;
    } else {
      options = handlerOrOptions;
      if (!maybeHandler) {
        throw new Error("Handler is required when options are provided");
      }
      handler = maybeHandler;
    }

    this.stepDefs.push({
      name: name as string,
      options,
      handler: handler as StepHandler<unknown, unknown, unknown>,
    });

    return this as unknown as WorkflowBuilder<TInput, TResults & Record<TName, TOutput>>;
  }

  build(): Workflow<TInput, TResults> {
    return new Workflow<TInput, TResults>(
      this.name,
      [...this.stepDefs],
      this.logger,
      this.eventBus,
    );
  }
}
