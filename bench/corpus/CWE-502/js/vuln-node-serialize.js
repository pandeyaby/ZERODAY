const serialize = require("node-serialize");
module.exports = (app) => {
  app.get("/profile", (req, res) => {
    const obj = serialize.unserialize(Buffer.from(req.cookies.profile, "base64").toString());
    res.json(obj);
  });
};
