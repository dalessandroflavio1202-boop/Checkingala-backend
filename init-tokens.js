// init-tokens.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Crea tabella token se non esiste
  db.run(`
    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      guest_id TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(guest_id) REFERENCES guests(id)
    )
  `);

  // Leggi tutti gli ospiti
  db.all(`SELECT id FROM guests`, [], (err, rows) => {
    if (err) {
      console.error('Errore nel leggere guests:', err);
      db.close();
      return;
    }

    const insertStmt = db.prepare(
      `INSERT INTO tokens (token, guest_id, used) VALUES (?, ?, 0)`
    );

    let count = 0;

    rows.forEach((row) => {
      const guestId = row.id;
      // genera token casuale
      const token = crypto.randomBytes(12).toString('hex'); // 24 caratteri

      insertStmt.run(token, guestId);
      count++;
    });

    insertStmt.finalize(() => {
      console.log(`Creati ${count} token per gli ospiti.`);
      db.close();
    });
  });
});
