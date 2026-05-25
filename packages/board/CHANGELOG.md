# @vorq/board changelog

## 0.1.0

Initial release.

- Queue, task, DLQ, worker, and schedule REST endpoints (`GET /api/queues`, etc.).
- Server-Sent Events stream at `/api/events`.
- React/Tailwind UI with Queues overview, Queue detail (Tasks/DLQ/Workers tabs), and Schedules pages. Dark mode by default.
- Express adapter via `@vorq/board/express`.
- Standalone CLI (`npx @vorq/board`) — limited in v0.1; reaches parity in v0.2.
- Read-only mode (`readOnly: true`) disables all mutating endpoints.
- Configurable mount path via `basePath`.
