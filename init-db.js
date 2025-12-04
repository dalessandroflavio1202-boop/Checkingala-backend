// init-db.js
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { parse } = require('csv-parse');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

const csvPath = path.join(__dirname, 'ospiti.csv');

// ⚠️ ATTENZIONE: questi nomi devono essere ESATTAMENTE come nel CSV
const COL_ID = 'id';
const COL_NOME = 'nome';
const COL_SALA = 'Sala';

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS guests`);
  db.run(`
    CREATE TABLE guests (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      sala TEXT NOT NULL,
      entrata INTEGER NOT NULL DEFAULT 0,
      ora_ingresso TEXT
    )
  `);

  const insertStmt = db.prepare(
    'INSERT INTO guests (id, nome, sala) VALUES (?, ?, ?)'
  );

  const parser = fs
    .createReadStream(csvPath)
    .pipe(parse({ columns: true, trim: true }));

  parser.on('data', (row) => {
    const id = row[COL_ID];
    const nome = row[COL_NOME];
    const sala = row[COL_SALA];

    if (id && nome && sala) {
      insertStmt.run(id, nome, sala);
    }
  });

  parser.on('end', () => {
    insertStmt.finalize(() => {
      console.log('Import completato.');
      db.close();
    });
  });

  parser.on('error', (err) => {
    console.error('Errore nel parsing CSV', err);
  });
});
