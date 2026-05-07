const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connessione database
pool.connect((err, client, release) => {
  if (err) {
    console.error('Errore connessione database:', err.stack);
  } else {
    console.log('Connesso al database PostgreSQL');
    release();
  }
});
pool.query("SELECT current_database()", (err, result) => {
  console.log("BACKEND STA USANDO IL DB:", result?.rows);
});

// Crea tabella dipendenti se non esiste e inserisce seed
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
        ('Marco Bianchi', 40, true),
        ('Sara Ferretti', 30, false),
        ('Luca Moretti', 40, true),
        ('Giulia Ricci', 25, false),
        ('Antonio Esposito', 40, true),
        ('Francesca Romano', 35, false),
        ('Davide Conti', 40, true),
        ('Elena Marchetti', 20, false),
        ('Stefano Lombardi', 40, true),
        ('Valentina Greco', 30, false)
    `);
    console.log('Seed dipendenti inserito');
  }
};
initDipendenti().catch(console.error);



// ============ ROUTES APPARTAMENTI ============

// GET tutti gli appartamenti
app.get('/api/appartamenti', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM appartamenti ORDER BY nome');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel recupero appartamenti' });
  }
});

// GET singolo appartamento
app.get('/api/appartamenti/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM appartamenti WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appartamento non trovato' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel recupero appartamento' });
  }
});

// POST nuovo appartamento
app.post('/api/appartamenti', async (req, res) => {
  try {
    const { owner, gestore, via, nome, prezzo, biancheria, logistica, pulizia, letti_max } = req.body;
    const result = await pool.query(
      `INSERT INTO appartamenti (owner, gestore, via, nome, prezzo, biancheria, logistica, pulizia, letti_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [owner, gestore, via, nome, prezzo, biancheria || 0, logistica || 0, pulizia, letti_max]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: `Esiste già un appartamento con il nome "${req.body.nome}". Usa un nome diverso.` });
    }
    res.status(500).json({ error: 'Errore nella creazione appartamento' });
  }
});

// PUT aggiorna appartamento
app.put('/api/appartamenti/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { owner, gestore, via, nome, prezzo, biancheria, logistica, pulizia, letti_max } = req.body;
    const result = await pool.query(
      `UPDATE appartamenti 
       SET owner=$1, gestore=$2, via=$3, nome=$4, prezzo=$5, biancheria=$6, logistica=$7, pulizia=$8, letti_max=$9
       WHERE id=$10 RETURNING *`,
      [owner, gestore, via, nome, prezzo, biancheria, logistica, pulizia, letti_max, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appartamento non trovato' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: `Esiste già un appartamento con il nome "${req.body.nome}". Usa un nome diverso.` });
    }
    res.status(500).json({ error: 'Errore aggiornamento appartamento' });
  }
});

// DELETE appartamento
app.delete('/api/appartamenti/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM appartamenti WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appartamento non trovato' });
    }
    res.json({ message: 'Appartamento eliminato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nell\'eliminazione appartamento' });
  }
});

// ============ ROUTES PRENOTAZIONI ============

// GET tutte le prenotazioni (con nome appartamento)
app.get('/api/prenotazioni', async (req, res) => {
  try {
    // Aggiunge colonne se non esistono
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS dipendente_id INTEGER`).catch(()=>{});
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS stato_pulizia VARCHAR(20) DEFAULT 'da_fare'`).catch(()=>{});
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS data_pulizia_originale DATE`).catch(()=>{});

    const result = await pool.query(`
      SELECT p.*, a.nome as appartamento_nome, a.via, a.pulizia, a.biancheria, a.logistica,
             d.nome_cognome as dipendente_nome
      FROM prenotazioni p
      LEFT JOIN appartamenti a ON p.appartamento_id = a.id
      LEFT JOIN dipendenti d ON p.dipendente_id = d.id
      ORDER BY p.check_out ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel recupero prenotazioni' });
  }
});

