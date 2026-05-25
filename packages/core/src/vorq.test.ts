import { beforeEach, describe, expect, it, vi } from "vitest";
import { Priority, TaskStatus } from "./task/types.js";
import { InMemoryTransport } from "./transport/in-memory-transport.js";
import { Vorq } from "./vorq.js";
import type { TaskContext } from "./worker/types.js";

describe("Vorq", () => {
  let transport: InMemoryTransport;

  beforeEach(() => {
    transport = new InMemoryTransport();
  });

  it("creates instance without error", () => {
    const vorq = new Vorq({ transport });
    expect(vorq).toBeInstanceOf(Vorq);
  });

  it("start() connects transport, shutdown() disconnects", async () => {
    const vorq = new Vorq({ transport });
    expect(transport.isConnected()).toBe(false);

    await vorq.start();
    expect(transport.isConnected()).toBe(true);

    await vorq.shutdown();
    expect(transport.isConnected()).toBe(false);
  });

  it("createQueue() returns QueueHandle with correct name", async () => {
    const vorq = new Vorq({ transport });
    const handle = await vorq.createQueue("my-queue");
    expect(handle.name).toBe("my-queue");
  });

  it("enqueue() publishes task and returns UUID", async () => {
    const vorq = new Vorq({ transport });
    await vorq.start();
    await vorq.createQueue("test");

    const id = await vorq.enqueue("test", { name: "job", payload: { x: 1 } });

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const published = transport.getPublished("test");
    expect(published).toHaveLength(1);
    expect(published[0].task.taskName).toBe("job");

    await vorq.shutdown();
  });

  it("enqueueBatch() returns array of IDs", async () => {
    const vorq = new Vorq({ transport });
    await vorq.start();
    await vorq.createQueue("test");

    const ids = await vorq.enqueueBatch("test", [
      { name: "a", payload: 1 },
      { name: "b", payload: 2 },
      { name: "c", payload: 3 },
    ]);

    expect(ids).toHaveLength(3);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }

    await vorq.shutdown();
  });

  it("full flow: enqueue -> worker processes -> completed event", async () => {
    const vorq = new Vorq({ transport });

    await vorq.createQueue("test");
    const handler = vi.fn(async (_ctx: TaskContext) => "done");
    vorq.registerWorker("test", handler);

    const completed = vi.fn();
    vorq.on("task.completed", completed);

    await vorq.start();
    await vorq.enqueue("test", { name: "job", payload: { x: 1 } });
    await transport.drain("test");

    await new Promise((r) => setTimeout(r, 50));

    expect(handler).toHaveBeenCalledOnce();
    expect(completed).toHaveBeenCalledOnce();

    await vorq.shutdown();
  });

  it("DAG flow: A completes -> B becomes available -> B completes", async () => {
    const vorq = new Vorq({ transport });

    await vorq.createQueue("dag");
    const handler = vi.fn(async (_ctx: TaskContext) => "ok");
    vorq.registerWorker("dag", handler);

    const completed = vi.fn();
    vorq.on("task.completed", completed);

    await vorq.start();

    const idA = await vorq.enqueue("dag", { name: "taskA", payload: {} });
    const idB = await vorq.enqueue("dag", {
      name: "taskB",
      payload: {},
      options: { dependsOn: [idA] },
    });

    expect(transport.getPublished("dag")).toHaveLength(1);

    await transport.drain("dag");
    await new Promise((r) => setTimeout(r, 50));

    expect(handler).toHaveBeenCalledOnce();
    expect(completed).toHaveBeenCalledOnce();

    await transport.drain("dag");
    await new Promise((r) => setTimeout(r, 50));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(completed).toHaveBeenCalledTimes(2);

    await vorq.shutdown();
  });

  it("schedule() returns schedule ID", () => {
    const vorq = new Vorq({ transport });
    const scheduleId = vorq.schedule("test", "*/5 * * * *", {
      name: "scheduled-job",
      payload: {},
    });
    expect(scheduleId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("on() receives typed events", async () => {
    const vorq = new Vorq({ transport });
    const enqueued = vi.fn();
    vorq.on("task.enqueued", enqueued);

    await vorq.start();
    await vorq.createQueue("test");
    await vorq.enqueue("test", { name: "job", payload: {} });

    expect(enqueued).toHaveBeenCalledOnce();
    expect(enqueued).toHaveBeenCalledWith(expect.objectContaining({ queue: "test" }));

    await vorq.shutdown();
  });

  it("registerWorker() returns WorkerHandle with pause/resume/isRunning", async () => {
    const vorq = new Vorq({ transport });
    const handle = vorq.registerWorker("test", async () => {});

    expect(handle.isRunning()).toBe(false);
    handle.resume();
    expect(handle.isRunning()).toBe(true);
    handle.pause();
    expect(handle.isRunning()).toBe(false);
  });

  it("DAG: dead-lettered task abandons downstream", async () => {
    const vorq = new Vorq({
      transport,
      defaults: { retryPolicy: { maxRetries: 0 } },
    });

    await vorq.createQueue("dag");

    const handler = vi.fn(async () => {
      throw new Error("fail");
    });
    vorq.registerWorker("dag", handler);

    const abandoned = vi.fn();
    vorq.on("task.abandoned", abandoned);

    await vorq.start();

    const idA = await vorq.enqueue("dag", { name: "taskA", payload: {} });
    await vorq.enqueue("dag", {
      name: "taskB",
      payload: {},
      options: { dependsOn: [idA] },
    });

    await transport.drain("dag");
    await new Promise((r) => setTimeout(r, 50));

    expect(abandoned).toHaveBeenCalledOnce();

    await vorq.shutdown();
  });
});

describe("Vorq introspection", () => {
  it("exposes metrics and tasks for a queue without storage", async () => {
    const vorq = new Vorq({ transport: new InMemoryTransport() });
    await vorq.createQueue("emails");

    vorq.registerWorker("emails", async () => "ok");
    await vorq.start();

    await vorq.enqueue("emails", { name: "send", payload: { to: "a" } });
    // Allow async listeners to settle
    await new Promise((r) => setImmediate(r));

    const queues = vorq.listQueues();
    expect(queues.map((q) => q.name)).toContain("emails");

    const metrics = vorq.getQueueMetrics("emails");
    expect(metrics).toMatchObject({ completed: expect.any(Number) });

    const page = vorq.listTasks({ queue: "emails", limit: 10 });
    expect(page.items.length).toBeGreaterThan(0);

    await vorq.shutdown();
  });
});
