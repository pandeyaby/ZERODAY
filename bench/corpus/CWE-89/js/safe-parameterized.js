const db = require("./db");
module.exports = (app) => {
  app.get("/users/:id", async (req, res) => {
    const rows = await db.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
    res.json(rows);
  });
};
