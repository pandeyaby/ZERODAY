import { spawn } from "child_process";
import { Request, Response } from "express";
export function convert(req: Request, res: Response) {
  const p = spawn(`convert ${req.query.src} out.png`, { shell: true });
  p.on("close", () => res.sendStatus(200));
}
