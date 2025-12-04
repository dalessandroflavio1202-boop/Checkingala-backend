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
  </html>
  `;
}

// endpoint principale: /check?id=XXXX
app.get('/check', (req, res) => {
  const id = req.query.id;

  if (!id) {
    return res.send("Errore: ID mancante.");
  }

  // cerco l'ospite nel DB
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

    // già entrato → nessuna scrittura, solo pagina rossa
    if (row.entrata === 1) {
      const html = buildPage(
        '#c62828',
        'ACCESSO NEGATO',
        nome,
        `Sala: ${sala}<br>Già entrato`
      );
      return res.send(html);
    }

    // primo ingresso → aggiorno il DB
    const now = new Date().toISOString(); // formato ISO

    db.run(
      'UPDATE guests SET entrata = 1, ora_ingresso = ? WHERE id = ?',
      [now, id],
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

// health check
app.get('/', (req, res) => {
  res.send('OK - server attivo');
});

app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});
