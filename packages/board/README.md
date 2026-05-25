# @vorq/board

Web dashboard for [Vorq](https://github.com/baccaraaa/vorq) — the distributed task queue for TypeScript.

Live queues, tasks, DLQ, and schedules in a single screen, with Server-Sent Events for live updates.

## Install

```bash
npm install @vorq/board
```

## Embedded mode (most common)

Mount the dashboard inside your existing Express app:

```typescript
import express from "express";
import { createVorqBoard } from "@vorq/board";
import { expressAdapter } from "@vorq/board/express";

const board = createVorqBoard({ vorq, basePath: "/admin/queues" });
const app = express();
app.use(expressAdapter(board));
app.listen(3000);
```

Open <http://localhost:3000/admin/queues>.

### Options

- `vorq` — the running `Vorq` instance to inspect
- `basePath` — URL prefix; defaults to `""` (root)
- `readOnly` — disable all mutating endpoints (pause, retry, purge); returns `403` on writes

## Standalone mode (v0.1 — limited)

For DevOps workflows where the dashboard lives in a separate process:

```bash
npx @vorq/board --port 3001 --queues emails,reports
```

> **Note:** Standalone v0.1 only exposes queue listings configured via `--queues`. Live metrics, task history, and DLQ inspection require embedded mode or PostgreSQL storage. v0.2 will reach full parity.

## What you get

- **Queues overview** — live counters: pending, active, completed, failed, delayed, throughput/hour
- **Queue detail** — task table with filters, click into a task for payload/result/error
- **DLQ** — retry individual tasks, retry all, purge
- **Workers** — pause/resume per worker
- **Schedules** — cron expressions with next-run timestamps
- **Live updates** — SSE pushes events as they happen

## Security

The dashboard has no built-in authentication. Place it behind your reverse-proxy / auth gateway. For read-only viewing, set `readOnly: true`.

## License

MIT
