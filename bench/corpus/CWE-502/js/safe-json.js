module.exports = (app) => {
  app.get("/profile", (req, res) => {
    const obj = JSON.parse(Buffer.from(req.cookies.profile, "base64").toString());
    res.json(obj);
  });
};
