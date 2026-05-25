import { describe, expect, it } from "vitest";
import { EventBus } from "../events/event-bus.js";
import { ConsoleLogger } from "../logging/console-logger.js";
import { TaskStatus } from "../task/types.js";
import { TaskRegistry } from "./task-registry.js";

describe("TaskRegistry", () => {
  it("records task lifecycle and exposes a record", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const reg = new TaskRegistry(bus, { capacity: 100 });

    await bus.emit("task.enqueued", { taskId: "t1", queue: "q" });
    await bus.emit("task.active", { taskId: "t1", queue: "q", attempt: 1 });
    await bus.emit("task.completed", {
      taskId: "t1",
      queue: "q",
      result: { ok: true },
      duration: 12,
    });

    const r = reg.get("t1");
    expect(r?.status).toBe(TaskStatus.COMPLETED);
    expect(r?.result).toEqual({ ok: true });
    expect(r?.attempt).toBe(1);
  });

  it("filters by queue and status with cursor pagination", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const reg = new TaskRegistry(bus, { capacity: 100 });
    for (let i = 0; i < 5; i++) {
      await bus.emit("task.enqueued", { taskId: `t${i}`, queue: "q" });
    }
    const page = reg.list({ queue: "q", limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeDefined();
    const page2 = reg.list({ queue: "q", limit: 2, cursor: page.nextCursor });
    expect(page2.items).toHaveLength(2);
  });

  it("respects bounded capacity (ring buffer)", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const reg = new TaskRegistry(bus, { capacity: 3 });
    for (let i = 0; i < 5; i++) {
      await bus.emit("task.enqueued", { taskId: `t${i}`, queue: "q" });
    }
    expect(reg.list({ queue: "q", limit: 10 }).items).toHaveLength(3);
  });
});
