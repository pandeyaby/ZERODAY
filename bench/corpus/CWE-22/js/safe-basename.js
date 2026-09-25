const path = require("path");
module.exports = (app) => {
  app.get("/download", (req, res) => {
    const file = path.basename(req.query.file);
    res.sendFile(path.join(__dirname, "uploads", file));
  });
};
