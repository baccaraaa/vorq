import Fastify, { type FastifyInstance } from "fastify";
import type { BoardDataSource } from "./data/types.js";
import { registerQueueRoutes } from "./routes/queues.js";

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

  return app;
}
