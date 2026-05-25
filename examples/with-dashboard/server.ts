import { createVorqBoard } from "@vorq/board";
import { expressAdapter } from "@vorq/board/express";
import { InMemoryTransport, Vorq } from "@vorq/core";
import express from "express";

const vorq = new Vorq({ transport: new InMemoryTransport() });

await vorq.createQueue("emails");
await vorq.createQueue("reports");

vorq.registerWorker("emails", async (ctx) => {
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 500));
  if (Math.random() < 0.1) throw new Error("simulated transient failure");
  return { sent: true, to: (ctx.payload as { to: string }).to };
});

vorq.registerWorker("reports", async () => {
  await new Promise((r) => setTimeout(r, 1000));
  return { generated: true };
});

await vorq.start();

// Producer: enqueue traffic continuously so the dashboard always has data.
setInterval(() => {
  void vorq.enqueue("emails", {
    name: "welcome",
    payload: { to: `user${Math.floor(Math.random() * 1000)}@example.com` },
  });
}, 800);

setInterval(() => {
  void vorq.enqueue("reports", {
    name: "daily",
    payload: { day: new Date().toISOString().slice(0, 10) },
  });
}, 4000);

const board = createVorqBoard({ vorq });
await board.server.ready();

const app = express();
app.use(expressAdapter(board));

app.listen(3001, () => {
  console.log("Dashboard at http://localhost:3001");
});
