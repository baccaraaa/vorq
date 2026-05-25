import type { FastifyInstance } from "fastify";
import type { ServerOptions } from "../server.js";

export function registerEventRoutes(app: FastifyInstance, opts: ServerOptions, base = "") {
  const ds = opts.dataSource;

  app.get(`${base}/api/events`, (req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders?.();

    const send = (evt: { event: string; data: unknown }) => {
      reply.raw.write(`event: ${evt.event}\n`);
      reply.raw.write(`data: ${JSON.stringify(evt.data)}\n\n`);
    };

    let unsub: () => void;
    if (ds.subscribeEvents) {
      unsub = ds.subscribeEvents(send);
    } else {
      // Polling fallback (standalone mode) — emit queue.metrics every second.
      const interval = setInterval(async () => {
        try {
          for (const q of await ds.listQueues()) {
            send({ event: "queue.metrics", data: q });
          }
        } catch {
          // Swallow during shutdown
        }
      }, 1000);
      unsub = () => clearInterval(interval);
    }

    // Heartbeat every 15s so reverse proxies don't close the connection.
    const heartbeat = setInterval(() => reply.raw.write(`: heartbeat\n\n`), 15_000);

    req.raw.on("close", () => {
      unsub();
      clearInterval(heartbeat);
    });
  });
}
