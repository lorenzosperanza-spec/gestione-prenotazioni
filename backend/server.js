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
      scope: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/spreadsheets']
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
- Se ci sono note o istruzioni speciali per una prenotazione (es. "PREPARARE PER 6", "letto aggiuntivo", "culla"), inseriscile nel campo "note"
- Le note possono essere su una riga separata dopo le date, oppure inline

Esempio input:
Nome appartamento: PORTA PORTESE
Data check in: 07/05/2026
Data check out: 11/05/2026
Numero ospiti: 4
Note PREPARARE PER 6

Nome appartamento: FLAMINIO
Data check in: 10/05/2026
Data check out: 11/05/2026
Numero ospiti: 4
Note PREPARARE PER 3

Esempio output:
{"rilevante": true, "prenotazioni": [
  {"appartamento": "PORTA PORTESE", "check_in": "${annoCorrente}-05-07", "check_out": "${annoCorrente}-05-11", "ospiti": 4, "azione": "nuova", "note": "PREPARARE PER 6"},
  {"appartamento": "FLAMINIO", "check_in": "${annoCorrente}-05-10", "check_out": "${annoCorrente}-05-11", "ospiti": 4, "azione": "nuova", "note": "PREPARARE PER 3"}
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
      // Usa override se presente, altrimenti match automatico
      let appartamento_id = pren.appartamento_id_override || null;
      if (!appartamento_id) {
        let appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome)=LOWER($1) LIMIT 1', [pren.appartamento]);
        if (appRes.rows.length === 0) {
          appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome) LIKE LOWER($1) LIMIT 1', [`%${pren.appartamento}%`]);
        }
        if (appRes.rows.length === 0) {
          risultati.errori.push(`Appartamento non trovato: "${pren.appartamento}"`);
          continue;
        }
        appartamento_id = appRes.rows[0].id;
      }

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
          await pool.query('UPDATE prenotazioni SET num_ospiti=$1, note=COALESCE($2, note) WHERE id=$3', [pren.ospiti || 1, pren.note || null, esistente.rows[0].id]);
        } else {
          await pool.query(
            `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, note, stato) VALUES ($1,$2,$3,$4,$5,'confermata')`,
            [appartamento_id, pren.check_in, pren.check_out, pren.ospiti || 1, pren.note || null]
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

// ============ SYNC GOOGLE SHEET ============

const SHEET_ID = '1nC7Z_WXmhf0dJ5ZnGObKF9MF7esITLNMwAbfJ-El20c';

// Legge il foglio del mese corrente e restituisce le prenotazioni
const leggiGoogleSheet = async (tabName) => {
  const oauth2Client = getGoogleOAuth2Client();
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // Se non specificato, usa il tab del mese corrente in italiano
  if (!tabName) {
    const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    tabName = mesi[new Date().getMonth()];
  }

  console.log(`Google Sheet: lettura tab "${tabName}"...`);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: tabName,
  });

  const rows = res.data.values || [];
  console.log(`Google Sheet: ${rows.length} righe trovate`);

  const prenotazioni = [];
  let appartamentoCorrente = '';
  const annoCorrente = new Date().getFullYear();

  // Converte data GG/M o GG/MM in YYYY-MM-DD
  const parseData = (v) => {
    if (!v) return null;
    const s = String(v).trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (!m) return null;
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yy = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : annoCorrente;
    return `${yy}-${mm}-${dd}`;
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const col1 = String(row[0] || '').trim();
    const col2 = String(row[1] || '').trim();

    // Riga header appartamento: cella B in maiuscolo e grassetto (es. "VIA MARCHE 72 (PIANO2)")
    if (col2 && col2 === col2.toUpperCase() && col2.length > 3 &&
        !col2.includes('/') && isNaN(col2) &&
        !['CHECK-IN','CHECK-OUT','NUMERO OSPITI','NOTE','PROCESSATO'].includes(col2)) {
      appartamentoCorrente = col2;
      continue;
    }

    // Salta righe header colonne
    if (col2 === 'CHECK-IN' || col2 === 'check-in') continue;

    // Riga prenotazione: ha check-in e check-out
    const checkIn = parseData(row[2]);  // colonna C
    const checkOut = parseData(row[3]); // colonna D
    if (!appartamentoCorrente || !checkIn || !checkOut) continue;

    const numOspiti = parseInt(row[4]) || 1; // colonna E
    const note = String(row[5] || '').trim() || null; // colonna F
    const processato = String(row[6] || '').trim().toLowerCase(); // colonna G
    const giaProcessato = ['si', 'sì', 'yes', 'true'].includes(processato);
    const nomeOspite = col2 || null; // colonna B = nome ospite
    const rowIndex = i + 1; // 1-based per Sheets API

    prenotazioni.push({
      appartamento: appartamentoCorrente,
      check_in: checkIn,
      check_out: checkOut,
      num_ospiti: numOspiti,
      note,
      nome_ospite: nomeOspite,
      gia_processato: giaProcessato,
      row_index: rowIndex,
      tab_name: tabName,
    });
  }

  console.log(`Google Sheet: ${prenotazioni.length} prenotazioni estratte`);
  return { prenotazioni, tabName };
};

