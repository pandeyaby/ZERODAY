const { execFile } = require("child_process");
module.exports = (app) => {
  app.post("/ping", (req, res) => {
    execFile("ping", ["-c", "1", req.body.host], (err, out) => res.send(out));
  });
};
