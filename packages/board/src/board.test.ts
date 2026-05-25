import { describe, expect, it } from "vitest";
import { InMemoryTransport, Vorq } from "@vorq/core";
import { createVorqBoard } from "./index.js";

describe("createVorqBoard", () => {
  it("returns an object exposing the underlying Fastify server", async () => {
    const vorq = new Vorq({ transport: new InMemoryTransport() });
    await vorq.start();
    const board = createVorqBoard({ vorq });
    const r = await board.server.inject({ method: "GET", url: "/healthz" });
    expect(r.statusCode).toBe(200);
    await board.server.close();
    await vorq.shutdown();
  });

  it("forwards readOnly and basePath to the underlying server", async () => {
    const vorq = new Vorq({ transport: new InMemoryTransport() });
    await vorq.createQueue("q");
    await vorq.start();
    const board = createVorqBoard({ vorq, readOnly: true, basePath: "/admin/queues" });
    const r = await board.server.inject({
      method: "POST",
      url: "/admin/queues/api/queues/q/pause",
    });
    expect(r.statusCode).toBe(403);
    await board.server.close();
    await vorq.shutdown();
  });
});
