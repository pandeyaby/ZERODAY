const path = require("path");
const fs = require("fs");
const config = require("../config/app.json");
const indexHtml = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
module.exports = { indexHtml, config };
