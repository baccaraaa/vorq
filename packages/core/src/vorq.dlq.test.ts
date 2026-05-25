import { describe, expect, it } from "vitest";
import { InMemoryTransport } from "./transport/in-memory-transport.js";
import { Vorq } from "./vorq.js";

describe("DLQ operations", () => {
  it("lists, retries, and purges DLQ entries (InMemoryTransport)", async () => {
    const vorq = new Vorq({
      transport: new InMemoryTransport(),
      defaults: { retryPolicy: { maxRetries: 0 } },
    });
    await vorq.createQueue("emails");
    let attempts = 0;
    vorq.registerWorker("emails", async () => {
      attempts++;
      throw new Error("boom");
    });
    await vorq.start();

    await vorq.enqueue("emails", { name: "x", payload: {} });

    // Drain so the failure path runs
    await (vorq as unknown as { transport: InMemoryTransport }).transport.drain("emails");
    await new Promise((r) => setImmediate(r));

    const dlq = await vorq.getDLQ("emails");
    expect(dlq.length).toBe(1);
    expect(attempts).toBeGreaterThan(0);

    await vorq.retryFromDLQ(dlq[0].taskId);
    expect((await vorq.getDLQ("emails")).length).toBe(0);

    await vorq.purgeDLQ("emails");
    expect((await vorq.getDLQ("emails")).length).toBe(0);

    await vorq.shutdown();
  });
});
