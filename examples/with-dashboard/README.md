# Vorq with Dashboard — demo

Spins up a Vorq instance with two queues, fake producer/worker traffic, and the dashboard mounted at `/`.

## Quickstart

```bash
docker compose up
```

Open <http://localhost:3001> to see queues populating live.

## Without Docker

From the repo root:

```bash
npm install
npm start --prefix examples/with-dashboard
```

Then open <http://localhost:3001>.

## What's inside

- Two queues (`emails`, `reports`) with simulated workers.
- A producer enqueueing ~1.25 jobs/sec to `emails` and 0.25 jobs/sec to `reports`.
- Random 10% failure rate on `emails` so the DLQ has content.
- `@vorq/board` mounted at `/` via the Express adapter.
