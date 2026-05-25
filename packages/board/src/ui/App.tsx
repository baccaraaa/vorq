import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { QueueDetailPage } from "./pages/QueueDetailPage.js";
import { QueuesPage } from "./pages/QueuesPage.js";
import { SchedulesPage } from "./pages/SchedulesPage.js";

export function App() {
  return (
    <BrowserRouter basename={window.__VORQ_BOARD_BASE__}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<QueuesPage />} />
          <Route path="/queues/:name" element={<QueueDetailPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
