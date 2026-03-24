import type { BackoffStrategy } from "../task/types.js";

export interface StepContext<TInput, TResults> {
  input: TInput;
  results: TResults;
  workflowId: string;
  stepName: string;
  attempt: number;
  signal: AbortSignal;
  log(message: string): void;
}

export type StepHandler<TInput, TResults, TOutput> = (
  ctx: StepContext<TInput, TResults>,
) => Promise<TOutput>;

export interface StepOptions {
  timeout?: number;
  maxRetries?: number;
  backoff?: BackoffStrategy;
}

export interface StepDefinition {
  name: string;
  options: StepOptions;
  handler: StepHandler<unknown, unknown, unknown>;
}

export type WorkflowResult<TResults> =
  | {
      workflowId: string;
      status: "completed";
      results: TResults;
      duration: number;
    }
  | {
      workflowId: string;
      status: "failed";
      results: Partial<TResults>;
      failedStep: string;
      error: Error;
      duration: number;
    };

export type EnsureNewName<TResults, TName extends string> = TName extends keyof TResults
  ? never
  : TName;
