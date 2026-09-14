/**
 * Intentionally unsafe query builder for rules-locate demos (CWE-89).
 * Localization target only — not an exploit or PoC.
 */

export function searchOrders(db, customerId) {
  // CWE-89: string concatenation into SQL (rules heuristic target)
  const sql =
    "SELECT id, total FROM orders WHERE customer_id = '" + customerId + "'";
  return db.query(sql);
}

export function searchOrdersSafe(db, customerId) {
  return db.query("SELECT id, total FROM orders WHERE customer_id = ?", [
    customerId,
  ]);
}
