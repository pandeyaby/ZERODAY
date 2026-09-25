const libxmljs = require("libxmljs");
module.exports = (app) => {
  app.post("/import", (req, res) => {
    const doc = libxmljs.parseXml(req.body.xml, { noent: true });
    res.json({ root: doc.root().name() });
  });
};
