module.exports = (app) => {
  app.get("/calc", (req, res) => {
    res.json({ result: eval(req.query.expr) });
  });
};
