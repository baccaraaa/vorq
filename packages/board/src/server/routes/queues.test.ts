import { InMemoryTransport, Vorq } from "@vorq/core";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EmbeddedDataSource } from "../data/embedded.js";
import { createServer } from "../server.js";

let vorq: Vorq;
let server: FastifyInstance;

beforeEach(async () => {
  vorq = new Vorq({ transport: new InMemoryTransport() });
  await vorq.createQueue("emails");
  await vorq.start();
  server = createServer({ dataSource: new EmbeddedDataSource(vorq) });
});

afterEach(async () => {
  await server.close();
  await vorq.shutdown();
});

describe("queue routes", () => {
  it("GET /api/queues lists queues with metrics", async () => {
    const r = await server.inject({ method: "GET", url: "/api/queues" });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { name: string; metrics: unknown; paused: boolean }[];
    expect(body.map((q) => q.name)).toContain("emails");
  });

  it("GET /api/queues/:name returns detail", async () => {
    vorq.registerWorker("emails", async () => "ok");
    const r = await server.inject({ method: "GET", url: "/api/queues/emails" });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { name: string; workers: unknown[] };
    expect(body.name).toBe("emails");
    expect(Array.isArray(body.workers)).toBe(true);
  });

  it("POST /api/queues/:name/pause pauses workers", async () => {
    vorq.registerWorker("emails", async () => "ok");
    const r = await server.inject({ method: "POST", url: "/api/queues/emails/pause" });
    expect(r.statusCode).toBe(204);
  });

  it("POST /api/queues/:name/resume resumes workers", async () => {
    vorq.registerWorker("emails", async () => "ok");
    await server.inject({ method: "POST", url: "/api/queues/emails/pause" });
    const r = await server.inject({ method: "POST", url: "/api/queues/emails/resume" });
    expect(r.statusCode).toBe(204);
  });

  it("404 for unknown queue detail", async () => {
    const r = await server.inject({ method: "GET", url: "/api/queues/nope" });
    expect(r.statusCode).toBe(404);
  });

  it("403 for mutations in read-only mode", async () => {
    const ro = createServer({ dataSource: new EmbeddedDataSource(vorq), readOnly: true });
    const r = await ro.inject({ method: "POST", url: "/api/queues/emails/pause" });
    expect(r.statusCode).toBe(403);
    await ro.close();
  });
});
