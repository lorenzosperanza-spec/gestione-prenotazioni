const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect((err, client, release) => {
  if (err) { console.error('Errore connessione database:', err.stack); }
  else { console.log('Connesso al database PostgreSQL'); release(); }
});
pool.query("SELECT current_database()", (err, result) => {
  console.log("BACKEND STA USANDO IL DB:", result?.rows);
});

const initDipendenti = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dipendenti (
      id SERIAL PRIMARY KEY,
      nome_cognome VARCHAR(100) NOT NULL,
      ore_settimanali INTEGER,
      patente BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  const { rows } = await pool.query('SELECT COUNT(*) FROM dipendenti');
  if (parseInt(rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO dipendenti (nome_cognome, ore_settimanali, patente) VALUES
        ('Marco Bianchi', 40, true), ('Sara Ferretti', 30, false), ('Luca Moretti', 40, true),
        ('Giulia Ricci', 25, false), ('Antonio Esposito', 40, true), ('Francesca Romano', 35, false),
        ('Davide Conti', 40, true), ('Elena Marchetti', 20, false), ('Stefano Lombardi', 40, true),
        ('Valentina Greco', 30, false)
    `);
    console.log('Seed dipendenti inserito');
  }
};
initDipendenti().catch(console.error);

// ============ ROUTES APPARTAMENTI ============

app.get('/api/appartamenti', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM appartamenti ORDER BY nome');
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Errore nel recupero appartamenti' }); }
});

app.get('/api/appartamenti/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM appartamenti WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appartamento non trovato' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Errore nel recupero appartamento' }); }
});

app.post('/api/appartamenti', async (req, res) => {
  try {
    const { owner, gestore, via, nome, prezzo, biancheria, logistica, pulizia, letti_max } = req.body;
    const result = await pool.query(
      `INSERT INTO appartamenti (owner, gestore, via, nome, prezzo, biancheria, logistica, pulizia, letti_max)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [owner, gestore, via, nome, prezzo, biancheria || 0, logistica || 0, pulizia, letti_max]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: `Esiste già un appartamento con il nome "${req.body.nome}".` });
    res.status(500).json({ error: 'Errore nella creazione appartamento' });
  }
});

app.put('/api/appartamenti/:id', async (req, res) => {
  try {
    const { owner, gestore, via, nome, prezzo, biancheria, logistica, pulizia, letti_max } = req.body;
    const result = await pool.query(
      `UPDATE appartamenti SET owner=$1,gestore=$2,via=$3,nome=$4,prezzo=$5,biancheria=$6,logistica=$7,pulizia=$8,letti_max=$9 WHERE id=$10 RETURNING *`,
      [owner, gestore, via, nome, prezzo, biancheria, logistica, pulizia, letti_max, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appartamento non trovato' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: `Esiste già un appartamento con il nome "${req.body.nome}".` });
    res.status(500).json({ error: 'Errore aggiornamento appartamento' });
  }
});

app.delete('/api/appartamenti/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM appartamenti WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appartamento non trovato' });
    res.json({ message: 'Appartamento eliminato' });
  } catch (err) { res.status(500).json({ error: 'Errore eliminazione appartamento' }); }
});

// ============ ROUTES PRENOTAZIONI ============

app.get('/api/prenotazioni', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS dipendente_id INTEGER`).catch(() => {});
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS stato_pulizia VARCHAR(20) DEFAULT 'da_fare'`).catch(() => {});
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS data_pulizia_originale DATE`).catch(() => {});
    const result = await pool.query(`
      SELECT p.*, a.nome as appartamento_nome, a.via, a.pulizia, a.biancheria, a.logistica,
             d.nome_cognome as dipendente_nome
      FROM prenotazioni p
      LEFT JOIN appartamenti a ON p.appartamento_id = a.id
      LEFT JOIN dipendenti d ON p.dipendente_id = d.id
      ORDER BY p.check_out ASC
    `);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Errore nel recupero prenotazioni' }); }
});

app.get('/api/prenotazioni/data/:data', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, a.nome as appartamento_nome, a.via FROM prenotazioni p
      LEFT JOIN appartamenti a ON p.appartamento_id = a.id
      WHERE $1 BETWEEN p.check_in AND p.check_out ORDER BY a.nome
    `, [req.params.data]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Errore nel recupero prenotazioni' }); }
});

