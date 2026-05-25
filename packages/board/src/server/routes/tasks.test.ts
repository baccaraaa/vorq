import { InMemoryTransport, Vorq } from "@vorq/core";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EmbeddedDataSource } from "../data/embedded.js";
import { createServer } from "../server.js";

let vorq: Vorq;
let server: FastifyInstance;

beforeEach(async () => {
  vorq = new Vorq({ transport: new InMemoryTransport() });
  await vorq.createQueue("q");
  await vorq.start();
  server = createServer({ dataSource: new EmbeddedDataSource(vorq) });
});

afterEach(async () => {
  await server.close();
  await vorq.shutdown();
});

describe("task routes", () => {
  it("GET /api/queues/:name/tasks paginates", async () => {
    for (let i = 0; i < 3; i++) {
      await vorq.enqueue("q", { name: "x", payload: { i } });
    }
    await new Promise((r) => setImmediate(r));
    const r = await server.inject({ method: "GET", url: "/api/queues/q/tasks?limit=10" });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; nextCursor?: string };
    expect(body.items.length).toBe(3);
  });

  it("GET /api/queues/:name/tasks/:taskId returns task", async () => {
    const id = await vorq.enqueue("q", { name: "x", payload: { ok: true } });
    await new Promise((r) => setImmediate(r));
    const r = await server.inject({ method: "GET", url: `/api/queues/q/tasks/${id}` });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { taskId: string }).taskId).toBe(id);
  });

  it("404 for missing task", async () => {
    const r = await server.inject({ method: "GET", url: "/api/queues/q/tasks/nope" });
    expect(r.statusCode).toBe(404);
  });
});
