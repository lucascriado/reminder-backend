import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// Garante que a tabela existe
pool.query(`
  CREATE TABLE IF NOT EXISTS devices (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(50),
    identifier VARCHAR(200),
    last_seen  TIMESTAMP,
    active     BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(console.error);

// GET /api/devices
router.get("/", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM devices ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dispositivos" });
  }
});

// GET /api/devices/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query("SELECT * FROM devices WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Dispositivo não encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dispositivo" });
  }
});

// POST /api/devices
router.post("/", async (req: Request, res: Response) => {
  const { name, type, identifier } = req.body as {
    name?: string;
    type?: string;
    identifier?: string;
  };

  if (!name?.trim()) return res.status(400).json({ error: "Nome é obrigatório" });

  try {
    const { rows } = await pool.query(`
      INSERT INTO devices (name, type, identifier, last_seen)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `, [name.trim(), type?.trim() || null, identifier?.trim() || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar dispositivo" });
  }
});

// PUT /api/devices/:id
router.put("/:id", async (req: Request, res: Response) => {
  const { name, type, identifier, active } = req.body as {
    name?: string;
    type?: string;
    identifier?: string;
    active?: boolean;
  };

  if (!name?.trim()) return res.status(400).json({ error: "Nome é obrigatório" });

  try {
    const { rows } = await pool.query(`
      UPDATE devices
      SET name=$1, type=$2, identifier=$3, active=$4, last_seen=NOW()
      WHERE id=$5
      RETURNING *
    `, [name.trim(), type?.trim() || null, identifier?.trim() || null, active ?? true, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Dispositivo não encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar dispositivo" });
  }
});

// DELETE /api/devices/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM devices WHERE id=$1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Dispositivo não encontrado" });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar dispositivo" });
  }
});

export default router;
