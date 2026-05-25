import { describe, expect, it, vi } from "vitest";
import { ConsoleLogger } from "../logging/console-logger.js";
import { EventBus } from "./event-bus.js";

describe("EventBus", () => {
  it("emits events to listeners", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const listener = vi.fn();

    bus.on("task.completed", listener);
    await bus.emit("task.completed", { taskId: "1", queue: "q", result: null, duration: 100 });

    expect(listener).toHaveBeenCalledWith({
      taskId: "1",
      queue: "q",
      result: null,
      duration: 100,
    });
  });

  it("supports multiple listeners for same event", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    bus.on("task.failed", listener1);
    bus.on("task.failed", listener2);
    await bus.emit("task.failed", {
      taskId: "1",
      queue: "q",
      error: new Error("fail"),
      attempt: 1,
    });

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it("does not throw when listener throws — logs error instead", async () => {
    const logger = new ConsoleLogger();
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const bus = new EventBus(logger);

    bus.on("task.completed", () => {
      throw new Error("listener crash");
    });

    await expect(
      bus.emit("task.completed", { taskId: "1", queue: "q", result: null, duration: 0 }),
    ).resolves.not.toThrow();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("off removes listener", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const listener = vi.fn();

    bus.on("task.completed", listener);
    bus.off("task.completed", listener);
    await bus.emit("task.completed", { taskId: "1", queue: "q", result: null, duration: 0 });

    expect(listener).not.toHaveBeenCalled();
  });

  it("does nothing when emitting event with no listeners", async () => {
    const bus = new EventBus(new ConsoleLogger());
    await expect(
      bus.emit("task.completed", { taskId: "1", queue: "q", result: null, duration: 0 }),
    ).resolves.not.toThrow();
  });

  it("subscribeAll receives all event types", async () => {
    const bus = new EventBus(new ConsoleLogger());
    const received: { event: string; data: unknown }[] = [];
    const unsub = bus.subscribeAll((event, data) => {
      received.push({ event, data });
    });

    await bus.emit("task.enqueued", { taskId: "1", queue: "q" });
    await bus.emit("task.completed", { taskId: "1", queue: "q", result: null, duration: 1 });

    expect(received.map((r) => r.event)).toEqual(["task.enqueued", "task.completed"]);
    unsub();
    await bus.emit("task.enqueued", { taskId: "2", queue: "q" });
    expect(received).toHaveLength(2);
  });
});
