import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// GET /api/stats/dashboard
router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const [clients, apptMonth, apptCompleted, revenue, recentCompleted] = await Promise.all([
      // Total de clientes
      pool.query("SELECT COUNT(*)::int AS total FROM clients"),

      // Agendamentos criados neste mês
      pool.query(`
        SELECT COUNT(*)::int AS total FROM appointments
        WHERE DATE_TRUNC('month', scheduled_at) = DATE_TRUNC('month', NOW())
      `),

      // Agendamentos concluídos neste mês
      pool.query(`
        SELECT COUNT(*)::int AS total FROM appointments
        WHERE status = 'completed'
          AND DATE_TRUNC('month', scheduled_at) = DATE_TRUNC('month', NOW())
      `),

      // Faturamento do mês (soma dos valores concluídos)
      pool.query(`
        SELECT COALESCE(SUM(value), 0)::numeric AS total FROM appointments
        WHERE status = 'completed'
          AND DATE_TRUNC('month', scheduled_at) = DATE_TRUNC('month', NOW())
      `),

      // Últimos 10 agendamentos concluídos com valor
      pool.query(`
        SELECT a.id, a.title, a.scheduled_at, a.value,
               c.name AS client_name
        FROM appointments a
        LEFT JOIN clients c ON c.id = a.client_id
        WHERE a.status = 'completed'
        ORDER BY a.scheduled_at DESC
        LIMIT 10
      `),
    ]);

    res.json({
      totalClients:          clients.rows[0].total,
      appointmentsThisMonth: apptMonth.rows[0].total,
      completedThisMonth:    apptCompleted.rows[0].total,
      revenueThisMonth:      Number(revenue.rows[0].total),
      recentCompleted:       recentCompleted.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar stats" });
  }
});

export default router;
