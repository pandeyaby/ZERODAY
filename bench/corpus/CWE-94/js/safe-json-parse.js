module.exports = (app) => {
  app.post("/calc", (req, res) => {
    const input = JSON.parse(req.body.payload);
    res.json({ sum: input.a + input.b });
  });
};
