import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueueNotFoundError, VorqError } from "../errors/index.js";
import type { TaskDefinition } from "../task/types.js";
import { InMemoryTransport } from "../transport/in-memory-transport.js";
import { QueueManager } from "./queue-manager.js";
import type { QueueHandle } from "./types.js";

describe("QueueManager", () => {
  let transport: InMemoryTransport;
  let enqueueCallback: ReturnType<typeof vi.fn>;
  let manager: QueueManager;

  beforeEach(async () => {
    transport = new InMemoryTransport();
    await transport.connect();
    enqueueCallback = vi.fn().mockResolvedValue("task-id-123");
    manager = new QueueManager(transport, {
      enqueue: enqueueCallback,
      pauseWorkers: vi.fn().mockResolvedValue(undefined),
      resumeWorkers: vi.fn().mockResolvedValue(undefined),
    });
  });

  describe("createQueue", () => {
    it("creates queue in transport and returns QueueHandle", async () => {
      const handle = await manager.createQueue("emails");
      expect(handle).toBeDefined();
      expect(handle.name).toBe("emails");
    });

    it("creates dlq:{name} queue in transport", async () => {
      await manager.createQueue("emails");
      await transport.publish(
        "dlq:emails",
        {
          taskId: "t1",
          taskName: "test",
          queue: "dlq:emails",
          payload: {},
          attempt: 1,
          priority: 2,
          delay: 0,
          maxRetries: 3,
          createdAt: Date.now(),
        },
        {},
      );
      const published = transport.getPublished("dlq:emails");
      expect(published).toHaveLength(1);
    });

    it("throws VorqError when queue already exists", async () => {
      await manager.createQueue("emails");
      await expect(manager.createQueue("emails")).rejects.toThrow(VorqError);
    });
  });

  describe("QueueHandle", () => {
    let handle: QueueHandle;

    beforeEach(async () => {
      handle = await manager.createQueue("jobs");
    });

    it("enqueue delegates to enqueue callback", async () => {
      const task: TaskDefinition = {
        name: "send-email",
        payload: { to: "user@test.com" },
      };
      const id = await handle.enqueue(task);
      expect(enqueueCallback).toHaveBeenCalledWith("jobs", task);
      expect(id).toBe("task-id-123");
    });

    it("name returns correct queue name", () => {
      expect(handle.name).toBe("jobs");
    });
  });

  describe("getQueue", () => {
    it("returns existing QueueHandle", async () => {
      await manager.createQueue("emails");
      const handle = manager.getQueue("emails");
      expect(handle).toBeDefined();
      expect(handle.name).toBe("emails");
    });

    it("throws QueueNotFoundError for unknown queue", () => {
      expect(() => manager.getQueue("unknown")).toThrow(QueueNotFoundError);
    });
  });

  describe("hasQueue", () => {
    it("returns true for existing queue", async () => {
      await manager.createQueue("emails");
      expect(manager.hasQueue("emails")).toBe(true);
    });

    it("returns false for non-existing queue", () => {
      expect(manager.hasQueue("unknown")).toBe(false);
    });
  });
});

import { Vorq } from "../vorq.js";

describe("queue pause/resume", () => {
  it("pauses workers attached to the queue", async () => {
    const vorq = new Vorq({ transport: new InMemoryTransport() });
    const queue = await vorq.createQueue("q");
    const w = vorq.registerWorker("q", async () => "ok");
    await vorq.start();
    await queue.pause();
    expect(w.isRunning()).toBe(false);
    await queue.resume();
    expect(w.isRunning()).toBe(true);
    await vorq.shutdown();
  });
});
