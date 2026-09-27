const _ = require("lodash");

function renderWelcome(user, tpl) {
  const compiled = _.template(tpl);
  return compiled({ name: user.name });
}

module.exports = { renderWelcome };
