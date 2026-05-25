import type { FastifyInstance } from "fastify";
import type { ServerOptions } from "../server.js";

export function registerScheduleRoutes(app: FastifyInstance, opts: ServerOptions, base = "") {
  app.get(`${base}/api/schedules`, async () => await opts.dataSource.listSchedules());
}
