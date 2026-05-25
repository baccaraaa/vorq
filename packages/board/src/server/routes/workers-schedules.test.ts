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
  vorq.registerWorker("q", async () => "ok");
  await vorq.start();
  server = createServer({ dataSource: new EmbeddedDataSource(vorq) });
});

afterEach(async () => {
  await server.close();
  await vorq.shutdown();
});

describe("workers + schedules", () => {
  it("GET /api/schedules lists schedules", async () => {
    vorq.schedule("q", "*/5 * * * *", { name: "tick", payload: {} });
    const r = await server.inject({ method: "GET", url: "/api/schedules" });
    expect(r.statusCode).toBe(200);
    expect((r.json() as unknown[]).length).toBe(1);
  });

  it("POST worker pause/resume", async () => {
    const list = await server.inject({ method: "GET", url: "/api/queues/q" });
    const detail = list.json() as { workers: { id: string }[] };
    const workerId = detail.workers[0].id;
    const p = await server.inject({
      method: "POST",
      url: `/api/queues/q/workers/${encodeURIComponent(workerId)}/pause`,
    });
    expect(p.statusCode).toBe(204);
  });
});
