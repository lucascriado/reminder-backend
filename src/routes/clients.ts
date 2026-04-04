import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// GET /api/clients
router.get("/", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, phone, address, created_at FROM clients ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar clientes" });
  }
});

// GET /api/clients/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, phone, address, created_at FROM clients WHERE id = $1",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar cliente" });
  }
});

// POST /api/clients
router.post("/", async (req: Request, res: Response) => {
  const { name, email, phone, address } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };

  if (!name?.trim()) {
    return res.status(400).json({ error: "Nome é obrigatório" });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO clients (name, email, phone, address) VALUES ($1, $2, $3, $4) RETURNING *",
      [name.trim(), email?.trim() || null, phone?.trim() || null, address?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar cliente" });
  }
});

// PUT /api/clients/:id
router.put("/:id", async (req: Request, res: Response) => {
  const { name, email, phone, address } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };

  if (!name?.trim()) {
    return res.status(400).json({ error: "Nome é obrigatório" });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE clients
         SET name = $1, email = $2, phone = $3, address = $4
       WHERE id = $5
       RETURNING *`,
      [name.trim(), email?.trim() || null, phone?.trim() || null, address?.trim() || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar cliente" });
  }
});

// DELETE /api/clients/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM clients WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Cliente não encontrado" });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar cliente" });
  }
});

export default router;
