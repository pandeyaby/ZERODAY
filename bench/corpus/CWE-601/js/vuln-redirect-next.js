module.exports = (app) => {
  app.get("/login/done", (req, res) => {
    res.redirect(req.query.next);
  });
};
