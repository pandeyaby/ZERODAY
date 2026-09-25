module.exports = (app) => {
  app.get("/weather", async (req, res) => {
    const city = encodeURIComponent(req.query.city);
    const r = await fetch("https://api.weather.example/v1?city=" + city);
    res.json(await r.json());
  });
};
