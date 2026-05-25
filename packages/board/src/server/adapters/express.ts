// packages/board/src/server/adapters/express.ts
import type { RequestHandler } from "express";
import type { VorqBoard } from "../../board.js";

/**
 * Express-compatible middleware that delegates all matched requests to the
 * board's underlying Fastify instance. Mount with `app.use(expressAdapter(board))`.
 * The board's `basePath` (set via `createVorqBoard({ basePath })`) determines
 * the route prefix; Express does not need its own `app.use("/prefix", ...)`.
 */
export function expressAdapter(board: VorqBoard): RequestHandler {
  return (req, res, next) => {
    // board.server.routing is Fastify's internal HTTP handler (preRouting(req, res)).
    // Call it directly — do NOT invoke it with () first, as that would pass
    // undefined as req/res. Fastify handles the full response cycle itself.
    board.server.routing(req, res);
    // Fastify writes the response itself; next() is never called because Fastify
    // matches/handles the request fully. If Fastify can't match, it sends 404.
    void next;
  };
}
