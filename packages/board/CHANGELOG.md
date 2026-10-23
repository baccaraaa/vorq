# @vorq/board changelog

## 0.1.1

- Security: upgrade `@fastify/static` from 8.x to 10.1.7 to fix path traversal and route-guard bypass advisories (GHSA-83w8-p2f5-377r, GHSA-8pvw-jcv7-9cmj, GHSA-pr96-94w5-mx2h, GHSA-x428-ghpx-8j92).
- Security: require `fastify` ^5.12.5 so existing installs pick up its schema-validation and routing fixes; rebuild the UI with `react-router` 7.18.
- Requires Node.js 22+ (the patched `@fastify/static` depends on packages that no longer support Node 20, which is end-of-life).
- Add repository, homepage, bugs and keywords to package metadata.

## 0.1.0

Initial release.

- Queue, task, DLQ, worker, and schedule REST endpoints (`GET /api/queues`, etc.).
- Server-Sent Events stream at `/api/events`.
- React/Tailwind UI with Queues overview, Queue detail (Tasks/DLQ/Workers tabs), and Schedules pages. Dark mode by default.
- Express adapter via `@vorq/board/express`.
- Standalone CLI (`npx @vorq/board`) — limited in v0.1; reaches parity in v0.2.
- Read-only mode (`readOnly: true`) disables all mutating endpoints.
- Configurable mount path via `basePath`.
