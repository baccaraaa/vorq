import { describe, expect, it } from "vitest";
import { ConsoleLogger } from "../logging/console-logger.js";
import { EventBus } from "../events/event-bus.js";
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
    expect(m).toEqual({ pending: 0, active: 0, completed: 0, failed: 0, delayed: 0, avgDuration: 0, throughput: 0 });
  });
});
