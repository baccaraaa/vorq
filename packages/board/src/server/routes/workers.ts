import type { FastifyInstance } from "fastify";
import type { ServerOptions } from "../server.js";

export function registerWorkerRoutes(app: FastifyInstance, opts: ServerOptions, base = "") {
  const ds = opts.dataSource;
  const ro = opts.readOnly ?? false;

  app.get(`${base}/api/queues/:name/workers`, async (req) => {
    return await ds.listWorkers((req.params as { name: string }).name);
  });

  app.post(`${base}/api/queues/:name/workers/:workerId/pause`, async (req, reply) => {
    if (ro) return reply.code(403).send({ error: "read-only" });
    const { name, workerId } = req.params as { name: string; workerId: string };
    await ds.pauseWorker(name, decodeURIComponent(workerId));
    return reply.code(204).send();
  });

  app.post(`${base}/api/queues/:name/workers/:workerId/resume`, async (req, reply) => {
    if (ro) return reply.code(403).send({ error: "read-only" });
    const { name, workerId } = req.params as { name: string; workerId: string };
    await ds.resumeWorker(name, decodeURIComponent(workerId));
    return reply.code(204).send();
  });
}
