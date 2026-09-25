const { Pool } = require("pg");
module.exports = new Pool({ host: "db.internal", user: "app", password: "Pr0d-Passw0rd!" });
