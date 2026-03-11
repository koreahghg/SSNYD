const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'casino.db'));

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id               TEXT PRIMARY KEY,
        username         TEXT NOT NULL,
        balance          INTEGER NOT NULL DEFAULT 150000,
        last_attendance  TEXT,
        last_work        TEXT,
        last_support     TEXT
    )
`);

function getUser(id, username) {
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
        db.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(id, username);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
    return user;
}

function updateBalance(id, delta) {
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(delta, id);
}

function setField(id, field, value) {
    const allowed = ['last_attendance', 'last_work', 'last_support', 'username'];
    if (!allowed.includes(field)) throw new Error('Invalid field: ' + field);
    db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(value, id);
}

function getTopUsers(limit = 10) {
    return db.prepare('SELECT * FROM users ORDER BY balance DESC LIMIT ?').all(limit);
}

module.exports = { getUser, updateBalance, setField, getTopUsers };
