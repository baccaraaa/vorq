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
  await server.listen({ port: 0, host: "127.0.0.1" });
});

afterEach(async () => {
  await server.close();
  await vorq.shutdown();
});

describe("SSE /api/events", () => {
  it("emits task.enqueued as an SSE event", async () => {
    const addr = server.server.address() as { port: number };
    const url = `http://127.0.0.1:${addr.port}/api/events`;
    const res = await fetch(url);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    // biome-ignore lint/style/noNonNullAssertion: streaming body always present
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    await vorq.enqueue("q", { name: "x", payload: {} });

    const start = Date.now();
    while (!buf.includes("event: task.enqueued") && Date.now() - start < 3000) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
    }
    expect(buf).toContain("event: task.enqueued");
    await reader.cancel();
  });
});
