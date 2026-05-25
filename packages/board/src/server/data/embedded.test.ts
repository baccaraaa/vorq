import { InMemoryTransport, Vorq } from "@vorq/core";
import { describe, expect, it } from "vitest";
import { EmbeddedDataSource } from "./embedded.js";

describe("EmbeddedDataSource", () => {
  it("lists queues with metrics", async () => {
    const vorq = new Vorq({ transport: new InMemoryTransport() });
    await vorq.createQueue("emails");
    await vorq.start();
    const ds = new EmbeddedDataSource(vorq);

    const queues = await ds.listQueues();
    expect(queues.map((q) => q.name)).toContain("emails");
    expect(queues[0].metrics).toMatchObject({ pending: expect.any(Number) });

    await vorq.shutdown();
  });

  it("subscribeEvents forwards EventBus events", async () => {
    const vorq = new Vorq({ transport: new InMemoryTransport() });
    await vorq.createQueue("q");
    await vorq.start();
    const ds = new EmbeddedDataSource(vorq);

    const got: string[] = [];
    // biome-ignore lint/style/noNonNullAssertion: subscribeEvents always present in embedded mode
    const unsub = ds.subscribeEvents!((evt) => got.push(evt.event));
    await vorq.enqueue("q", { name: "x", payload: {} });
    await new Promise((r) => setImmediate(r));
    unsub();

    expect(got).toContain("task.enqueued");
    await vorq.shutdown();
  });

  it("subscribeEvents unsubscribe stops further events", async () => {
    const vorq = new Vorq({ transport: new InMemoryTransport() });
    await vorq.createQueue("q");
    await vorq.start();
    const ds = new EmbeddedDataSource(vorq);

    const got: string[] = [];
    // biome-ignore lint/style/noNonNullAssertion: subscribeEvents always present in embedded mode
    const unsub = ds.subscribeEvents!((evt) => got.push(evt.event));
    unsub();
    await vorq.enqueue("q", { name: "x", payload: {} });
    await new Promise((r) => setImmediate(r));

    expect(got).toHaveLength(0);
    await vorq.shutdown();
  });
});
