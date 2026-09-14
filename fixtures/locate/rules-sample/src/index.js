import { searchOrders } from "./search.js";

export function handleSearch(req, db) {
  return searchOrders(db, req.query.customerId ?? "");
}
