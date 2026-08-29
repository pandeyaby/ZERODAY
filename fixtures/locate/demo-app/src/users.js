/**
 * Intentionally unsafe query builder for localization demos (CWE-89).
 * ZERODAY / Antares should rank this file — this is not an exploit or PoC.
 */

export function findUserByName(db: { query: (sql: string) => unknown }, name: string) {
  // CWE-89: string concatenation into SQL (localization target)
  const sql = "SELECT id, name, email FROM users WHERE name = '" + name + "'";
  return db.query(sql);
}

export function listUsersSafe(db: { query: (sql: string, params: string[]) => unknown }) {
  return db.query("SELECT id, name, email FROM users", []);
}
