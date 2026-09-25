const { exec } = require("child_process");
module.exports = (app) => {
  app.post("/ping", (req, res) => {
    exec("ping -c 1 " + req.body.host, (err, out) => res.send(out));
  });
};
