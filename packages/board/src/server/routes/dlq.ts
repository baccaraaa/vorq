import type { FastifyInstance } from "fastify";
import type { ServerOptions } from "../server.js";

export function registerDlqRoutes(app: FastifyInstance, opts: ServerOptions, base = "") {
  const ds = opts.dataSource;
  const ro = opts.readOnly ?? false;

  app.get(`${base}/api/queues/:name/dlq`, async (req) => {
    const { name } = req.params as { name: string };
    return await ds.listDlq(name);
  });

  app.post(`${base}/api/queues/:name/dlq/:taskId/retry`, async (req, reply) => {
    if (ro) return reply.code(403).send({ error: "read-only" });
    const { taskId } = req.params as { taskId: string };
    await ds.retryFromDlq(taskId);
    return reply.code(204).send();
  });

  app.post(`${base}/api/queues/:name/dlq/retry-all`, async (req, reply) => {
    if (ro) return reply.code(403).send({ error: "read-only" });
    const { name } = req.params as { name: string };
    return { retried: await ds.retryAllFromDlq(name) };
  });

  app.delete(`${base}/api/queues/:name/dlq`, async (req, reply) => {
    if (ro) return reply.code(403).send({ error: "read-only" });
    const { name } = req.params as { name: string };
    return { purged: await ds.purgeDlq(name) };
  });
}
