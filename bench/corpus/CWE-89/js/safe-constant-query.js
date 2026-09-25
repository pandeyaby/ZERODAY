const db = require("./db");
const TABLE = "audit_log";
async function recent() {
  return db.query("SELECT * FROM " + TABLE + " ORDER BY created_at DESC LIMIT 50");
}
module.exports = { recent };
