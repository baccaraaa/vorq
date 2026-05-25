import { describe, expect, it } from "vitest";
import { StandaloneDataSource } from "./standalone.js";

describe("StandaloneDataSource (no storage)", () => {
  it("returns no queues when not configured with known queues", async () => {
    const ds = new StandaloneDataSource({ transportUrl: "memory://", storageUrl: undefined });
    await ds.connect();
    expect(await ds.listQueues()).toEqual([]);
    await ds.disconnect();
  });

  it("returns configured known queues with zero metrics", async () => {
    const ds = new StandaloneDataSource({
      transportUrl: "memory://",
      storageUrl: undefined,
      knownQueues: ["emails", "reports"],
    });
    await ds.connect();
    const queues = await ds.listQueues();
    expect(queues.map((q) => q.name)).toEqual(["emails", "reports"]);
    expect(queues[0].metrics.pending).toBe(0);
    await ds.disconnect();
  });

  it("getQueueDetail returns null for unknown queue", async () => {
    const ds = new StandaloneDataSource({
      transportUrl: "memory://",
      storageUrl: undefined,
      knownQueues: ["emails"],
    });
    await ds.connect();
    expect(await ds.getQueueDetail("missing")).toBeNull();
    await ds.disconnect();
  });
});
