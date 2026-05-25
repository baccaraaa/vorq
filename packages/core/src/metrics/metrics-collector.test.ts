import { describe, expect, it } from "vitest";
import { EventBus } from "../events/event-bus.js";
import { ConsoleLogger } from "../logging/console-logger.js";
import { MetricsCollector } from "./metrics-collector.js";

describe("MetricsCollector", () => {
  it("counts task lifecycle events per queue", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const collector = new MetricsCollector(bus);

    await bus.emit("task.enqueued", { taskId: "1", queue: "emails" });
    await bus.emit("task.active", { taskId: "1", queue: "emails", attempt: 1 });
    await bus.emit("task.completed", { taskId: "1", queue: "emails", result: null, duration: 50 });
    await bus.emit("task.enqueued", { taskId: "2", queue: "emails" });

    const m = collector.snapshot("emails");
    expect(m.completed).toBe(1);
    expect(m.pending).toBe(1);
    expect(m.active).toBe(0);
    expect(m.failed).toBe(0);
  });

  it("tracks throughput over a 60-minute rolling window", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const collector = new MetricsCollector(bus, { now: () => 0 });

    await bus.emit("task.completed", { taskId: "1", queue: "q", result: null, duration: 10 });

    expect(collector.snapshot("q").throughput).toBe(1);
  });

  it("returns zeros for unknown queue", () => {
    const bus = new EventBus(new ConsoleLogger());
    const collector = new MetricsCollector(bus);
    const m = collector.snapshot("nope");
    expect(m).toEqual({
      pending: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      avgDuration: 0,
      throughput: 0,
    });
  });

  it("task.failed followed by task.deadLettered decrements active once", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const c = new MetricsCollector(bus);
    await bus.emit("task.enqueued", { taskId: "1", queue: "q" });
    await bus.emit("task.active", { taskId: "1", queue: "q", attempt: 1 });
    await bus.emit("task.failed", { taskId: "1", queue: "q", error: new Error("x"), attempt: 1 });
    await bus.emit("task.deadLettered", {
      taskId: "1",
      queue: "q",
      error: new Error("x"),
      attempts: 1,
    });

    const m = c.snapshot("q");
    expect(m.active).toBe(0);
    expect(m.failed).toBe(1);
  });

  it("task.failed followed by task.retrying tracks correctly", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const c = new MetricsCollector(bus);
    await bus.emit("task.enqueued", { taskId: "1", queue: "q" });
    await bus.emit("task.active", { taskId: "1", queue: "q", attempt: 1 });
    await bus.emit("task.failed", { taskId: "1", queue: "q", error: new Error("x"), attempt: 1 });
    await bus.emit("task.retrying", { taskId: "1", queue: "q", attempt: 2, nextDelay: 100 });

    const m = c.snapshot("q");
    expect(m.active).toBe(0);
    expect(m.pending).toBe(1);
    expect(m.failed).toBe(1);
  });
});
