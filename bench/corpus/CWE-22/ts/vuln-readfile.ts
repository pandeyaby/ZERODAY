import fs from "fs";
import { Request, Response } from "express";
export function readDoc(req: Request, res: Response) {
  const name = req.params.name;
  const body = fs.readFileSync("/srv/docs/" + name, "utf8");
  res.type("text/plain").send(body);
}
