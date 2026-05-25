import { InMemoryTransport, Vorq } from "@vorq/core";
import { describe, expect, it } from "vitest";
import { EmbeddedDataSource } from "./data/embedded.js";
import { createServer } from "./server.js";

describe("static UI", () => {
  it("serves index.html with injected base", async () => {
    const vorq = new Vorq({ transport: new InMemoryTransport() });
    await vorq.start();
    const server = createServer({
      dataSource: new EmbeddedDataSource(vorq),
      basePath: "/admin/queues",
    });
    // Allow async fastify-static registration to settle.
    await server.ready();
    const r = await server.inject({ method: "GET", url: "/admin/queues/" });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('href="/admin/queues/"');
    await server.close();
    await vorq.shutdown();
  });
});
