import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryTransport, Vorq } from "@vorq/core";
import { EmbeddedDataSource } from "../data/embedded.js";
import { createServer } from "../server.js";

let vorq: Vorq;
let server: FastifyInstance;

beforeEach(async () => {
  vorq = new Vorq({
    transport: new InMemoryTransport(),
    defaults: { retryPolicy: { maxRetries: 0 } },
  });
  await vorq.createQueue("q");
  vorq.registerWorker("q", async () => {
    throw new Error("nope");
  });
  await vorq.start();
  server = createServer({ dataSource: new EmbeddedDataSource(vorq) });
});

afterEach(async () => {
  await server.close();
  await vorq.shutdown();
});

describe("DLQ routes", () => {
  it("GET, retry, purge", async () => {
    await vorq.enqueue("q", { name: "x", payload: {} });
    await (vorq as unknown as { transport: InMemoryTransport }).transport.drain("q");
    await new Promise((r) => setImmediate(r));

    const list = await server.inject({ method: "GET", url: "/api/queues/q/dlq" });
    expect(list.statusCode).toBe(200);
    const items = list.json() as { taskId: string }[];
    expect(items.length).toBe(1);

    const retry = await server.inject({
      method: "POST",
      url: `/api/queues/q/dlq/${items[0].taskId}/retry`,
    });
    expect(retry.statusCode).toBe(204);

    const purge = await server.inject({ method: "DELETE", url: "/api/queues/q/dlq" });
    expect(purge.statusCode).toBe(200);
  });

  it("403 in read-only mode", async () => {
    const ro = createServer({ dataSource: new EmbeddedDataSource(vorq), readOnly: true });
    const r = await ro.inject({ method: "POST", url: "/api/queues/q/dlq/x/retry" });
    expect(r.statusCode).toBe(403);
    await ro.close();
  });
});
