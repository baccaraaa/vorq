import type { FastifyInstance } from "fastify";
import type { ServerOptions } from "../server.js";

export function registerQueueRoutes(app: FastifyInstance, opts: ServerOptions, base = "") {
  const ds = opts.dataSource;
  const readOnly = opts.readOnly ?? false;

  app.get(`${base}/api/queues`, async () => await ds.listQueues());

  app.get(`${base}/api/queues/:name`, async (req, reply) => {
    const { name } = req.params as { name: string };
    const detail = await ds.getQueueDetail(name);
    if (!detail) return reply.code(404).send({ error: "queue not found" });
    return detail;
  });

  app.post(`${base}/api/queues/:name/pause`, async (req, reply) => {
    if (readOnly) return reply.code(403).send({ error: "read-only" });
    await ds.pauseQueue((req.params as { name: string }).name);
    return reply.code(204).send();
  });

  app.post(`${base}/api/queues/:name/resume`, async (req, reply) => {
    if (readOnly) return reply.code(403).send({ error: "read-only" });
    await ds.resumeQueue((req.params as { name: string }).name);
    return reply.code(204).send();
  });
}
