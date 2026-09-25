import { Router } from "express";
import { knex } from "./knex";
export const router = Router();
router.get("/search", async (req, res) => {
  const term = String(req.query.q);
  const rows = await knex.raw("SELECT * FROM products WHERE title LIKE '%" + term + "%'");
  res.json(rows);
});
