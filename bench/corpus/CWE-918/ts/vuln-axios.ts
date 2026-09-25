import axios from "axios";
import { Request, Response } from "express";
export async function proxy(req: Request, res: Response) {
  const target = req.body.target as string;
  const r = await axios.get(target);
  res.json(r.data);
}
