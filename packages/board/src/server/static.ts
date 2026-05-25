import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In built form, UI assets live at ../ui relative to dist/server bundle.
// In test environment (running from src/), look up two levels.
const candidateDirs = [
  path.resolve(__dirname, "../ui"),
  path.resolve(__dirname, "../../dist/ui"),
];

function resolveUiDir(): string | null {
  for (const dir of candidateDirs) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

export async function registerStatic(app: FastifyInstance, base = ""): Promise<void> {
  const uiDir = resolveUiDir();
  if (!uiDir) {
    // Skip silently in environments without a UI build (e.g. server-only tests).
    return;
  }

  await app.register(fastifyStatic, {
    root: uiDir,
    prefix: `${base}/`,
    decorateReply: false,
    index: false,
  });

  const indexHtml = fs.readFileSync(path.join(uiDir, "index.html"), "utf8");
  const rewritten = indexHtml.replace(/href="\/"/,  `href="${base}/"`);

  app.get(`${base}/`, async (_req, reply) => reply.type("text/html").send(rewritten));
  app.setNotFoundHandler((_req, reply) => reply.type("text/html").send(rewritten));
}
