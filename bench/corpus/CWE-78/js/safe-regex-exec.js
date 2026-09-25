module.exports = (app) => {
  app.get("/v", (req, res) => {
    const m = /^v(\d+)$/.exec(req.query.version);
    res.json({ major: m ? Number(m[1]) : null });
  });
};
