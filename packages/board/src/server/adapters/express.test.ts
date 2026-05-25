import express from "express";
import { describe, expect, it } from "vitest";
import { InMemoryTransport, Vorq } from "@vorq/core";
import { createVorqBoard } from "../../index.js";
import { expressAdapter } from "./express.js";

describe("express adapter", () => {
  it("mounts the board and serves API + healthz under a sub-path", async () => {
    const vorq = new Vorq({ transport: new InMemoryTransport() });
    await vorq.createQueue("q");
    await vorq.start();
    const board = createVorqBoard({ vorq, basePath: "/admin/queues" });
    await board.server.ready();

    const app = express();
    app.use(expressAdapter(board));

    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const port = (server.address() as { port: number }).port;

    const healthz = await fetch(`http://127.0.0.1:${port}/admin/queues/healthz`);
    expect(healthz.status).toBe(200);

    const queues = await fetch(`http://127.0.0.1:${port}/admin/queues/api/queues`);
    expect(queues.status).toBe(200);
    const body = (await queues.json()) as { name: string }[];
    expect(body.map((q) => q.name)).toContain("q");

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await board.server.close();
    await vorq.shutdown();
  });
});
