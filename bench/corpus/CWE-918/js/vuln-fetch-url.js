module.exports = (app) => {
  app.get("/preview", async (req, res) => {
    const r = await fetch(req.query.url);
    res.send(await r.text());
  });
};
