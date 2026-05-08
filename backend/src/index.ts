import "dotenv/config";
import cors from "cors";
import express from "express";
import { requireAuth } from "./middleware/auth.js";
import { clientsRouter } from "./routes/clients.js";
import calendarRouter from "./routes/calendar.js";
import { reportsRouter } from "./routes/reports.js";
import "./scheduler/reminder.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/clients", requireAuth, clientsRouter);
app.use("/api/calendar", requireAuth, calendarRouter);
app.use("/api/reports", requireAuth, reportsRouter);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${port}`);
});
