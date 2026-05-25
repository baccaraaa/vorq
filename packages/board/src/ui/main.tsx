import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const base =
  (document.getElementById("vorq-board-base") as HTMLBaseElement | null)?.getAttribute("href") ??
  "/";
declare global {
  interface Window {
    __VORQ_BOARD_BASE__?: string;
  }
}
window.__VORQ_BOARD_BASE__ = base;

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 1000 } } });

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
