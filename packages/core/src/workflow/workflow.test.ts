import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../events/event-bus.js";
import type { VorqLogger } from "../logging/types.js";
import { FixedBackoff } from "../retry/fixed-backoff.js";
import { WorkflowBuilder } from "./workflow-builder.js";

function createLogger(): VorqLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function createBuilder<TInput>(name = "test-workflow") {
  const logger = createLogger();
  const eventBus = new EventBus(logger);
  return { builder: new WorkflowBuilder<TInput>(name, logger, eventBus), logger, eventBus };
}

describe("Workflow", () => {
  it("runs a basic 2-step workflow and returns completed results", async () => {
    const { builder } = createBuilder<{ x: number }>();

    const workflow = builder
      .step("double", async (ctx) => ctx.input.x * 2)
      .step("toString", async (ctx) => String(ctx.results.double))
      .build();

    const result = await workflow.run({ x: 5 });

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.results.double).toBe(10);
      expect(result.results.toString).toBe("10");
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.workflowId).toBeDefined();
    }
  });

  it("provides type-safe accumulator — step 2 accesses step 1 results", async () => {
    const { builder } = createBuilder<{ name: string }>();

    const workflow = builder
      .step("greet", async (ctx) => `Hello, ${ctx.input.name}`)
      .step("shout", async (ctx) => ctx.results.greet.toUpperCase())
      .build();

    const result = await workflow.run({ name: "World" });

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.results.shout).toBe("HELLO, WORLD");
    }
  });

  it("chains 3 steps with all results available in final step", async () => {
    const { builder } = createBuilder<{ value: number }>();

    const workflow = builder
      .step("a", async (ctx) => ctx.input.value + 1)
      .step("b", async (ctx) => ctx.results.a + 10)
      .step("c", async (ctx) => ctx.results.a + ctx.results.b)
      .build();

    const result = await workflow.run({ value: 1 });

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.results.a).toBe(2);
      expect(result.results.b).toBe(12);
      expect(result.results.c).toBe(14);
    }
  });

  it("returns failed status when a step throws", async () => {
    const { builder } = createBuilder<void>();

    const workflow = builder
      .step("ok", async () => "fine")
      .step("boom", async () => {
        throw new Error("step exploded");
      })
      .build();

    const result = await workflow.run(undefined);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.failedStep).toBe("boom");
      expect(result.error.message).toBe("step exploded");
    }
  });

  it("preserves partial results on failure", async () => {
    const { builder } = createBuilder<void>();

    const workflow = builder
      .step("first", async () => 42)
      .step("second", async () => {
        throw new Error("fail");
      })
      .step("third", async () => "never reached")
      .build();

    const result = await workflow.run(undefined);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.results.first).toBe(42);
      expect(result.results.second).toBeUndefined();
      expect(result.results.third).toBeUndefined();
    }
  });

  it("retries a failing step and succeeds", async () => {
    const { builder } = createBuilder<void>();
    let calls = 0;

    const workflow = builder
      .step("flaky", { maxRetries: 2, backoff: new FixedBackoff(1) }, async () => {
        calls++;
        if (calls < 2) throw new Error("transient");
        return "ok";
      })
      .build();

    const result = await workflow.run(undefined);

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.results.flaky).toBe("ok");
    }
    expect(calls).toBe(2);
  });

  it("fails after retries are exhausted", async () => {
    const { builder } = createBuilder<void>();
    let calls = 0;

    const workflow = builder
      .step("alwaysFails", { maxRetries: 3, backoff: new FixedBackoff(1) }, async () => {
        calls++;
        throw new Error("permanent");
      })
      .build();

    const result = await workflow.run(undefined);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.failedStep).toBe("alwaysFails");
      expect(result.error.message).toBe("permanent");
    }
    expect(calls).toBe(3);
  });

  it("fails a step that exceeds its timeout", async () => {
    const { builder } = createBuilder<void>();

    const workflow = builder
      .step("slow", { timeout: 10 }, async (ctx) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 5000);
          ctx.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(ctx.signal.reason);
          });
        });
        return "done";
      })
      .build();

    const result = await workflow.run(undefined);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.failedStep).toBe("slow");
    }
  });

  it("cancels mid-workflow via external AbortSignal", async () => {
    const { builder } = createBuilder<void>();
    const controller = new AbortController();

    const workflow = builder
      .step("first", async () => {
        controller.abort();
        return "done";
      })
      .step("second", async () => "should not run")
      .build();

    const result = await workflow.run(undefined, { signal: controller.signal });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.failedStep).toBe("second");
      expect(result.error.message).toBe("Workflow cancelled");
      expect(result.results.first).toBe("done");
    }
  });

  it("emits workflow.started, workflow.stepCompleted, workflow.completed events", async () => {
    const { builder, eventBus } = createBuilder<{ n: number }>("events-test");
    const events: Array<{ event: string; data: unknown }> = [];

    eventBus.on("workflow.started", (d) => events.push({ event: "workflow.started", data: d }));
    eventBus.on("workflow.stepCompleted", (d) =>
      events.push({ event: "workflow.stepCompleted", data: d }),
    );
    eventBus.on("workflow.completed", (d) => events.push({ event: "workflow.completed", data: d }));

    const workflow = builder
      .step("a", async () => 1)
      .step("b", async () => 2)
      .build();

    await workflow.run({ n: 0 });

    expect(events.map((e) => e.event)).toEqual([
      "workflow.started",
      "workflow.stepCompleted",
      "workflow.stepCompleted",
      "workflow.completed",
    ]);
  });

  it("emits workflow.stepFailed and workflow.failed on failure", async () => {
    const { builder, eventBus } = createBuilder<void>();
    const events: string[] = [];

    eventBus.on("workflow.stepFailed", () => events.push("workflow.stepFailed"));
    eventBus.on("workflow.failed", () => events.push("workflow.failed"));

    const workflow = builder
      .step("boom", async () => {
        throw new Error("fail");
      })
      .build();

    await workflow.run(undefined);

    expect(events).toEqual(["workflow.stepFailed", "workflow.failed"]);
  });

  it("emits workflow.stepRetrying on retry", async () => {
    const { builder, eventBus } = createBuilder<void>();
    const retryEvents: Array<{ step: string; attempt: number }> = [];
    let calls = 0;

    eventBus.on("workflow.stepRetrying", (d) =>
      retryEvents.push({ step: d.step, attempt: d.attempt }),
    );

    const workflow = builder
      .step("flaky", { maxRetries: 2, backoff: new FixedBackoff(1) }, async () => {
        calls++;
        if (calls < 2) throw new Error("transient");
        return "ok";
      })
      .build();

    await workflow.run(undefined);

    expect(retryEvents).toEqual([{ step: "flaky", attempt: 1 }]);
  });

  it("handles empty workflow — no steps returns completed with empty results", async () => {
    const { builder } = createBuilder<void>();

    const workflow = builder.build();
    const result = await workflow.run(undefined);

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.results).toEqual({});
    }
  });

  it("exposes workflow name and steps metadata", () => {
    const { builder } = createBuilder<void>("my-workflow");

    const workflow = builder
      .step("a", { timeout: 5000 }, async () => 1)
      .step("b", async () => 2)
      .build();

    expect(workflow.name).toBe("my-workflow");
    expect(workflow.steps).toEqual([
      { name: "a", options: { timeout: 5000 } },
      { name: "b", options: {} },
    ]);
  });
});
