// server.js
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// per leggere i form POST
app.use(express.urlencoded({ extended: false }));

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
      .btn {
        margin-top: 40px;
        font-size: 3rem;
        padding: 20px 40px;
        border: none;
        border-radius: 12px;
        cursor: pointer;
      }
      .btn-confirm {
        background-color: #2e7d32;
        color: white;
      }
    </style>
  </head>
  <body>
    <div class="title">GRAN GALA LUM 2025</div>
    <div class="mainText">${mainText}</div>
    <div class="name">${name || ''}</div>
    <div class="subtitle" style="font-size:4rem;">${subtitleHtml || ''}</div>
  </body>
  </html>`;
}

// health check
app.get('/', (req, res) => {
  res.send('OK - server attivo');
});

// =========================
//   PAGINA DA QR: /q?token=...
// =========================
app.get('/q', (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.send("Errore: token mancante.");
  }

  db.get(
    `SELECT g.id, g.nome, g.sala, g.entrata, t.used
     FROM guests g
     JOIN tokens t ON g.id = t.guest_id
     WHERE t.token = ?`,
    [token],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.send("Errore interno.");
      }

      if (!row) {
        return res.send("Errore: QR non valido.");
      }

      const nome = row.nome;
      const sala = row.sala;

      // se già usato o già entrato → rosso
      if (row.used === 1 || row.entrata === 1) {
        const html = buildPage(
          '#c62828',
          'ACCESSO NEGATO',
          nome,
          `Sala: ${sala}<br>Già entrato`
        );
        return res.send(html);
      }

      // Mostra pagina di conferma ingresso
      const formHtml = `
        Sala: ${sala}<br><br>
        <form method="POST" action="/confirm">
          <input type="hidden" name="token" value="${token}">
          <button type="submit" class="btn btn-confirm">CONFERMA INGRESSO</button>
        </form>
      `;

      const html = buildPage(
        '#1565c0',
        'VERIFICA INGRESSO',
        nome,
        formHtml
      );
      return res.send(html);
    }
  );
});

// =========================
//   CONFERMA INGRESSO (POST)
// =========================
app.post('/confirm', (req, res) => {
  const token = req.body.token;

  if (!token) {
    return res.send("Errore: token mancante.");
  }

  db.get(
    `SELECT g.id, g.nome, g.sala, g.entrata, t.used
     FROM guests g
     JOIN tokens t ON g.id = t.guest_id
     WHERE t.token = ?`,
    [token],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.send("Errore interno.");
      }

      if (!row) {
        return res.send("Errore: token non valido.");
      }

      const guestId = row.id;
      const nome = row.nome;
      const sala = row.sala;

      // se già usato / entrato
      if (row.used === 1 || row.entrata === 1) {
        const html = buildPage(
          '#c62828',
          'ACCESSO NEGATO',
          nome,
          `Sala: ${sala}<br>Già entrato`
        );
        return res.send(html);
      }

      // orario italiano
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome',
        dateStyle: 'short',
        timeStyle: 'medium'
      });
      const oraItaliana = formatter.format(now);

      // aggiorna guest + token
      db.run(
        'UPDATE guests SET entrata = 1, ora_ingresso = ? WHERE id = ?',
        [oraItaliana, guestId],
        function (err1) {
          if (err1) {
            console.error(err1);
            return res.send("Errore interno durante aggiornamento ospite.");
          }

          db.run(
            'UPDATE tokens SET used = 1 WHERE token = ?',
            [token],
            function (err2) {
              if (err2) {
                console.error(err2);
                return res.send("Errore interno durante aggiornamento token.");
              }

              // fine OK → verde
              const html = buildPage(
                '#2e7d32',
                'ACCESSO CONSENTITO',
                nome,
                `Sala: ${sala}`
              );
              return res.send(html);
            }
          );
        }
      );
    }
  );
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
      return res.send("Errore durante il reset guests.");
    }

    db.run(`UPDATE tokens SET used = 0`, [], function(err2) {
      if (err2) {
        console.error(err2);
        return res.send("Errore durante il reset tokens.");
      }

      res.send(`Reset completato. Invitati ripristinati: ${this.changes}`);
    });
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
//   DOWNLOAD DB (debug)
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

// =========================
//   EXPORT TOKENS (CSV)
// =========================
app.get('/export-tokens', (req, res) => {
  const key = req.query.key;

  if (key !== 'flavio2025') {
    return res.status(403).send("Accesso negato.");
  }

  const baseUrl = 'https://checkingala-backend.onrender.com/q?token=';

  db.all(
    `SELECT g.id, g.nome, g.sala, t.token
     FROM guests g
     JOIN tokens t ON g.id = t.guest_id
     ORDER BY g.id`,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.send("Errore durante export tokens.");
      }

      let csv = 'id,nome,sala,token,link\n';
      rows.forEach((row) => {
        const link = baseUrl + row.token;
        // sostituisco eventuali virgole nel nome
        const safeName = String(row.nome).replace(/,/g, ' ');
        csv += `${row.id},${safeName},${row.sala},${row.token},${link}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="tokens.csv"');
      res.send(csv);
    }
  );
});

// Avvio server
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});
