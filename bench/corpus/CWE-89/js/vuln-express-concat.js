const express = require("express");
const db = require("./db");
const app = express();
app.get("/users", async (req, res) => {
  const sort = req.query.sort || "name";
  const rows = await db.query("SELECT id, name FROM users ORDER BY " + sort);
  res.json(rows);
});
