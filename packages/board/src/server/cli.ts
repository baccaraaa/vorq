#!/usr/bin/env node
import { Command } from "commander";
import { StandaloneDataSource } from "./data/standalone.js";
import { createServer } from "./server.js";

const program = new Command();

program
  .name("vorq-board")
  .description("Standalone server for the Vorq dashboard")
  .option("-p, --port <number>", "Port to listen on", "3001")
  .option("--host <string>", "Bind host", "127.0.0.1")
  .option("--transport <url>", "Transport URL (e.g. redis://...)", "memory://")
  .option("--storage <url>", "Optional Postgres URL for historical tasks")
  .option(
    "--queues <list>",
    "Comma-separated known queue names",
    (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean),
  )
  .option("--read-only", "Disable mutations")
  .action(async (opts: {
    port: string;
    host: string;
    transport: string;
    storage?: string;
    queues?: string[];
    readOnly?: boolean;
  }) => {
    const ds = new StandaloneDataSource({
      transportUrl: opts.transport,
      storageUrl: opts.storage,
      knownQueues: opts.queues,
    });
    await ds.connect();
    const server = createServer({ dataSource: ds, readOnly: !!opts.readOnly });
    await server.listen({ port: Number(opts.port), host: opts.host });
    // biome-ignore lint/suspicious/noConsole: CLI startup banner
    console.log(`vorq-board listening on http://${opts.host}:${opts.port}`);
  });

program.parse();
