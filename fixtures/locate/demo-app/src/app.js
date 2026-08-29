/**
 * Thin HTTP-ish handler — wires the unsafe helper (localization surface).
 */

import { findUserByName } from "./users.js";

export function handleGetUser(req, db) {
  const name = req.query.name ?? "";
  return findUserByName(db, name);
}
