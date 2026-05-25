import type { Vorq } from "@vorq/core";
import type { FastifyInstance } from "fastify";
import { EmbeddedDataSource } from "./server/data/embedded.js";
import { createServer } from "./server/server.js";

export interface CreateBoardOptions {
  vorq: Vorq;
  readOnly?: boolean;
  basePath?: string;
}

export interface VorqBoard {
  server: FastifyInstance;
}

export function createVorqBoard(opts: CreateBoardOptions): VorqBoard {
  const dataSource = new EmbeddedDataSource(opts.vorq);
  const server = createServer({
    dataSource,
    readOnly: opts.readOnly,
    basePath: opts.basePath,
  });
  return { server };
}
