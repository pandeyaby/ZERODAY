function compileRule(body) {
  return new Function("ctx", "return " + body);
}
module.exports = { compileRule };
