import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// Garante que a tabela de sessões existe
pool.query(`
  CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id         SERIAL PRIMARY KEY,
    phone      VARCHAR(20) UNIQUE NOT NULL,
    step       VARCHAR(50) NOT NULL DEFAULT 'waiting_name',
    data       JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(console.error);

// GET /api/n8n/session/:phone
// Retorna { step, data } ou { step: 'none', data: {} } se não existir
router.get("/session/:phone", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT step, data FROM whatsapp_sessions WHERE phone = $1",
      [req.params.phone]
    );
    if (!rows[0]) return res.json({ step: "none", data: {} });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar sessão" });
  }
});

// POST /api/n8n/session
// Cria ou atualiza sessão (upsert por phone)
router.post("/session", async (req: Request, res: Response) => {
  const { phone, step, data } = req.body as {
    phone?: string;
    step?: string;
    data?: Record<string, unknown>;
  };
  if (!phone || !step) return res.status(400).json({ error: "phone e step são obrigatórios" });

  try {
    const { rows } = await pool.query(`
      INSERT INTO whatsapp_sessions (phone, step, data, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (phone) DO UPDATE
        SET step = EXCLUDED.step,
            data = EXCLUDED.data,
            updated_at = NOW()
      RETURNING *
    `, [phone, step, JSON.stringify(data ?? {})]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar sessão" });
  }
});

// DELETE /api/n8n/session/:phone
router.delete("/session/:phone", async (req: Request, res: Response) => {
  try {
    await pool.query("DELETE FROM whatsapp_sessions WHERE phone = $1", [req.params.phone]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar sessão" });
  }
});

// GET /api/n8n/available-slots?date=YYYY-MM-DD
// Retorna lista de horários livres para um dia (09:00-17:00, de hora em hora)
router.get("/available-slots", async (req: Request, res: Response) => {
  const { date } = req.query as { date?: string };
  if (!date) return res.status(400).json({ error: "date é obrigatório (YYYY-MM-DD)" });

  const allSlots: string[] = [];
  for (let h = 9; h <= 17; h++) {
    allSlots.push(String(h).padStart(2, "0") + ":00");
  }

  try {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS time
      FROM appointments
      WHERE status != 'cancelled'
        AND DATE(scheduled_at AT TIME ZONE 'America/Sao_Paulo') = $1::date
    `, [date]);

    const booked = new Set(rows.map((r: { time: string }) => r.time));
    const slots = allSlots.filter(s => !booked.has(s));

    res.json({ date, slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar horários disponíveis" });
  }
});

// GET /api/n8n/slots?datetime=ISO_STRING
// Retorna { available: boolean, datetime } — slot livre = nenhum agendamento ativo em ±30min
router.get("/slots", async (req: Request, res: Response) => {
  const { datetime } = req.query as { datetime?: string };
  if (!datetime) return res.status(400).json({ error: "datetime é obrigatório" });

  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM appointments
      WHERE status != 'cancelled'
        AND scheduled_at BETWEEN $1::timestamptz - INTERVAL '29 minutes'
                              AND $1::timestamptz + INTERVAL '29 minutes'
    `, [datetime]);
    res.json({ available: rows[0].count === 0, datetime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao verificar disponibilidade" });
  }
});

// POST /api/n8n/book
// Cria agendamento vindo do WhatsApp (encontra ou cria cliente pelo phone)
router.post("/book", async (req: Request, res: Response) => {
  const { phone, name, service, scheduled_at } = req.body as {
    phone?: string;
    name?: string;
    service?: string;
    scheduled_at?: string;
  };

  if (!phone || !name || !service || !scheduled_at) {
    return res.status(400).json({ error: "phone, name, service e scheduled_at são obrigatórios" });
  }

  try {
    // Encontra ou cria cliente pelo telefone
    let clientId: number | null = null;
    const existing = await pool.query(
      "SELECT id FROM clients WHERE phone = $1 LIMIT 1",
      [phone]
    );
    if (existing.rows[0]) {
      clientId = existing.rows[0].id;
      // Atualiza nome se mudou
      await pool.query("UPDATE clients SET name = $1 WHERE id = $2", [name, clientId]);
    } else {
      const created = await pool.query(
        "INSERT INTO clients (name, phone) VALUES ($1, $2) RETURNING id",
        [name, phone]
      );
      clientId = created.rows[0].id;
    }

    // Cria o agendamento
    const { rows } = await pool.query(`
      INSERT INTO appointments (title, scheduled_at, client_id, phone, service, source, status)
      VALUES ($1, $2, $3, $4, $5, 'whatsapp', 'pending')
      RETURNING *
    `, [service, scheduled_at, clientId, phone, service]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
});

export default router;
