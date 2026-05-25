import Fastify, { type FastifyInstance } from "fastify";
import type { BoardDataSource } from "./data/types.js";
import { registerDlqRoutes } from "./routes/dlq.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerQueueRoutes } from "./routes/queues.js";
import { registerScheduleRoutes } from "./routes/schedules.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerWorkerRoutes } from "./routes/workers.js";

export interface ServerOptions {
  dataSource: BoardDataSource;
  readOnly?: boolean;
  basePath?: string;
}

export function createServer(opts: ServerOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  const base = opts.basePath ?? "";

  app.get(`${base}/healthz`, async () => ({ ok: true }));
  registerQueueRoutes(app, opts, base);
  registerTaskRoutes(app, opts, base);
  registerDlqRoutes(app, opts, base);
  registerWorkerRoutes(app, opts, base);
  registerScheduleRoutes(app, opts, base);
  registerEventRoutes(app, opts, base);

  return app;
}
