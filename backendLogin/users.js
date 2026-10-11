// Engineer accounts, stored in users.json with hashed passwords (never plain text).
// Add or update an account: npm run add-user -- <username> <password>

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "users.json");
const KEY_LENGTH = 64;

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key.toString("hex"))));
  });
}

async function verifyPassword(password, user) {
  const hash = Buffer.from(await hashPassword(password, user.salt), "hex");
  const expected = Buffer.from(user.hash, "hex");
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}

async function addUser(username, password) {
  const users = loadUsers().filter((u) => u.username !== username);
  const salt = crypto.randomBytes(16).toString("hex");
  users.push({ username, salt, hash: await hashPassword(password, salt) });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2) + "\n");
}

// run directly: node users.js <username> <password>
if (require.main === module) {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.log("Usage: npm run add-user -- <username> <password>");
    process.exit(1);
  }
  addUser(username, password).then(() => console.log(`Saved user "${username}".`));
}

module.exports = { loadUsers, verifyPassword };
