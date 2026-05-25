import type { FastifyInstance } from "fastify";
import type { TaskStatus } from "@vorq/core";
import type { ServerOptions } from "../server.js";

export function registerTaskRoutes(app: FastifyInstance, opts: ServerOptions, base = "") {
  const ds = opts.dataSource;

  app.get(`${base}/api/queues/:name/tasks`, async (req) => {
    const { name } = req.params as { name: string };
    const q = req.query as {
      status?: string;
      limit?: string;
      cursor?: string;
      search?: string;
    };
    return await ds.listTasks({
      queue: name,
      status: q.status ? (q.status.split(",") as TaskStatus[]) : undefined,
      limit: q.limit ? Number(q.limit) : 50,
      cursor: q.cursor,
      search: q.search,
    });
  });

  app.get(`${base}/api/queues/:name/tasks/:taskId`, async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const t = await ds.getTask(taskId);
    if (!t) return reply.code(404).send({ error: "task not found" });
    return t;
  });
}
