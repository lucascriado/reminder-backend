import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import clientsRouter      from "./routes/clients";
import appointmentsRouter from "./routes/appointments";
import devicesRouter      from "./routes/devices";
import statsRouter        from "./routes/stats";
import n8nRouter          from "./routes/n8n";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3002;

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/clients",      clientsRouter);
app.use("/api/appointments",  appointmentsRouter);
app.use("/api/devices",       devicesRouter);
app.use("/api/stats",         statsRouter);
app.use("/api/n8n",           n8nRouter);

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