app.post('/api/prenotazioni', async (req, res) => {
  try {
    const { appartamento_id, guest_name, check_in, check_out, num_ospiti, note, stato } = req.body;
    const result = await pool.query(
      `INSERT INTO prenotazioni (appartamento_id, guest_name, check_in, check_out, num_ospiti, note, stato)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [appartamento_id, guest_name || null, check_in, check_out, num_ospiti, note, stato || 'confermata']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Errore nella creazione prenotazione' }); }
});

app.put('/api/prenotazioni/:id', async (req, res) => {
  try {
    const { appartamento_id, guest_name, check_in, check_out, num_ospiti, note, stato } = req.body;
    const result = await pool.query(
      `UPDATE prenotazioni SET appartamento_id=$1,guest_name=$2,check_in=$3,check_out=$4,num_ospiti=$5,note=$6,stato=$7 WHERE id=$8 RETURNING *`,
      [appartamento_id, guest_name, check_in, check_out, num_ospiti, note, stato, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prenotazione non trovata' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Errore aggiornamento prenotazione' }); }
});

app.delete('/api/prenotazioni/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM prenotazioni WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prenotazione non trovata' });
    res.json({ message: 'Prenotazione eliminata' });
  } catch (err) { res.status(500).json({ error: 'Errore eliminazione prenotazione' }); }
});

// ============ ROUTES DIPENDENTI ============

app.get('/api/dipendenti', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dipendenti ORDER BY nome_cognome');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Errore nel recupero dipendenti' }); }
});

app.post('/api/dipendenti', async (req, res) => {
  try {
    const { nome_cognome, ore_settimanali, patente } = req.body;
    const result = await pool.query(
      `INSERT INTO dipendenti (nome_cognome, ore_settimanali, patente) VALUES ($1,$2,$3) RETURNING *`,
      [nome_cognome, ore_settimanali || null, patente || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Errore nella creazione dipendente' }); }
});

app.put('/api/dipendenti/:id', async (req, res) => {
  try {
    const { nome_cognome, ore_settimanali, patente } = req.body;
    const result = await pool.query(
      `UPDATE dipendenti SET nome_cognome=$1,ore_settimanali=$2,patente=$3 WHERE id=$4 RETURNING *`,
      [nome_cognome, ore_settimanali || null, patente || false, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dipendente non trovato' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Errore aggiornamento dipendente' }); }
});

app.delete('/api/dipendenti/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM dipendenti WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dipendente non trovato' });
    res.json({ message: 'Dipendente eliminato' });
  } catch (err) { res.status(500).json({ error: 'Errore eliminazione dipendente' }); }
});

// ============ ROUTES PULIZIE ============

app.patch('/api/prenotazioni/:id/assegna', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS dipendente_id INTEGER`);
    const result = await pool.query(
      `UPDATE prenotazioni SET dipendente_id=$1 WHERE id=$2 RETURNING *`,
      [req.body.dipendente_id || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prenotazione non trovata' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/prenotazioni/:id/stato-pulizia', async (req, res) => {
  try {
    const { stato_pulizia, nuova_data } = req.body;
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS stato_pulizia VARCHAR(20) DEFAULT 'da_fare'`);
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS data_pulizia_originale DATE`);
    if (stato_pulizia === 'posticipata' && nuova_data) {
      const orig = await pool.query(`SELECT check_out, data_pulizia_originale FROM prenotazioni WHERE id=$1`, [req.params.id]);
      const dataOriginale = orig.rows[0]?.data_pulizia_originale || orig.rows[0]?.check_out;
      await pool.query(
        `UPDATE prenotazioni SET stato_pulizia=$1,check_out=$2,data_pulizia_originale=$3 WHERE id=$4`,
        [stato_pulizia, nuova_data, dataOriginale, req.params.id]
      );
    } else {
      await pool.query(`UPDATE prenotazioni SET stato_pulizia=$1 WHERE id=$2`, [stato_pulizia, req.params.id]);
    }
    const result = await pool.query(`SELECT * FROM prenotazioni WHERE id=$1`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ GMAIL AUTH ============

const { google } = (() => { try { return require('googleapis'); } catch(e) { return { google: null }; } })();

const getGoogleOAuth2Client = () => {
  if (!google) throw new Error('googleapis non installato');
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://gestione-prenotazioni-production.up.railway.app/auth/google/callback'
  );
  if (process.env.GOOGLE_REFRESH_TOKEN) client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
};

app.get('/auth/google', (req, res) => {
  try {
    const url = getGoogleOAuth2Client().generateAuthUrl({
      access_type: 'offline', prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.modify']
    });
    res.redirect(url);
  } catch (err) { res.status(500).send('Errore: ' + err.message); }
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { tokens } = await getGoogleOAuth2Client().getToken(req.query.code);
    console.log('GOOGLE_REFRESH_TOKEN:', tokens.refresh_token);
    res.send(`<h2>✅ Autenticazione Gmail completata!</h2>
      <p>Copia questo refresh token e aggiungilo come variabile <strong>GOOGLE_REFRESH_TOKEN</strong> su Railway:</p>
      <textarea rows="4" cols="80">${tokens.refresh_token}</textarea>`);
  } catch (err) { res.status(500).send('Errore callback: ' + err.message); }
});

// ============ CLAUDE AI - PARSING EMAIL ============

const processaEmailConClaude = async (emailText, mittente, oggetto, tipoAzione) => {
  try {
    const annoCorrente = new Date().getFullYear();

    const azioneContesto = tipoAzione === 'cancella'
      ? 'Questa email contiene CANCELLAZIONI di prenotazioni. Usa sempre azione "cancella".'
      : 'Questa email contiene prenotazioni da AGGIUNGERE/INSERIRE. Usa sempre azione "nuova".';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Sei un assistente che estrae prenotazioni di pulizie da email italiane.

${azioneContesto}

Oggetto: ${oggetto}
Mittente: ${mittente}
Testo email:
${emailText}

ISTRUZIONI:
- Estrai TUTTE le prenotazioni di TUTTI gli appartamenti menzionati
- I formati delle date possono essere vari:
  * "5-7 maggio 2 ospiti" → check_in ${annoCorrente}-05-05, check_out ${annoCorrente}-05-07, ospiti 2
  * "05/05 - 07/05 (x2)" → check_in ${annoCorrente}-05-05, check_out ${annoCorrente}-05-07, ospiti 2
  * "30 maggio-4 giugno 3 ospiti" → check_in ${annoCorrente}-05-30, check_out ${annoCorrente}-06-04, ospiti 3
  * "29/04 - 02/05 (x4)" → check_in ${annoCorrente}-04-29, check_out ${annoCorrente}-05-02, ospiti 4
- Anno sempre ${annoCorrente} salvo diversa indicazione
- In un thread con più messaggi, considera TUTTI i messaggi inclusi aggiornamenti e aggiunte
- Ignora messaggi di risposta automatica, ringraziamenti, conferme generiche tipo "grazie", "confermato"
- Il nome appartamento è scritto prima dell'elenco di date (es. "Vignola", "Po", "Depretis")
- Ogni appartamento può avere molte righe di date, estraile tutte

Esempio input:
Vignola
5-7 maggio 2 ospiti
7-8 maggio 3 ospiti
30 maggio-4 giugno 3 ospiti

Po
4-7 maggio 4 ospiti
30 maggio- 1 giugno 4 ospiti

Esempio output:
{"rilevante": true, "prenotazioni": [
  {"appartamento": "Vignola", "check_in": "${annoCorrente}-05-05", "check_out": "${annoCorrente}-05-07", "ospiti": 2, "azione": "nuova"},
  {"appartamento": "Vignola", "check_in": "${annoCorrente}-05-07", "check_out": "${annoCorrente}-05-08", "ospiti": 3, "azione": "nuova"},
  {"appartamento": "Vignola", "check_in": "${annoCorrente}-05-30", "check_out": "${annoCorrente}-06-04", "ospiti": 3, "azione": "nuova"},
  {"appartamento": "Po", "check_in": "${annoCorrente}-05-04", "check_out": "${annoCorrente}-05-07", "ospiti": 4, "azione": "nuova"},
  {"appartamento": "Po", "check_in": "${annoCorrente}-05-30", "check_out": "${annoCorrente}-06-01", "ospiti": 4, "azione": "nuova"}
]}

Se non ci sono prenotazioni da estrarre: {"rilevante": false, "prenotazioni": []}

Rispondi SOLO con JSON valido, nessun testo prima o dopo.`
        }]
      })
    });

    const data = await response.json();
    if (data.error) { console.error('Claude API error:', JSON.stringify(data.error)); return { prenotazioni: [], rilevante: false }; }
    const text = data.content?.[0]?.text || '{}';
    console.log('Claude risposta:', text.slice(0, 500));
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Errore Claude:', err.message);
    return { prenotazioni: [], rilevante: false };
  }
};

// ============ HELPER GMAIL ============

// Recupera o crea una label Gmail per nome, restituisce l'ID
const getOrCreateLabelId = async (gmail, labelName) => {
  const list = await gmail.users.labels.list({ userId: 'me' });
  const found = list.data.labels.find(l => l.name.toLowerCase() === labelName.toLowerCase());
  if (found) return found.id;
  const created = await gmail.users.labels.create({
    userId: 'me',
    requestBody: { name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' }
  });
  console.log(`Label "${labelName}" creata con ID: ${created.data.id}`);
  return created.data.id;
};

// Estrae il testo da un messaggio Gmail
const estraiTesto = (email) => {
  let testo = '';
  const extractText = (parts) => {
    for (const part of parts || []) {
      if (part.parts) extractText(part.parts);
      if (part.mimeType === 'text/plain' && part.body?.data) {
        testo += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n';
      } else if (part.mimeType === 'text/html' && part.body?.data && !testo) {
        const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        testo += html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() + '\n';
      }
    }
  };
  if (email.data.payload.parts) extractText(email.data.payload.parts);
  else if (email.data.payload.body?.data) {
    const raw = Buffer.from(email.data.payload.body.data, 'base64').toString('utf-8');
    testo = email.data.payload.mimeType === 'text/html'
      ? raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : raw;
  }
  return testo;
};

// Legge tutte le email con una label specifica e le analizza con Claude
const leggiEmailPerLabel = async (gmail, labelId, tipoAzione) => {
  const listRes = await gmail.users.messages.list({ userId: 'me', labelIds: [labelId], maxResults: 50 });
  const messages = listRes.data.messages || [];
  console.log(`Label "${tipoAzione}": ${messages.length} email trovate`);

  const prenotazioni = [];
  const msgIds = [];

  for (const msg of messages) {
    try {
      const email = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      const headers = email.data.payload.headers;
      const oggetto = headers.find(h => h.name === 'Subject')?.value || '';
      const mittente = headers.find(h => h.name === 'From')?.value || '';
      const testo = estraiTesto(email);

      console.log(`[${tipoAzione}] Da: ${mittente} | Oggetto: ${oggetto} | Testo (200): ${testo.slice(0, 200)}`);
      if (!testo.trim()) continue;

      const parsed = await processaEmailConClaude(testo, mittente, oggetto, tipoAzione);
      if (parsed.rilevante && parsed.prenotazioni?.length) {
        // Forza l'azione corretta in base alla label (sicurezza extra)
        const prenConAzione = parsed.prenotazioni.map(p => ({
          ...p,
          azione: tipoAzione === 'cancella' ? 'cancella' : 'nuova'
        }));
        prenotazioni.push(...prenConAzione);
        msgIds.push(msg.id);
      }
    } catch (err) {
      console.error(`Errore lettura email ${msg.id}:`, err.message);
    }
  }

  return { prenotazioni, msgIds };
};

// ============ ANTEPRIMA EMAIL (legge per label, non importa) ============

app.post(['/api/sync/email/anteprima', '/api/sync/email/preview'], async (req, res) => {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return res.json({ errore: 'GOOGLE_REFRESH_TOKEN non configurato. Vai su /auth/google per autorizzare.' });
  }
  try {
    const oauth2Client = getGoogleOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Recupera ID delle 3 label di input
    const [idImporta, idCancella, idAggiungi] = await Promise.all([
      getOrCreateLabelId(gmail, 'pl2-importa'),
      getOrCreateLabelId(gmail, 'pl2-cancella'),
      getOrCreateLabelId(gmail, 'pl2-aggiungi')
    ]);
    console.log(`Label IDs — importa:${idImporta} cancella:${idCancella} aggiungi:${idAggiungi}`);

    // Legge email da tutte e 3 le label
    const [resImporta, resCancella, resAggiungi] = await Promise.all([
      leggiEmailPerLabel(gmail, idImporta, 'importa'),
      leggiEmailPerLabel(gmail, idCancella, 'cancella'),
      leggiEmailPerLabel(gmail, idAggiungi, 'aggiungi')
    ]);

    const tuttePrenotazioni = [
      ...resImporta.prenotazioni,
      ...resCancella.prenotazioni,
      ...resAggiungi.prenotazioni
    ];

    const msgIds = {
      importa: resImporta.msgIds,
      cancella: resCancella.msgIds,
      aggiungi: resAggiungi.msgIds
    };

    const labelIds = { idImporta, idCancella, idAggiungi };

    // Controlla match appartamenti nel DB per mostrare avvisi in anteprima
    const errori = [];
    for (const p of tuttePrenotazioni) {
      const appRes = await pool.query(
        'SELECT id FROM appartamenti WHERE LOWER(nome)=LOWER($1) OR LOWER(nome) LIKE LOWER($2) LIMIT 1',
        [p.appartamento, `%${p.appartamento}%`]
      );
      if (appRes.rows.length === 0) {
        const msg = `"${p.appartamento}" non trovato nel DB`;
        if (!errori.includes(msg)) errori.push(msg);
      }
    }

    res.json({
      emailAnalizzate: resImporta.msgIds.length + resCancella.msgIds.length + resAggiungi.msgIds.length,
      prenotazioni: tuttePrenotazioni,
      msgIds,
      labelIds,
      errori
    });
  } catch (err) {
    console.error('Errore anteprima email:', err.message);
    res.status(500).json({ errore: err.message });
  }
});

// ============ CONFERMA IMPORT EMAIL ============

app.post(['/api/sync/email/conferma', '/api/sync/email/confirm'], async (req, res) => {
  const { prenotazioni, msgIds, labelIds } = req.body;
  if (!prenotazioni || !Array.isArray(prenotazioni)) {
    return res.status(400).json({ errore: 'Dati non validi' });
  }

  const risultati = { importate: 0, cancellate: 0, errori: [] };

  for (const pren of prenotazioni) {
    try {
      // Match esatto poi parziale
      let appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome)=LOWER($1) LIMIT 1', [pren.appartamento]);
      if (appRes.rows.length === 0) {
        appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome) LIKE LOWER($1) LIMIT 1', [`%${pren.appartamento}%`]);
      }
      if (appRes.rows.length === 0) {
        risultati.errori.push(`Appartamento non trovato: "${pren.appartamento}"`);
        continue;
      }
      const appartamento_id = appRes.rows[0].id;

      if (pren.azione === 'cancella') {
        await pool.query(
          'UPDATE prenotazioni SET stato=$1 WHERE appartamento_id=$2 AND check_in=$3 AND check_out=$4',
          ['cancellata', appartamento_id, pren.check_in, pren.check_out]
        );
        risultati.cancellate++;
      } else {
        const esistente = await pool.query(
          'SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_in=$2 AND check_out=$3',
          [appartamento_id, pren.check_in, pren.check_out]
        );
        if (esistente.rows.length > 0) {
          await pool.query('UPDATE prenotazioni SET num_ospiti=$1 WHERE id=$2', [pren.ospiti || 1, esistente.rows[0].id]);
        } else {
          await pool.query(
            `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, stato) VALUES ($1,$2,$3,$4,'confermata')`,
            [appartamento_id, pren.check_in, pren.check_out, pren.ospiti || 1]
          );
          risultati.importate++;
        }
      }
    } catch (err) {
      risultati.errori.push(`Errore: ${err.message}`);
    }
  }

  // Sposta email da label origine a pl2-fatto
  if (process.env.GOOGLE_REFRESH_TOKEN && msgIds && labelIds) {
    try {
      const oauth2Client = getGoogleOAuth2Client();
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const idFatto = await getOrCreateLabelId(gmail, 'pl2-fatto');

      const tuttiIds = [
        ...(msgIds.importa || []),
        ...(msgIds.cancella || []),
        ...(msgIds.aggiungi || [])
      ];

      const labelsDaRimuovere = [labelIds.idImporta, labelIds.idCancella, labelIds.idAggiungi].filter(Boolean);

      for (const id of tuttiIds) {
        await gmail.users.messages.modify({
          userId: 'me', id,
          requestBody: { addLabelIds: [idFatto], removeLabelIds: labelsDaRimuovere }
        }).catch(e => console.error('Errore modifica label:', e.message));
      }
      console.log(`${tuttiIds.length} email spostate in pl2-fatto`);
    } catch (err) {
      console.error('Errore spostamento label:', err.message);
    }
  }

  res.json(risultati);
});

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(port, () => console.log(`Server in esecuzione sulla porta ${port}`));

// ============ IMPORT ITALIANWAY (manuale xlsx) ============

app.post('/api/import/italianway', async (req, res) => {
  const { righe } = req.body;
  if (!righe || !Array.isArray(righe)) return res.status(400).json({ error: 'Dati non validi' });
  const risultati = { importate: 0, saltate: 0, errori: [] };
  for (const r of righe) {
    try {
      const { appartamento, check_out, check_in, ospiti_entranti, ospiti_uscenti, note, categoria } = r;
      const appRes = await pool.query(`SELECT id FROM appartamenti WHERE LOWER(nome)=LOWER($1) LIMIT 1`, [appartamento]);
      if (appRes.rows.length === 0) { risultati.saltate++; risultati.errori.push(`Appartamento non trovato: "${appartamento}"`); continue; }
      const appartamento_id = appRes.rows[0].id;
      const esistente = await pool.query(`SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_out=$2`, [appartamento_id, check_out]);
      if (esistente.rows.length > 0) { risultati.saltate++; continue; }
      await pool.query(
        `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, note, stato) VALUES ($1,$2,$3,$4,$5,'confermata')`,
        [appartamento_id, check_in || check_out, check_out, ospiti_entranti || ospiti_uscenti || 1,
         [categoria, note].filter(v => v && v !== '-').join(' | ') || null]
      );
      risultati.importate++;
    } catch (err) { risultati.errori.push(`Errore su "${r.appartamento}": ${err.message}`); }
  }
  res.json(risultati);
});

// ============ IMPORT SMOOBU (CSV) ============

app.post('/api/import/smoobu', async (req, res) => {
  const { righe } = req.body;
  if (!righe || !Array.isArray(righe)) return res.status(400).json({ error: 'Dati non validi' });

  const risultati = { importate: 0, saltate: 0, errori: [] };

  for (const r of righe) {
    try {
      const { appartamento, check_in, check_out, num_ospiti, note, portale, smoobu_id } = r;

      // Cerca appartamento per nome esatto poi parziale
      let appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome)=LOWER($1) LIMIT 1', [appartamento]);
      if (appRes.rows.length === 0) {
        appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome) LIKE LOWER($1) LIMIT 1', [`%${appartamento}%`]);
      }
      if (appRes.rows.length === 0) {
        risultati.saltate++;
        risultati.errori.push(`Appartamento non trovato: "${appartamento}"`);
        continue;
      }

      const appartamento_id = appRes.rows[0].id;

      // Controlla duplicati per smoobu_id o check_in+check_out
      const esistente = await pool.query(
        'SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_in=$2 AND check_out=$3',
        [appartamento_id, check_in, check_out]
      );
      if (esistente.rows.length > 0) { risultati.saltate++; continue; }

      const noteFinale = [portale, note].filter(v => v && v.trim()).join(' | ') || null;

      await pool.query(
        `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, note, stato) VALUES ($1,$2,$3,$4,$5,'confermata')`,
        [appartamento_id, check_in, check_out, num_ospiti || 1, noteFinale]
      );
      risultati.importate++;
    } catch (err) {
      risultati.errori.push(`Errore su "${r.appartamento}": ${err.message}`);
    }
  }

  res.json(risultati);
});

// ============ SYNC ITALIANWAY (automatico KALISI) ============

const loginKalisi = async () => {
  const email = process.env.ITALIANWAY_EMAIL;
  const password = process.env.ITALIANWAY_PASSWORD;
  const orgCode = process.env.ITALIANWAY_ORG || 'CG-001';
  if (!email || !password) throw new Error('ITALIANWAY_EMAIL o ITALIANWAY_PASSWORD non configurati');
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch(e) { throw new Error('Puppeteer non installato: ' + e.message); }
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://www.italianway.house/admin/sign_in', { waitUntil: 'networkidle2', timeout: 30000 });
    const inputs = await page.$$('input[type="text"], input[type="email"], input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"])');
    const visibleInputs = [];
    for (const input of inputs) {
      const visible = await input.isVisible().catch(() => false);
      const type = await input.evaluate(el => el.type);
      if (visible && type !== 'hidden') visibleInputs.push({ input, type });
    }
    for (let i = 0; i < visibleInputs.length; i++) {
      const { input, type } = visibleInputs[i];
      await input.click({ clickCount: 3 });
      if (type === 'password') await input.type(password);
      else if (i === 0) await input.type(orgCode);
      else if (i === 1 || type === 'email') await input.type(email);
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('button, input[type="submit"]')
    ]);
    if (page.url().includes('sign_in')) throw new Error('Login fallito - verifica credenziali.');
    const cookies = await page.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log(`Login KALISI OK - ${cookies.length} cookie`);
    return cookieStr;
  } finally { await browser.close(); }
};

const syncItalianway = async (giorni = 30) => {
  const risultati = { importate: 0, saltate: 0, errori: [], sincronizzato_il: new Date().toISOString() };
  let cookie;
  try { cookie = await loginKalisi(); }
  catch (err) { risultati.errori.push('Login KALISI fallito: ' + err.message); return risultati; }
  try {
    const fine = new Date(); fine.setDate(fine.getDate() + giorni);
    const startStr = new Date().toISOString().slice(0, 10);
    const endStr = fine.toISOString().slice(0, 10);
    console.log(`Fetch planner: da ${startStr} a ${endStr}`);
    let events = [];
    const plannerRes = await fetch(
      `https://www.italianway.house/admin/housecleanings/planner_dhx?from=${startStr}&to=${endStr}`,
      { headers: { 'Cookie': cookie, 'Accept': 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://www.italianway.house/admin/housecleanings/planner_dhx', 'User-Agent': 'Mozilla/5.0' } }
    );
    const ct = plannerRes.headers.get('content-type') || '';
    if (plannerRes.ok && ct.includes('json')) {
      const json = await plannerRes.json();
      events = Array.isArray(json) ? json : (json.data || []);
      console.log(`Planner JSON: ${events.length} eventi`);
    } else {
      console.log('Planner non JSON, uso Puppeteer...');
      const puppeteer2 = require('puppeteer');
      const browser2 = await puppeteer2.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
      try {
        const page2 = await browser2.newPage();
        for (const cp of cookie.split('; ')) {
          const idx = cp.indexOf('=');
          if (idx > 0) await page2.setCookie({ name: cp.slice(0, idx).trim(), value: cp.slice(idx + 1).trim(), domain: 'www.italianway.house' }).catch(() => {});
        }
        await page2.goto('https://www.italianway.house/admin/housecleanings/planner_dhx', { waitUntil: 'networkidle2', timeout: 30000 });
        events = await page2.evaluate(() => { try { return scheduler.getEvents(); } catch(e) { return []; } });
        console.log(`Puppeteer planner: ${events.length} eventi`);
      } finally { await browser2.close(); }
    }
    for (const ev of events) {
      try {
        const nomeAppartamento = (ev.apt_name || '').trim();
        if (!nomeAppartamento) continue;
        const checkInStr = new Date(ev.start_date).toISOString().slice(0, 10);
        const checkOutStr = new Date(ev.end_date).toISOString().slice(0, 10);
        const ospiti = parseInt(ev.pax) || 1;
        const note = ev.notes && ev.notes.trim() !== 'RESERVATION' ? ev.notes.trim() : null;
        const appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome)=LOWER($1) LIMIT 1', [nomeAppartamento]);
        if (appRes.rows.length === 0) {
          risultati.saltate++;
          if (!risultati.errori.includes(`Appartamento non trovato: "${nomeAppartamento}"`))
            risultati.errori.push(`Appartamento non trovato: "${nomeAppartamento}"`);
          continue;
        }
        const appartamento_id = appRes.rows[0].id;
        const esistente = await pool.query('SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_in=$2 AND check_out=$3', [appartamento_id, checkInStr, checkOutStr]);
        if (esistente.rows.length > 0) {
          await pool.query('UPDATE prenotazioni SET num_ospiti=$1 WHERE appartamento_id=$2 AND check_in=$3 AND check_out=$4', [ospiti, appartamento_id, checkInStr, checkOutStr]);
          risultati.saltate++;
        } else {
          await pool.query(`INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, note, stato) VALUES ($1,$2,$3,$4,$5,'confermata')`, [appartamento_id, checkInStr, checkOutStr, ospiti, note]);
          risultati.importate++;
        }
      } catch (err) { risultati.errori.push(`Errore evento: ${err.message}`); }
    }
  } catch (err) { risultati.errori.push(`Errore planner: ${err.message}`); }
  await pool.query(`CREATE TABLE IF NOT EXISTS sync_log (id SERIAL PRIMARY KEY, fonte VARCHAR(50), importate INT, saltate INT, errori TEXT, eseguito_il TIMESTAMP DEFAULT NOW())`);
  await pool.query(`INSERT INTO sync_log (fonte, importate, saltate, errori) VALUES ($1,$2,$3,$4)`, ['italianway', risultati.importate, risultati.saltate, JSON.stringify(risultati.errori)]);
  return risultati;
};

app.post('/api/sync/italianway', async (req, res) => {
  try {
    const giorni = parseInt(req.query.giorni) || 30;
    console.log(`Sync ItalianWay avviato: prossimi ${giorni} giorni`);
    res.json(await syncItalianway(giorni));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sync/status', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM sync_log ORDER BY eseguito_il DESC LIMIT 5`);
    res.json(result.rows);
  } catch { res.json([]); }
});

// ============ SYNC SMOOBU (automatico con Puppeteer) ============

const syncSmoobu = async () => {
  const email = process.env.SMOOBU_EMAIL;
  const password = process.env.SMOOBU_PASSWORD;
  if (!email || !password) {
    console.log('Smoobu: SMOOBU_EMAIL o SMOOBU_PASSWORD non configurati, skip.');
    return { importate: 0, saltate: 0, errori: ['Credenziali Smoobu non configurate'] };
  }

  const risultati = { importate: 0, saltate: 0, errori: [] };
  let puppeteer;
  try { puppeteer = require('puppeteer'); }
  catch(e) { risultati.errori.push('Puppeteer non installato'); return risultati; }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

    console.log('Smoobu: login in corso...');
    await page.goto('https://login.smoobu.com/en/login', { waitUntil: 'networkidle2', timeout: 30000 });

    // Compila email e password
    await page.waitForSelector('input[type="email"], input[name="email"], input[type="text"]', { timeout: 10000 });
    const emailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]') || await page.$('input[type="text"]');
    const passInput = await page.$('input[type="password"]');
    if (!emailInput || !passInput) throw new Error('Campi login non trovati');

    await emailInput.click({ clickCount: 3 });
    await emailInput.type(email);
    await passInput.click({ clickCount: 3 });
    await passInput.type(password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('button[type="submit"], input[type="submit"], button:not([type])')
    ]);

    const currentUrl = page.url();
    console.log('Smoobu: dopo login URL:', currentUrl);
    if (currentUrl.includes('login')) throw new Error('Login Smoobu fallito — verifica credenziali');

    // Naviga alla pagina prenotazioni e scarica CSV
    console.log('Smoobu: scarico lista prenotazioni...');

    // Usa l'API interna di Smoobu per ottenere le prenotazioni in JSON
    const oggi = new Date().toISOString().slice(0, 10);
    const tra60 = new Date(); tra60.setDate(tra60.getDate() + 60);
    const fineStr = tra60.toISOString().slice(0, 10);

    // Chiama l'API Smoobu autenticata tramite cookie di sessione
    const cookies = await page.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const apiRes = await page.evaluate(async (da, a) => {
      try {
        const r = await fetch(`/api/reservations?pageSize=100&arrivalFrom=${da}&arrivalTo=${a}`, {
          headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (r.ok) return await r.json();
        // Prova endpoint alternativo
        const r2 = await fetch(`/api/v2/reservations?pageSize=100&arrivalFrom=${da}&arrivalTo=${a}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (r2.ok) return await r2.json();
        return null;
      } catch(e) { return null; }
    }, oggi, fineStr);

    let prenotazioni = [];

    if (apiRes && (apiRes.bookings || apiRes.data || Array.isArray(apiRes))) {
      // Formato API JSON
      const bookings = apiRes.bookings || apiRes.data || apiRes;
      console.log(`Smoobu API: ${bookings.length} prenotazioni trovate`);
      prenotazioni = bookings.map(b => ({
        appartamento: b.apartment?.name || b.property?.name || b.apartmentName || '',
        check_in: b.arrival || b.checkIn || b.arrivalDate || '',
        check_out: b.departure || b.checkOut || b.departureDate || '',
        num_ospiti: (parseInt(b.adults) || 0) + (parseInt(b.children) || 0) || 1,
        note: b.guestNote || b.assistantNote || null,
        portale: b.channel?.name || b.portal || null
      })).filter(p => p.appartamento && p.check_in && p.check_out);
    } else {
      // Fallback: scarica CSV dalla UI
      console.log('Smoobu: API JSON non disponibile, uso export CSV...');
      await page.goto('https://login.smoobu.com/it/booking', { waitUntil: 'networkidle2', timeout: 30000 });

      // Imposta range date
      const client = await page.createCDPSession();
      await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: '/tmp' });

      // Clicca Esporta → CSV
      await page.waitForSelector('button', { timeout: 5000 }).catch(() => {});
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const txt = await btn.evaluate(el => el.textContent.trim());
        if (txt.includes('Esporta') || txt.includes('Export')) {
          await btn.click();
          await new Promise(r => setTimeout(r, 500));
          break;
        }
      }

      // Clicca .csv
      const csvLinks = await page.$$('text=.csv, [data-format="csv"]');
      if (csvLinks.length > 0) {
        await csvLinks[0].click();
        await new Promise(r => setTimeout(r, 3000));
      }

      // Leggi il CSV scaricato
      const fs = require('fs');
      const files = fs.readdirSync('/tmp').filter(f => f.endsWith('.csv')).sort();
      if (files.length > 0) {
        const csvContent = fs.readFileSync(`/tmp/${files[files.length-1]}`, 'utf-8');
        const lines = csvContent.split('\n').filter(l => l.trim());
        const headers = lines[0].replace(/^\uFEFF/, '').split(';').map(h => h.replace(/"/g, '').trim());
        const idxOf = (name) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
        const iApp = idxOf('Proprietà') !== -1 ? idxOf('Proprietà') : idxOf('Propr');
        const iArrivo = idxOf('Arrivo'), iPartenza = idxOf('Partenza');
        const iAdulti = idxOf('Adulti'), iBambini = idxOf('Bambini');
        const iNote = idxOf('Note assistente') !== -1 ? idxOf('Note assistente') : idxOf('Note');
        const iPortale = idxOf('Portale'), iStato = idxOf('stato');

        const smoobuDateToISO = (v) => {
          if (!v) return null;
          const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
          if (m) { const dd=m[1].padStart(2,'0'),mm=m[2].padStart(2,'0'),yy=m[3].length===2?`20${m[3]}`:m[3]; return `${yy}-${mm}-${dd}`; }
          return null;
        };

        prenotazioni = lines.slice(1).map(line => {
          const cols = line.split(';').map(c => c.replace(/"/g, '').trim());
          if ((cols[iStato]||'').toLowerCase().includes('cancell')) return null;
          const check_in = smoobuDateToISO(cols[iArrivo]);
          const check_out = smoobuDateToISO(cols[iPartenza]);
          if (!cols[iApp] || !check_in || !check_out) return null;
          return {
            appartamento: cols[iApp],
            check_in, check_out,
            num_ospiti: (parseInt(cols[iAdulti])||0)+(parseInt(cols[iBambini])||0)||1,
            note: cols[iNote]||null,
            portale: cols[iPortale]||null
          };
        }).filter(Boolean);
        console.log(`Smoobu CSV: ${prenotazioni.length} prenotazioni`);
      }
    }

    // Importa le prenotazioni nel DB
    for (const pren of prenotazioni) {
      try {
        let appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome)=LOWER($1) LIMIT 1', [pren.appartamento]);
        if (appRes.rows.length === 0) {
          appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome) LIKE LOWER($1) LIMIT 1', [`%${pren.appartamento}%`]);
        }
        if (appRes.rows.length === 0) {
          risultati.saltate++;
          const msg = `Appartamento non trovato: "${pren.appartamento}"`;
          if (!risultati.errori.includes(msg)) risultati.errori.push(msg);
          continue;
        }
        const appartamento_id = appRes.rows[0].id;
        const esistente = await pool.query(
          'SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_in=$2 AND check_out=$3',
          [appartamento_id, pren.check_in, pren.check_out]
        );
        if (esistente.rows.length > 0) {
          await pool.query('UPDATE prenotazioni SET num_ospiti=$1 WHERE id=$2', [pren.num_ospiti, esistente.rows[0].id]);
          risultati.saltate++;
        } else {
          const noteFinale = [pren.portale, pren.note].filter(v => v && v.trim()).join(' | ') || null;
          await pool.query(
            `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, note, stato) VALUES ($1,$2,$3,$4,$5,'confermata')`,
            [appartamento_id, pren.check_in, pren.check_out, pren.num_ospiti, noteFinale]
          );
          risultati.importate++;
        }
      } catch (err) { risultati.errori.push(`Errore: ${err.message}`); }
    }

  } catch (err) {
    console.error('Smoobu sync errore:', err.message);
    risultati.errori.push(err.message);
  } finally {
    await browser.close();
  }

  // Salva log
  await pool.query(`CREATE TABLE IF NOT EXISTS sync_log (id SERIAL PRIMARY KEY, fonte VARCHAR(50), importate INT, saltate INT, errori TEXT, eseguito_il TIMESTAMP DEFAULT NOW())`).catch(()=>{});
  await pool.query(`INSERT INTO sync_log (fonte, importate, saltate, errori) VALUES ($1,$2,$3,$4)`,
    ['smoobu', risultati.importate, risultati.saltate, JSON.stringify(risultati.errori)]).catch(()=>{});

  console.log(`Smoobu sync: ${risultati.importate} importate, ${risultati.saltate} saltate`);
  return risultati;
};

app.post('/api/sync/smoobu', async (req, res) => {
  try {
    console.log('Sync Smoobu avviato manualmente');
    const risultati = await syncSmoobu();
    res.json(risultati);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ CRON JOB ============
const scheduleCron = () => {
  const checkCron = () => {
    const now = new Date();
    const h = now.getUTCHours(), m = now.getUTCMinutes();
    if ((h === 2 || h === 7) && m === 0) {
      console.log(`Cron sync ItalianWay avviato alle ${now.toISOString()}`);
      syncItalianway(30)
        .then(r => console.log(`Cron sync completato: ${r.importate} importate, ${r.saltate} saltate`))
        .catch(err => console.error('Cron sync errore:', err.message));
      // Sync Smoobu in parallelo
      syncSmoobu()
        .then(r => console.log(`Cron Smoobu: ${r.importate} importate, ${r.saltate} saltate`))
        .catch(err => console.error('Cron Smoobu errore:', err.message));
    }
  };
  setInterval(checkCron, 60000);
  console.log('Cron job ItalianWay + Smoobu attivo (02:00 e 07:00 UTC)');
};
scheduleCron();