// GET lista tab disponibili
app.get('/api/sync/sheets/tabs', async (req, res) => {
  try {
    const oauth2Client = getGoogleOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const tabs = meta.data.sheets.map(s => s.properties.title);
    res.json({ tabs });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

// POST anteprima Google Sheet
app.post('/api/sync/sheets/anteprima', async (req, res) => {
  try {
    const { tab } = req.body;
    const { prenotazioni, tabName } = await leggiGoogleSheet(tab);

    // Controlla match appartamenti nel DB
    const result = [];
    for (const p of prenotazioni) {
      let appRes = await pool.query('SELECT id, nome FROM appartamenti WHERE LOWER(nome)=LOWER($1) LIMIT 1', [p.appartamento]);
      if (appRes.rows.length === 0) appRes = await pool.query('SELECT id, nome FROM appartamenti WHERE LOWER(nome) LIKE LOWER($1) LIMIT 1', [`%${p.appartamento}%`]);
      const appartamento_id = appRes.rows[0]?.id || null;
      const appartamento_nome_db = appRes.rows[0]?.nome || null;

      let esistente = false;
      if (appartamento_id) {
        const dup = await pool.query('SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_in=$2 AND check_out=$3', [appartamento_id, p.check_in, p.check_out]);
        esistente = dup.rows.length > 0;
      }

      result.push({ ...p, appartamento_id, appartamento_nome_db, esistente });
    }

    res.json({ prenotazioni: result, tabName, totale: result.length });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

// POST importa prenotazioni selezionate dal Sheet
app.post('/api/sync/sheets/importa', async (req, res) => {
  const { prenotazioni, marcaProcessato } = req.body;
  if (!prenotazioni || !Array.isArray(prenotazioni)) return res.status(400).json({ errore: 'Dati non validi' });

  const risultati = { importate: 0, saltate: 0, errori: [] };

  for (const p of prenotazioni) {
    try {
      let appartamento_id = p.appartamento_id;
      if (!appartamento_id) {
        let appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome)=LOWER($1) LIMIT 1', [p.appartamento]);
        if (appRes.rows.length === 0) appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome) LIKE LOWER($1) LIMIT 1', [`%${p.appartamento}%`]);
        if (appRes.rows.length === 0) { risultati.saltate++; risultati.errori.push(`Non trovato: "${p.appartamento}"`); continue; }
        appartamento_id = appRes.rows[0].id;
      }

      const esistente = await pool.query('SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_in=$2 AND check_out=$3', [appartamento_id, p.check_in, p.check_out]);
      if (esistente.rows.length > 0) { risultati.saltate++; continue; }

      await pool.query(
        `INSERT INTO prenotazioni (appartamento_id, guest_name, check_in, check_out, num_ospiti, note, stato) VALUES ($1,$2,$3,$4,$5,$6,'confermata')`,
        [appartamento_id, p.nome_ospite || null, p.check_in, p.check_out, p.num_ospiti || 1, p.note || null]
      );
      risultati.importate++;
    } catch (err) { risultati.errori.push(`Errore: ${err.message}`); }
  }

  // Marca come processato nel foglio se richiesto
  if (marcaProcessato && prenotazioni.length > 0) {
    try {
      const oauth2Client = getGoogleOAuth2Client();
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      const tabName = prenotazioni[0].tab_name;

      for (const p of prenotazioni) {
        if (p.row_index) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${tabName}!G${p.row_index}`,
            valueInputOption: 'RAW',
            requestBody: { values: [['Si']] }
          }).catch(e => console.error('Errore marca processato:', e.message));
        }
      }
      console.log(`Google Sheet: ${prenotazioni.length} righe marcate come processate`);
    } catch (err) { console.error('Errore marcatura sheet:', err.message); }
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

// ============ SYNC SMOOBU (API diretta con cookie) ============

// Crea tabella mapping nomi Smoobu → appartamenti DB
const initSmoobuMapping = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS smoobu_mapping (
      id SERIAL PRIMARY KEY,
      nome_smoobu VARCHAR(200) NOT NULL UNIQUE,
      appartamento_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
};
initSmoobuMapping().catch(console.error);

// Cerca appartamento con match esatto, parziale, o mapping salvato
const trovaTramiteNome = async (nomeSmoobu) => {
  // 1. Controlla mapping personalizzato
  const mappingRes = await pool.query(
    'SELECT appartamento_id FROM smoobu_mapping WHERE LOWER(nome_smoobu)=LOWER($1) LIMIT 1',
    [nomeSmoobu]
  );
  if (mappingRes.rows.length > 0) return mappingRes.rows[0].appartamento_id;

  // 2. Match esatto
  let appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome)=LOWER($1) LIMIT 1', [nomeSmoobu]);
  if (appRes.rows.length > 0) return appRes.rows[0].id;

  // 3. Nome Smoobu contenuto nel nome DB (es. "The cozy Vatican flat" dentro "The cozy Vatican flat (Santamaura)")
  appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome) LIKE LOWER($1) LIMIT 1', [`%${nomeSmoobu}%`]);
  if (appRes.rows.length > 0) return appRes.rows[0].id;

  // 4. Nome DB contenuto nel nome Smoobu
  const tutti = await pool.query('SELECT id, nome FROM appartamenti');
  for (const row of tutti.rows) {
    if (nomeSmoobu.toLowerCase().includes(row.nome.toLowerCase())) return row.id;
  }

  return null;
};

// Fetch prenotazioni da API Smoobu
const fetchSmoobuBookings = async () => {
  const cookie = process.env.SMOOBU_COOKIE;
  if (!cookie) throw new Error('SMOOBU_COOKIE non configurato su Railway');

  const oggi = new Date();
  const da = new Date(oggi); da.setDate(da.getDate() - 7);
  const a = new Date(oggi); a.setDate(a.getDate() + 90);
  const daStr = da.toISOString().slice(0, 10);
  const aStr = a.toISOString().slice(0, 10);

  const headers = {
    'Cookie': cookie,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'it-IT,it;q=0.9',
    'Referer': 'https://login.smoobu.com/it/cockpit/calendar',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest'
  };

  let tuttePrenotazioni = [];
  let pagina = 1;

  while (true) {
    const url = `https://login.smoobu.com/api/v1/users/1683032/bookings?filter%5Bfrom%5D=${daStr}&filter%5Bto%5D=${aStr}&page%5Bsize%5D=100&page%5Bnumber%5D=${pagina}`;
    const res = await fetch(url, { headers });

    if (res.status === 401 || res.status === 403) throw new Error('Cookie Smoobu scaduto — aggiorna SMOOBU_COOKIE su Railway');
    if (!res.ok) throw new Error(`Errore API Smoobu: ${res.status}`);

    const data = await res.json();
    let bookings = [];
    if (data.data && Array.isArray(data.data)) {
      // Costruisce mappa ID property → nome dagli included
      const aptMap = {};
      if (data.included) {
        for (const inc of data.included) {
          aptMap[inc.id] = inc.attributes?.name || inc.attributes?.title || '';
        }
      }
      // Se aptMap è vuoto, carica le properties separatamente
      if (Object.keys(aptMap).length === 0) {
        try {
          const propRes = await fetch('https://login.smoobu.com/api/v2/users/1683032/properties?page[size]=100', { headers });
          if (propRes.ok) {
            const propData = await propRes.json();
            const props = propData.data || propData.properties || [];
            for (const p of props) {
              const pid = p.id;
              const pname = p.attributes?.name || p.name || '';
              if (pid && pname) aptMap[pid] = pname;
            }
            console.log('Smoobu properties:', JSON.stringify(aptMap));
          }
        } catch (e) { console.log('Smoobu properties errore:', e.message); }
      }

      bookings = data.data.map(item => {
        const attr = item.attributes || {};
        // Il nome appartamento è in relationships.property (non apartment!)
        const propId = item.relationships?.property?.data?.id;
        const aptName = aptMap[propId] || attr.apartmentName || attr['apartment-name'] || '';
        const arrival = (attr.arrivalDate || '').slice(0, 10);
        const departure = (attr.departureDate || '').slice(0, 10);
        const numGuests = attr.numberOfGuests || attr.guestCount || attr.adults || 1;
        const stato = attr.status;
        const cancellata = stato === 0 || stato === '0' || String(stato).toLowerCase().includes('cancel');
        return {
          arrival, departure,
          adults: numGuests,
          children: 0,
          status: cancellata ? 'cancelled' : 'confirmed',
          apartment: { name: aptName },
          guestNote: attr.guest?.notes || attr.assistantNotes || null,
        };
      });

      if (data.data[0]) {
        const propId = data.data[0].relationships?.property?.data?.id;
        console.log('Smoobu propId:', propId, '→ name:', aptMap[propId]);
      }
    } else {
      bookings = data.bookings || (Array.isArray(data) ? data : []);
    }
    tuttePrenotazioni.push(...bookings);
    console.log(`Smoobu: pagina ${pagina}, ${bookings.length} prenotazioni`);
    if (bookings.length < 100) break;
    pagina++;
  }

  return tuttePrenotazioni;
};

// GET mapping esistenti
app.get('/api/smoobu/mapping', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, a.nome as appartamento_nome
      FROM smoobu_mapping m
      LEFT JOIN appartamenti a ON m.appartamento_id = a.id
      ORDER BY m.nome_smoobu
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST salva mapping
app.post('/api/smoobu/mapping', async (req, res) => {
  try {
    const { nome_smoobu, appartamento_id } = req.body;
    await pool.query(
      `INSERT INTO smoobu_mapping (nome_smoobu, appartamento_id) VALUES ($1,$2)
       ON CONFLICT (nome_smoobu) DO UPDATE SET appartamento_id=$2`,
      [nome_smoobu, appartamento_id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST anteprima Smoobu (non importa, solo mostra)
app.post('/api/sync/smoobu/anteprima', async (req, res) => {
  try {
    const bookings = await fetchSmoobuBookings();
    const prenotazioni = [];

    for (const b of bookings) {
      const nomeSmoobu = b.apartment?.name || b.property?.name || b.apartmentName || b.unit?.name || '';
      if (!nomeSmoobu) continue;
      const checkIn = b.arrival || b.arrivalDate || b.checkIn || '';
      const checkOut = b.departure || b.departureDate || b.checkOut || '';
      if (!checkIn || !checkOut) continue;
      const stato = b.status || b.bookingStatus || '';
      if (stato.toLowerCase().includes('cancel')) continue;

      const appartamento_id = await trovaTramiteNome(nomeSmoobu);
      const appNome = appartamento_id
        ? (await pool.query('SELECT nome FROM appartamenti WHERE id=$1', [appartamento_id])).rows[0]?.nome
        : null;

      // Controlla se già esistente
      let esistente = false;
      if (appartamento_id) {
        const dup = await pool.query(
          'SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_in=$2 AND check_out=$3',
          [appartamento_id, checkIn, checkOut]
        );
        esistente = dup.rows.length > 0;
      }

      prenotazioni.push({
        nome_smoobu: nomeSmoobu,
        appartamento_id,
        appartamento_nome: appNome,
        check_in: checkIn,
        check_out: checkOut,
        num_ospiti: (parseInt(b.adults) || 0) + (parseInt(b.children) || 0) || 1,
        portale: b.channel?.name || null,
        esistente,
        mappato: !!appartamento_id
      });
    }

    res.json({ prenotazioni, totale: prenotazioni.length });
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

const syncSmoobu = async (soloIds) => {
  const risultati = { importate: 0, saltate: 0, errori: [] };
  try {
    const bookings = await fetchSmoobuBookings();

    for (const b of bookings) {
      try {
        const nomeApp = b.apartment?.name || b.property?.name || b.apartmentName || b.unit?.name || '';
        if (!nomeApp) { risultati.saltate++; continue; }
        const checkIn = b.arrival || b.arrivalDate || b.checkIn || '';
        const checkOut = b.departure || b.departureDate || b.checkOut || '';
        if (!checkIn || !checkOut) { risultati.saltate++; continue; }
        const stato = b.status || b.bookingStatus || '';
        if (stato.toLowerCase().includes('cancel')) { risultati.saltate++; continue; }

        const appartamento_id = await trovaTramiteNome(nomeApp);
        if (!appartamento_id) {
          risultati.saltate++;
          const msg = `Appartamento non trovato: "${nomeApp}"`;
          if (!risultati.errori.includes(msg)) risultati.errori.push(msg);
          continue;
        }

        // Se soloIds specificati, importa solo quelli
        if (soloIds && !soloIds.some(k => k.app_id === appartamento_id && k.check_in === checkIn && k.check_out === checkOut)) {
          risultati.saltate++; continue;
        }

        const numOspiti = (parseInt(b.adults) || 0) + (parseInt(b.children) || 0) || 1;
        const portale = b.channel?.name || null;
        const note = b.guestNote || b.assistantNote || b.notes || null;

        const esistente = await pool.query(
          'SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_in=$2 AND check_out=$3',
          [appartamento_id, checkIn, checkOut]
        );

        if (esistente.rows.length > 0) {
          await pool.query('UPDATE prenotazioni SET num_ospiti=$1 WHERE id=$2', [numOspiti, esistente.rows[0].id]);
          risultati.saltate++;
        } else {
          const noteFinale = [portale, note].filter(v => v && String(v).trim()).join(' | ') || null;
          await pool.query(
            `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, note, stato) VALUES ($1,$2,$3,$4,$5,'confermata')`,
            [appartamento_id, checkIn, checkOut, numOspiti, noteFinale]
          );
          risultati.importate++;
        }
      } catch (err) { risultati.errori.push(`Errore: ${err.message}`); }
    }
  } catch (err) {
    console.error('Smoobu sync errore:', err.message);
    risultati.errori.push(err.message);
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS sync_log (id SERIAL PRIMARY KEY, fonte VARCHAR(50), importate INT, saltate INT, errori TEXT, eseguito_il TIMESTAMP DEFAULT NOW())`).catch(() => {});
  await pool.query(`INSERT INTO sync_log (fonte, importate, saltate, errori) VALUES ($1,$2,$3,$4)`,
    ['smoobu', risultati.importate, risultati.saltate, JSON.stringify(risultati.errori)]).catch(() => {});

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
