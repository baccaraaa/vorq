import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const SSE_EVENTS = [
  "task.enqueued",
  "task.active",
  "task.completed",
  "task.failed",
  "task.retrying",
  "task.deadLettered",
  "task.progress",
  "queue.metrics",
];

export function useSse() {
  const qc = useQueryClient();
  useEffect(() => {
    const base = window.__VORQ_BOARD_BASE__?.replace(/\/$/, "") ?? "";
    const es = new EventSource(`${base}/api/events`);
    const onAny = () => {
      void qc.invalidateQueries();
    };
    for (const e of SSE_EVENTS) es.addEventListener(e, onAny);
    return () => es.close();
  }, [qc]);
}
