// server.js
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// DB: file locale
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// funzione per costruire la pagina HTML
function buildPage(backgroundColor, mainText, name, subtitleHtml) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Times New Roman", serif;
        background-color: ${backgroundColor};
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
        text-align: center;
      }
      .title {
        font-weight: bold;
        font-size: clamp(2.4rem, 7vw, 4.2rem);
        margin-bottom: 100px;
        margin-top: -120px;
      }
      .mainText {
        font-weight: bold;
        font-size: clamp(3.8rem, 11vw, 7rem);
        margin-bottom: 40px;
      }
      .name {
        font-size: clamp(2.4rem, 7vw, 4rem);
        margin-bottom: 20px;
      }
      .subtitle {
        font-size: clamp(2.6rem, 7vw, 4rem);
      }
    </style>
  </head>
  <body>
    <div class="title">GRAN GALA LUM 2025</div>
    <div class="mainText">${mainText}</div>
    <div class="name">${name || ''}</div>
    <div class="subtitle" style="font-size:8rem;">${subtitleHtml || ''}</div>
  </body>
  </html>`;
}

// health check
app.get('/', (req, res) => {
  res.send('OK - server attivo');
});


// =========================
//   CHECK INGRESSO
// =========================
app.get('/check', (req, res) => {
  const id = req.query.id;

  if (!id) {
    return res.send("Errore: ID mancante.");
  }

  db.get('SELECT * FROM guests WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.send("Errore interno.");
    }

    if (!row) {
      return res.send("Errore: ID non trovato.");
    }

    const nome = row.nome;
    const sala = row.sala;

    // se già entrato → rosso
    if (row.entrata === 1) {
      const html = buildPage(
        '#c62828',
        'ACCESSO NEGATO',
        nome,
        `Sala: ${sala}<br>Già entrato`
      );
      return res.send(html);
    }

    // SEGNARE L'INGRESSO (orario italiano)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      dateStyle: 'short',
      timeStyle: 'medium'
    });
    const oraItaliana = formatter.format(now);

    db.run(
      'UPDATE guests SET entrata = 1, ora_ingresso = ? WHERE id = ?',
      [oraItaliana, id],
      function (updateErr) {
        if (updateErr) {
          console.error(updateErr);
          return res.send("Errore interno durante l'aggiornamento.");
        }

        const html = buildPage(
          '#2e7d32',
          'ACCESSO CONSENTITO',
          nome,
          `Sala: ${sala}`
        );
        return res.send(html);
      }
    );
  });
});


// =========================
//   RESET COMPLETO
// =========================
app.get('/reset', (req, res) => {
  const key = req.query.key;

  if (key !== 'flavio2025') {
    return res.status(403).send("Accesso negato.");
  }

  db.run(`UPDATE guests SET entrata = 0, ora_ingresso = NULL`, [], function(err) {
    if (err) {
      console.error(err);
      return res.send("Errore durante il reset.");
    }

    res.send(`Reset completato. Invitati ripristinati: ${this.changes}`);
  });
});


// =========================
//   REPORT COMPLETO
// =========================
app.get('/report', (req, res) => {
  const key = req.query.key;

  if (key !== 'flavio2025') {
    return res.status(403).send("Accesso negato.");
  }

  db.all(`SELECT * FROM guests ORDER BY entrata DESC, ora_ingresso ASC`, (err, rows) => {
    if (err) {
      console.error(err);
      return res.send("Errore durante il recupero del report.");
    }

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report Ingressi</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
          }
          th {
            background: #333;
            color: white;
          }
          tr:nth-child(even) { background: #f2f2f2; }
          .ok { background: #c8e6c9 !important; }
          .no { background: #ffcdd2 !important; }
        </style>
      </head>
      <body>
        <h1>Report Ingressi</h1>
        <table>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>Sala</th>
            <th>Entrato</th>
            <th>Ora Ingresso</th>
          </tr>
    `;

    rows.forEach((row) => {
      html += `
        <tr class="${row.entrata == 1 ? 'ok' : 'no'}">
          <td>${row.id}</td>
          <td>${row.nome}</td>
          <td>${row.sala}</td>
          <td>${row.entrata == 1 ? 'SI' : 'NO'}</td>
          <td>${row.ora_ingresso ? row.ora_ingresso : '-'}</td>
        </tr>
      `;
    });

    html += `
        </table>
      </body>
      </html>
    `;

    res.send(html);
  });
});


// =========================
//   DOWNLOAD DB (per debug)
// =========================
app.get('/download-db', (req, res) => {
  const key = req.query.key;

  if (key !== 'flavio2025') {
    return res.status(403).send("Accesso negato.");
  }

  res.download(dbPath, "db.sqlite", (err) => {
    if (err) {
      console.error("Errore nel download:", err);
      res.status(500).send("Errore nel download del DB.");
    }
  });
});


// Avvio server
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});
