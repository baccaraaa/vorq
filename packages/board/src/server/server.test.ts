import { InMemoryTransport, Vorq } from "@vorq/core";
import { describe, expect, it } from "vitest";
import { EmbeddedDataSource } from "./data/embedded.js";
import { createServer } from "./server.js";

describe("server", () => {
  it("responds 200 on /healthz", async () => {
    const vorq = new Vorq({ transport: new InMemoryTransport() });
    await vorq.start();
    const server = createServer({ dataSource: new EmbeddedDataSource(vorq) });
    const res = await server.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await server.close();
    await vorq.shutdown();
  });
});
