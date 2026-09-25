const escapeHtml = require("escape-html");
module.exports = (app) => {
  app.get("/hello", (req, res) => {
    res.send("<p>Hello " + escapeHtml(req.query.name) + "</p>");
  });
};