// GET prenotazioni per data (utile per calendario)
app.get('/api/prenotazioni/data/:data', async (req, res) => {
  try {
    const { data } = req.params;
    const result = await pool.query(`
      SELECT p.*, a.nome as appartamento_nome, a.via
      FROM prenotazioni p
      LEFT JOIN appartamenti a ON p.appartamento_id = a.id
      WHERE $1 BETWEEN p.check_in AND p.check_out
      ORDER BY a.nome
    `, [data]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel recupero prenotazioni' });
  }
});

// POST nuova prenotazione
app.post('/api/prenotazioni', async (req, res) => {
  try {
    const { appartamento_id, guest_name, check_in, check_out, num_ospiti, note, stato } = req.body;
    const result = await pool.query(
      `INSERT INTO prenotazioni (appartamento_id, guest_name, check_in, check_out, num_ospiti, note, stato)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [appartamento_id, guest_name || null, check_in, check_out, num_ospiti, note, stato || 'confermata']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nella creazione prenotazione' });
  }
});

// PUT aggiorna prenotazione
app.put('/api/prenotazioni/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { appartamento_id, guest_name, check_in, check_out, num_ospiti, note, stato } = req.body;
    const result = await pool.query(
      `UPDATE prenotazioni 
       SET appartamento_id = $1, guest_name = $2, check_in = $3, check_out = $4, 
           num_ospiti = $5, note = $6, stato = $7
       WHERE id = $8 RETURNING *`,
      [appartamento_id, guest_name, check_in, check_out, num_ospiti, note, stato, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prenotazione non trovata' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento prenotazione' });
  }
});

// DELETE prenotazione
app.delete('/api/prenotazioni/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM prenotazioni WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prenotazione non trovata' });
    }
    res.json({ message: 'Prenotazione eliminata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nell\'eliminazione prenotazione' });
  }
});

// ============ ROUTES DIPENDENTI ============

// GET tutti i dipendenti
app.get('/api/dipendenti', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dipendenti ORDER BY nome_cognome');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel recupero dipendenti' });
  }
});

// POST nuovo dipendente
app.post('/api/dipendenti', async (req, res) => {
  try {
    const { nome_cognome, ore_settimanali, patente } = req.body;
    const result = await pool.query(
      `INSERT INTO dipendenti (nome_cognome, ore_settimanali, patente) VALUES ($1, $2, $3) RETURNING *`,
      [nome_cognome, ore_settimanali || null, patente || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nella creazione dipendente' });
  }
});

// PUT aggiorna dipendente
app.put('/api/dipendenti/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome_cognome, ore_settimanali, patente } = req.body;
    const result = await pool.query(
      `UPDATE dipendenti SET nome_cognome=$1, ore_settimanali=$2, patente=$3 WHERE id=$4 RETURNING *`,
      [nome_cognome, ore_settimanali || null, patente || false, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dipendente non trovato' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore aggiornamento dipendente' });
  }
});

// DELETE dipendente
app.delete('/api/dipendenti/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM dipendenti WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dipendente non trovato' });
    res.json({ message: 'Dipendente eliminato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore eliminazione dipendente' });
  }
});

// ============ ROUTES PULIZIE (assegnazione + stato) ============

// PATCH assegna dipendente a una prenotazione
app.patch('/api/prenotazioni/:id/assegna', async (req, res) => {
  try {
    const { id } = req.params;
    const { dipendente_id } = req.body;
    
    // Aggiunge colonna se non esiste (prima volta)
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS dipendente_id INTEGER`);
    
    const result = await pool.query(
      `UPDATE prenotazioni SET dipendente_id=$1 WHERE id=$2 RETURNING *`,
      [dipendente_id || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prenotazione non trovata' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH aggiorna stato pulizia (completata / posticipata / da_fare)
app.patch('/api/prenotazioni/:id/stato-pulizia', async (req, res) => {
  try {
    const { id } = req.params;
    const { stato_pulizia, nuova_data } = req.body;

    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS stato_pulizia VARCHAR(20) DEFAULT 'da_fare'`);
    await pool.query(`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS data_pulizia_originale DATE`);

    // Se posticipata, salva la data originale e sposta il check_out
    if (stato_pulizia === 'posticipata' && nuova_data) {
      const orig = await pool.query(`SELECT check_out, data_pulizia_originale FROM prenotazioni WHERE id=$1`, [id]);
      const dataOriginale = orig.rows[0]?.data_pulizia_originale || orig.rows[0]?.check_out;
      await pool.query(
        `UPDATE prenotazioni SET stato_pulizia=$1, check_out=$2, data_pulizia_originale=$3 WHERE id=$4`,
        [stato_pulizia, nuova_data, dataOriginale, id]
      );
    } else {
      await pool.query(
        `UPDATE prenotazioni SET stato_pulizia=$1 WHERE id=$2`,
        [stato_pulizia, id]
      );
    }

    const result = await pool.query(`SELECT * FROM prenotazioni WHERE id=$1`, [id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ GMAIL AUTH & SYNC ============

const { google } = (() => { try { return require('googleapis'); } catch(e) { return { google: null }; } })();

const getGoogleOAuth2Client = () => {
  if (!google) throw new Error('googleapis non installato');
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://gestione-prenotazioni-production.up.railway.app/auth/google/callback'
  );
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  }
  return client;
};

// Step 1: Redirect a Google per autorizzazione
app.get('/auth/google', (req, res) => {
  try {
    const oauth2Client = getGoogleOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.modify']
    });
    res.redirect(url);
  } catch (err) {
    res.status(500).send('Errore: ' + err.message);
  }
});

// Step 2: Google ci manda il codice, lo scambiamo con token
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const oauth2Client = getGoogleOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    console.log('GOOGLE_REFRESH_TOKEN:', tokens.refresh_token);
    res.send(`
      <h2>✅ Autenticazione Gmail completata!</h2>
      <p>Copia questo refresh token e aggiungilo come variabile <strong>GOOGLE_REFRESH_TOKEN</strong> su Railway:</p>
      <textarea rows="4" cols="80" style="font-size:12px">${tokens.refresh_token}</textarea>
      <p>Poi chiudi questa pagina e torna al gestionale.</p>
    `);
  } catch (err) {
    res.status(500).send('Errore callback: ' + err.message);
  }
});

// Processa email con Claude AI
const processaEmailConClaude = async (emailText, mittente, oggetto) => {
  try {
    const annoCorrente = new Date().getFullYear();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Sei un assistente che estrae prenotazioni di pulizie da email italiane.

Analizza questa email e rispondi SOLO con un JSON valido, nessun testo prima o dopo.

Oggetto: ${oggetto}
Mittente: ${mittente}
Testo completo:
${emailText}

ISTRUZIONI:
- Le email contengono liste di prenotazioni per appartamenti
- Il formato tipico è: NOME APPARTAMENTO: seguito da righe con date GG/MM - GG/MM (xN) dove N = numero ospiti
- Le date sono nel formato GG/MM senza anno — usa sempre l'anno ${annoCorrente}
- Ogni riga di date è una prenotazione separata
- Se oggetto contiene "CANCELLAZIONE" o il testo dice di cancellare, usa azione "cancella"
- Altrimenti usa azione "nuova"
- Estrai TUTTE le prenotazioni di TUTTI gli appartamenti nell'email

Esempio input:
CIPRO VATICAN HOME:
29/04 - 02/05 (x4)
02/05 - 05/05 (x2)

DA BRICCA A MONTEVERDE:
27/04 - 06/05 (x3)

Esempio output:
{"rilevante": true, "prenotazioni": [
  {"appartamento": "CIPRO VATICAN HOME", "check_in": "${annoCorrente}-04-29", "check_out": "${annoCorrente}-05-02", "ospiti": 4, "azione": "nuova"},
  {"appartamento": "CIPRO VATICAN HOME", "check_in": "${annoCorrente}-05-02", "check_out": "${annoCorrente}-05-05", "ospiti": 2, "azione": "nuova"},
  {"appartamento": "DA BRICCA A MONTEVERDE", "check_in": "${annoCorrente}-04-27", "check_out": "${annoCorrente}-05-06", "ospiti": 3, "azione": "nuova"}
]}

Se l'email non contiene prenotazioni (es. email commerciale, newsletter), rispondi con:
{"rilevante": false, "prenotazioni": []}`
        }]
      })
    });
    const data = await response.json();
    if (data.error) {
      console.error('Claude API error:', JSON.stringify(data.error));
      return { prenotazioni: [], rilevante: false };
    }
    const text = data.content?.[0]?.text || '{}';
    console.log('Claude risposta:', text.slice(0, 300));
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Errore Claude:', err.message);
    return { prenotazioni: [], rilevante: false };
  }
};

// Legge email non lette e le processa
const syncEmail = async () => {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return { errore: 'GOOGLE_REFRESH_TOKEN non configurato. Vai su /auth/google per autorizzare.' };
  }

  const risultati = { processate: 0, importate: 0, cancellate: 0, saltate: 0, errori: [] };

  try {
    const oauth2Client = getGoogleOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Legge ultime 20 email non lette (tutte le tab)
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults: 20
    });

    const messages = listRes.data.messages || [];
    console.log(`Gmail sync: ${messages.length} email non lette`);

    for (const msg of messages) {
      try {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });

        const headers = email.data.payload.headers;
        const oggetto = headers.find(h => h.name === 'Subject')?.value || '';
        const mittente = headers.find(h => h.name === 'From')?.value || '';

        // Estrae testo dall'email (plain text o HTML)
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
        
        if (email.data.payload.parts) {
          extractText(email.data.payload.parts);
        } else if (email.data.payload.body?.data) {
          const raw = Buffer.from(email.data.payload.body.data, 'base64').toString('utf-8');
          testo = email.data.payload.mimeType === 'text/html' 
            ? raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
            : raw;
        }

        console.log(`Email da "${mittente}" - oggetto: "${oggetto}" - testo (primi 200 char): ${testo.slice(0, 200)}`);

        if (!testo.trim()) { risultati.saltate++; continue; }

        // Passa a Claude per interpretazione
        const parsed = await processaEmailConClaude(testo, mittente, oggetto);
        risultati.processate++;

        if (!parsed.rilevante || !parsed.prenotazioni?.length) {
          risultati.saltate++;
          // Segna come letta
          await gmail.users.messages.modify({
            userId: 'me', id: msg.id,
            requestBody: { removeLabelIds: ['UNREAD'] }
          });
          continue;
        }

        for (const pren of parsed.prenotazioni) {
          try {
            const appRes = await pool.query(
              'SELECT id FROM appartamenti WHERE LOWER(nome) = LOWER($1) LIMIT 1',
              [pren.appartamento]
            );

            if (appRes.rows.length === 0) {
              // Prova match parziale
              const appResPartial = await pool.query(
                'SELECT id, nome FROM appartamenti WHERE LOWER(nome) LIKE LOWER($1) LIMIT 1',
                [`%${pren.appartamento}%`]
              );
              if (appResPartial.rows.length === 0) {
                risultati.errori.push(`Appartamento non trovato: "${pren.appartamento}"`);
                continue;
              }
              pren._appartamento_id = appResPartial.rows[0].id;
              console.log(`Match parziale: "${pren.appartamento}" -> "${appResPartial.rows[0].nome}"`);
            }

            const appartamento_id = pren._appartamento_id || appRes.rows[0]?.id;

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
                await pool.query(
                  'UPDATE prenotazioni SET num_ospiti=$1 WHERE id=$2',
                  [pren.ospiti || 1, esistente.rows[0].id]
                );
              } else {
                await pool.query(
                  `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, stato)
                   VALUES ($1,$2,$3,$4,'confermata')`,
                  [appartamento_id, pren.check_in, pren.check_out, pren.ospiti || 1]
                );
                risultati.importate++;
              }
            }
          } catch (err) {
            risultati.errori.push(`Errore prenotazione: ${err.message}`);
          }
        }

        // Segna email come letta
        await gmail.users.messages.modify({
          userId: 'me', id: msg.id,
          requestBody: { removeLabelIds: ['UNREAD'] }
        });

      } catch (err) {
        risultati.errori.push(`Errore email: ${err.message}`);
      }
    }
  } catch (err) {
    risultati.errori.push(`Errore Gmail: ${err.message}`);
  }

  return risultati;
};

