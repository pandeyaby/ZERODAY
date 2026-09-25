import { Request, Response } from "express";
import { db } from "./db";
export async function getOrder(req: Request, res: Response) {
  const id = Number(req.params.id);
  const rows = await db.query("SELECT * FROM orders WHERE id = " + id);
  res.json(rows);
}
