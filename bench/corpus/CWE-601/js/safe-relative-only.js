module.exports = (app) => {
  app.get("/login/done", (req, res) => {
    const next = req.query.next;
    if (!next.startsWith("/") || next.startsWith("//")) {
      return res.redirect("/");
    }
    res.redirect(next);
  });
};