// POST anteprima email (legge e analizza senza importare)
app.post('/api/sync/email/preview', async (req, res) => {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return res.json({ errore: 'GOOGLE_REFRESH_TOKEN non configurato. Vai su /auth/google per autorizzare.' });
  }
  try {
    const oauth2Client = getGoogleOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const listRes = await gmail.users.messages.list({
      userId: 'me', q: 'is:unread in:inbox', maxResults: 20
    });
    const messages = listRes.data.messages || [];
    console.log(`Anteprima email: ${messages.length} email non lette`);

    const tuttePrenotazioni = [];
    const errori = [];
    const msgIds = [];

    for (const msg of messages) {
      try {
        const email = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
        const headers = email.data.payload.headers;
        const oggetto = headers.find(h => h.name === 'Subject')?.value || '';
        const mittente = headers.find(h => h.name === 'From')?.value || '';

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

        if (!testo.trim()) continue;

        const parsed = await processaEmailConClaude(testo, mittente, oggetto);
        if (parsed.rilevante && parsed.prenotazioni?.length) {
          tuttePrenotazioni.push(...parsed.prenotazioni);
          msgIds.push(msg.id);
          // Controlla appartamenti non trovati
          for (const p of parsed.prenotazioni) {
            const appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome) = LOWER($1) LIMIT 1', [p.appartamento]);
            if (appRes.rows.length === 0) {
              const appPartial = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome) LIKE LOWER($1) LIMIT 1', [`%${p.appartamento}%`]);
              if (appPartial.rows.length === 0 && !errori.includes(`"${p.appartamento}" non trovato nel DB`)) {
                errori.push(`"${p.appartamento}" non trovato nel DB`);
              }
            }
          }
        }
      } catch (err) {
        errori.push(`Errore email: ${err.message}`);
      }
    }

    res.json({
      emailAnalizzate: messages.length,
      prenotazioni: tuttePrenotazioni,
      msgIds,
      errori
    });
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// POST conferma import email (importa solo le prenotazioni selezionate e segna email come lette)
app.post('/api/sync/email/confirm', async (req, res) => {
  const { prenotazioni, msgIds } = req.body;
  if (!prenotazioni || !Array.isArray(prenotazioni)) {
    return res.status(400).json({ errore: 'Dati non validi' });
  }

  const risultati = { importate: 0, cancellate: 0, errori: [] };

  for (const pren of prenotazioni) {
    try {
      const appRes = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome) = LOWER($1) LIMIT 1', [pren.appartamento]);
      let appartamento_id = appRes.rows[0]?.id;

      if (!appartamento_id) {
        const appPartial = await pool.query('SELECT id FROM appartamenti WHERE LOWER(nome) LIKE LOWER($1) LIMIT 1', [`%${pren.appartamento}%`]);
        appartamento_id = appPartial.rows[0]?.id;
      }

      if (!appartamento_id) {
        risultati.errori.push(`Appartamento non trovato: "${pren.appartamento}"`);
        continue;
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

  // Segna tutte le email elaborate come lette
  if (process.env.GOOGLE_REFRESH_TOKEN && msgIds?.length) {
    try {
      const oauth2Client = getGoogleOAuth2Client();
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      for (const id of msgIds) {
        await gmail.users.messages.modify({
          userId: 'me', id,
          requestBody: { removeLabelIds: ['UNREAD'] }
        }).catch(() => {});
      }
    } catch {}
  }

  res.json(risultati);
});

// Aggiungi sync email al cron (ogni ora)
setInterval(async () => {
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    console.log('Cron sync email avviato');
    const r = await syncEmail().catch(e => ({ errore: e.message }));
    console.log('Cron sync email:', JSON.stringify(r));
  }
}, 60 * 60 * 1000); // ogni ora

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Avvio server
app.listen(port, () => {
  console.log(`Server in esecuzione sulla porta ${port}`);
});

// ============ IMPORT ITALIANWAY ============
app.post('/api/import/italianway', async (req, res) => {
  const { righe } = req.body;
  if (!righe || !Array.isArray(righe)) {
    return res.status(400).json({ error: 'Dati non validi' });
  }

  const risultati = { importate: 0, saltate: 0, errori: [] };

  for (const r of righe) {
    try {
      const { appartamento, check_out, check_in, ospiti_entranti, ospiti_uscenti, note, categoria, api_id } = r;

      const appRes = await pool.query(
        `SELECT id, nome FROM appartamenti WHERE LOWER(nome) = LOWER($1) LIMIT 1`,
        [appartamento]
      );

      if (appRes.rows.length === 0) {
        risultati.saltate++;
        risultati.errori.push(`Appartamento non trovato: "${appartamento}"`);
        continue;
      }

      const appartamento_id = appRes.rows[0].id;

      const esistente = await pool.query(
        `SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_out=$2`,
        [appartamento_id, check_out]
      );

      if (esistente.rows.length > 0) {
        risultati.saltate++;
        continue;
      }

      await pool.query(
        `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, note, stato)
         VALUES ($1, $2, $3, $4, $5, 'confermata')`,
        [
          appartamento_id,
          check_in || check_out,
          check_out,
          ospiti_entranti || ospiti_uscenti || 1,
          [categoria, note].filter(v => v && v !== '-').join(' | ') || null
        ]
      );

      risultati.importate++;
    } catch (err) {
      console.error('Errore import riga:', err);
      risultati.errori.push(`Errore su "${r.appartamento}": ${err.message}`);
    }
  }

  res.json(risultati);
});


// ============ SYNC ITALIANWAY ============

const loginKalisi = async () => {
  const email = process.env.ITALIANWAY_EMAIL;
  const password = process.env.ITALIANWAY_PASSWORD;
  const orgCode = process.env.ITALIANWAY_ORG || 'CG-001';
  if (!email || !password) throw new Error('ITALIANWAY_EMAIL o ITALIANWAY_PASSWORD non configurati');

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch(e) {
    throw new Error('Puppeteer non installato: ' + e.message);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

    console.log('Puppeteer: apertura pagina login KALISI...');
    await page.goto('https://www.italianway.house/admin/sign_in', { waitUntil: 'networkidle2', timeout: 30000 });

    const inputs = await page.$$('input[type="text"], input[type="email"], input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"])');
    console.log(`Trovati ${inputs.length} input nel form`);

    const visibleInputs = [];
    for (const input of inputs) {
      const visible = await input.isVisible().catch(() => false);
      const type = await input.evaluate(el => el.type);
      if (visible && type !== 'hidden') visibleInputs.push({ input, type });
    }
    console.log(`Input visibili: ${visibleInputs.length}`);

    for (let i = 0; i < visibleInputs.length; i++) {
      const { input, type } = visibleInputs[i];
      await input.click({ clickCount: 3 });
      if (type === 'password') {
        await input.type(password);
      } else if (i === 0) {
        await input.type(orgCode);
      } else if (i === 1 || type === 'email') {
        await input.type(email);
      }
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('button, input[type="submit"]')
    ]);

    const currentUrl = page.url();
    console.log('Puppeteer: dopo login URL:', currentUrl);

    if (currentUrl.includes('sign_in')) {
      throw new Error('Login fallito - ancora sulla pagina di login. Verifica credenziali.');
    }

    const cookies = await page.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log(`Login KALISI OK via Puppeteer - ${cookies.length} cookie ottenuti`);
    return cookieStr;

  } finally {
    await browser.close();
  }
};

