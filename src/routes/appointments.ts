import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// Garante que a tabela existe
pool.query(`
  CREATE TABLE IF NOT EXISTS appointments (
    id           SERIAL PRIMARY KEY,
    client_id    INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    title        VARCHAR(200) NOT NULL,
    description  TEXT,
    scheduled_at TIMESTAMP NOT NULL,
    status       VARCHAR(20) DEFAULT 'pending'
                 CHECK (status IN ('pending','completed','cancelled')),
    value        NUMERIC(10,2),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => Promise.all([
  pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS phone   VARCHAR(20)`),
  pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service VARCHAR(100)`),
  pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source  VARCHAR(20) DEFAULT 'manual'`),
])).catch(console.error);

// GET /api/appointments
router.get("/", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.title, a.description, a.scheduled_at, a.status, a.value,
             a.phone, a.service, a.source, a.created_at,
             c.id AS client_id, c.name AS client_name
      FROM appointments a
      LEFT JOIN clients c ON c.id = a.client_id
      ORDER BY a.scheduled_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar agendamentos" });
  }
});

// GET /api/appointments/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, c.name AS client_name
      FROM appointments a
      LEFT JOIN clients c ON c.id = a.client_id
      WHERE a.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Agendamento não encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar agendamento" });
  }
});

// POST /api/appointments
router.post("/", async (req: Request, res: Response) => {
  const { title, description, scheduled_at, client_id, status, value, phone, service, source } = req.body as {
    title?: string;
    description?: string;
    scheduled_at?: string;
    client_id?: number | null;
    status?: string;
    value?: number | null;
    phone?: string;
    service?: string;
    source?: string;
  };

  if (!title?.trim()) return res.status(400).json({ error: "Título é obrigatório" });
  if (!scheduled_at)  return res.status(400).json({ error: "Data/hora é obrigatória" });

  try {
    const { rows } = await pool.query(`
      INSERT INTO appointments (title, description, scheduled_at, client_id, status, value, phone, service, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      title.trim(),
      description?.trim() || null,
      scheduled_at,
      client_id || null,
      status || "pending",
      value ?? null,
      phone?.trim() || null,
      service?.trim() || null,
      source || "manual",
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
});

// PUT /api/appointments/:id
router.put("/:id", async (req: Request, res: Response) => {
  const { title, description, scheduled_at, client_id, status, value, phone, service, source } = req.body as {
    title?: string;
    description?: string;
    scheduled_at?: string;
    client_id?: number | null;
    status?: string;
    value?: number | null;
    phone?: string;
    service?: string;
    source?: string;
  };

  if (!title?.trim()) return res.status(400).json({ error: "Título é obrigatório" });
  if (!scheduled_at)  return res.status(400).json({ error: "Data/hora é obrigatória" });

  try {
    const { rows } = await pool.query(`
      UPDATE appointments
      SET title=$1, description=$2, scheduled_at=$3, client_id=$4, status=$5, value=$6,
          phone=$7, service=$8, source=$9
      WHERE id=$10
      RETURNING *
    `, [
      title.trim(),
      description?.trim() || null,
      scheduled_at,
      client_id || null,
      status || "pending",
      value ?? null,
      phone?.trim() || null,
      service?.trim() || null,
      source || "manual",
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Agendamento não encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar agendamento" });
  }
});

// DELETE /api/appointments/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM appointments WHERE id=$1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Agendamento não encontrado" });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar agendamento" });
  }
});

export default router;
