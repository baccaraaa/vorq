import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App.js";

const base =
  (document.getElementById("vorq-board-base") as HTMLBaseElement | null)?.getAttribute("href") ??
  "/";
declare global {
  interface Window {
    __VORQ_BOARD_BASE__?: string;
  }
}
window.__VORQ_BOARD_BASE__ = base;

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