const syncItalianway = async (giorni = 30) => {
  const risultati = { importate: 0, saltate: 0, errori: [], sincronizzato_il: new Date().toISOString() };

  let cookie;
  try {
    cookie = await loginKalisi();
  } catch (loginErr) {
    console.error('Login KALISI fallito:', loginErr.message);
    risultati.errori.push('Login KALISI fallito: ' + loginErr.message);
    return risultati;
  }

  try {
    const fine = new Date();
    fine.setDate(fine.getDate() + giorni);
    const startStr = new Date().toISOString().slice(0, 10);
    const endStr = fine.toISOString().slice(0, 10);

    console.log(`Fetch planner: da ${startStr} a ${endStr}`);

    let events = [];
    const plannerRes = await fetch(
      `https://www.italianway.house/admin/housecleanings/planner_dhx?from=${startStr}&to=${endStr}`,
      {
        headers: {
          'Cookie': cookie,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.italianway.house/admin/housecleanings/planner_dhx',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    const ct = plannerRes.headers.get('content-type') || '';
    if (plannerRes.ok && ct.includes('json')) {
      const json = await plannerRes.json();
      events = Array.isArray(json) ? json : (json.data || []);
      console.log(`Planner JSON: ${events.length} eventi`);
    } else {
      console.log('Planner non JSON, uso Puppeteer...');
      const puppeteer2 = require('puppeteer');
      const browser2 = await puppeteer2.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      try {
        const page2 = await browser2.newPage();
        for (const cp of cookie.split('; ')) {
          const idx = cp.indexOf('=');
          if (idx > 0) {
            const name = cp.slice(0, idx).trim();
            const value = cp.slice(idx + 1).trim();
            await page2.setCookie({ name, value, domain: 'www.italianway.house' }).catch(() => {});
          }
        }
        await page2.goto('https://www.italianway.house/admin/housecleanings/planner_dhx', {
          waitUntil: 'networkidle2', timeout: 30000
        });
        events = await page2.evaluate(() => {
          try { return scheduler.getEvents(); } catch(e) { return []; }
        });
        console.log(`Puppeteer planner: ${events.length} eventi`);
      } finally {
        await browser2.close();
      }
    }

    for (const ev of events) {
      try {
        const nomeAppartamento = (ev.apt_name || '').trim();
        if (!nomeAppartamento) continue;

        const checkInStr = new Date(ev.start_date).toISOString().slice(0, 10);
        const checkOutStr = new Date(ev.end_date).toISOString().slice(0, 10);
        const ospiti = parseInt(ev.pax) || 1;
        const note = ev.notes && ev.notes.trim() !== 'RESERVATION' ? ev.notes.trim() : null;

        const appRes = await pool.query(
          'SELECT id FROM appartamenti WHERE LOWER(nome) = LOWER($1) LIMIT 1',
          [nomeAppartamento]
        );

        if (appRes.rows.length === 0) {
          risultati.saltate++;
          if (!risultati.errori.includes(`Appartamento non trovato: "${nomeAppartamento}"`)) {
            risultati.errori.push(`Appartamento non trovato: "${nomeAppartamento}"`);
          }
          continue;
        }

        const appartamento_id = appRes.rows[0].id;

        const esistente = await pool.query(
          'SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_in=$2 AND check_out=$3',
          [appartamento_id, checkInStr, checkOutStr]
        );

        if (esistente.rows.length > 0) {
          await pool.query(
            'UPDATE prenotazioni SET num_ospiti=$1 WHERE appartamento_id=$2 AND check_in=$3 AND check_out=$4',
            [ospiti, appartamento_id, checkInStr, checkOutStr]
          );
          risultati.saltate++;
          continue;
        }

        await pool.query(
          `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, note, stato) VALUES ($1,$2,$3,$4,$5,'confermata')`,
          [appartamento_id, checkInStr, checkOutStr, ospiti, note]
        );
        risultati.importate++;

      } catch (err) {
        risultati.errori.push(`Errore evento: ${err.message}`);
      }
    }

  } catch (err) {
    risultati.errori.push(`Errore planner: ${err.message}`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id SERIAL PRIMARY KEY,
      fonte VARCHAR(50),
      importate INT,
      saltate INT,
      errori TEXT,
      eseguito_il TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(
    `INSERT INTO sync_log (fonte, importate, saltate, errori) VALUES ($1,$2,$3,$4)`,
    ['italianway', risultati.importate, risultati.saltate, JSON.stringify(risultati.errori)]
  );

  return risultati;
};

// POST manuale sync
app.post('/api/sync/italianway', async (req, res) => {
  try {
    const giorni = parseInt(req.query.giorni) || 30;
    console.log(`Sync ItalianWay avviato: prossimi ${giorni} giorni`);
    const risultati = await syncItalianway(giorni);
    res.json(risultati);
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET status ultimi sync
app.get('/api/sync/status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM sync_log ORDER BY eseguito_il DESC LIMIT 5`
    );
    res.json(result.rows);
  } catch {
    res.json([]);
  }
});

// ============ CRON JOB ============
const scheduleCron = () => {
  const checkCron = () => {
    const now = new Date();
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    if ((h === 2 || h === 7) && m === 0) {
      console.log(`Cron sync ItalianWay avviato alle ${now.toISOString()}`);
      syncItalianway(30).then(r => {
        console.log(`Cron sync completato: ${r.importate} importate, ${r.saltate} saltate`);
      }).catch(err => {
        console.error('Cron sync errore:', err.message);
      });
    }
  };
  setInterval(checkCron, 60000);
  console.log('Cron job ItalianWay attivo (02:00 e 07:00 UTC)');
};

scheduleCron();
