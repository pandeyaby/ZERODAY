const pool = require("./pool");
async function findByEmail(email) {
  return pool.query(`SELECT * FROM accounts WHERE email = '${email}'`);
}
module.exports = { findByEmail };
