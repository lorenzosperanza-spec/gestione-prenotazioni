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
    const result = await pool.query(`
      SELECT p.*, a.nome as appartamento_nome, a.via, a.pulizia, a.biancheria, a.logistica
      FROM prenotazioni p
      LEFT JOIN appartamenti a ON p.appartamento_id = a.id
      ORDER BY p.check_in DESC
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

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Avvio server
app.listen(port, () => {
  console.log(`Server in esecuzione sulla porta ${port}`);
});

// ============ IMPORT ITALIANWAY ============
// Riceve array di righe dal frontend (già parsato da xlsx.js) e crea prenotazioni
app.post('/api/import/italianway', async (req, res) => {
  const { righe } = req.body;
  if (!righe || !Array.isArray(righe)) {
    return res.status(400).json({ error: 'Dati non validi' });
  }

  const risultati = { importate: 0, saltate: 0, errori: [] };

  for (const r of righe) {
    try {
      const { appartamento, check_out, check_in, ospiti_entranti, ospiti_uscenti, note, categoria, api_id } = r;

      // Cerca appartamento per nome (match parziale)
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

      // Controlla se esiste già una prenotazione con stesso appartamento e check_out
      const esistente = await pool.query(
        `SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_out=$2`,
        [appartamento_id, check_out]
      );

      if (esistente.rows.length > 0) {
        risultati.saltate++;
        continue; // già importata, skip
      }

      // Inserisce la prenotazione
      await pool.query(
        `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, note, stato)
         VALUES ($1, $2, $3, $4, $5, 'confermata')`,
        [
          appartamento_id,
          check_in || check_out, // se non c'è check_in usa check_out
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

// Funzione core: chiama KALISI e importa le pulizie per un range di date
const syncItalianway = async (giorni = 30) => {
  const cookie = process.env.ITALIANWAY_COOKIE;
  if (!cookie) throw new Error('ITALIANWAY_COOKIE non configurato nelle variabili d\'ambiente');

  const risultati = { importate: 0, saltate: 0, errori: [], sincronizzato_il: new Date().toISOString() };

  // Login automatico con email+password
  let cookie;
  try {
    cookie = await loginKalisi();
  } catch (loginErr) {
    console.error('Login KALISI fallito:', loginErr.message);
    risultati.errori.push('Login KALISI fallito: ' + loginErr.message);
    return risultati;
  }

  // Genera date da oggi a oggi+giorni
  const dates = [];
  for (let i = 0; i <= giorni; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    dates.push(`${dd}/${mm}/${yyyy}`);
  }

  for (const dateStr of dates) {
    try {
      const params = new URLSearchParams({
        draw: '1',
        'columns[0][data]': '',
        'columns[2][data]': 'ext_id',
        'columns[3][data]': 'apt_code',
        'columns[4][data]': 'apartment_name',
        'columns[6][data]': 'housecleaning_category',
        'columns[7][data]': 'notes',
        'columns[8][data]': 'due_date.display',
        'columns[12][data]': 'pax',
        'columns[13][data]': 'next_checkin_datetime.display',
        'columns[14][data]': 'next_checkin_pax',
        'order[0][column]': '0',
        'order[0][dir]': 'desc',
        'start': '0',
        'length': '100',
        'search[value]': '',
        'search[regex]': 'false',
        'custom_search[date]': dateStr,
        'custom_search[housekeeper_id]': '',
        'custom_search[cleaner_id]': '',
        'custom_search[include_backlog]': '0',
        '_': Date.now().toString()
      });

      const response = await fetch(
        `https://www.italianway.house/admin/housecleanings?${params}`,
        {
          headers: {
            'Cookie': cookie,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.italianway.house/admin/housecleanings',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error(`KALISI ${dateStr}: HTTP ${response.status} - ${body.slice(0, 200)}`);
        risultati.errori.push(`${dateStr}: HTTP ${response.status}`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        const body = await response.text().catch(() => '');
        console.error(`KALISI ${dateStr}: risposta non-JSON (${contentType}) - ${body.slice(0, 200)}`);
        risultati.errori.push(`${dateStr}: risposta non-JSON - probabilmente redirect al login`);
        continue;
      }

      const json = await response.json();
      console.log(`KALISI ${dateStr}: ${json.recordsTotal || 0} pulizie trovate`);
      if (!json.data) continue;

      for (const r of json.data) {
        try {
          // Estrae nome appartamento dal tag <a>
          const nomeMatch = r.apartment_name?.match(/>(.*?)<\/a>/);
          const nomeAppartamento = nomeMatch ? nomeMatch[1].trim() : '';
          if (!nomeAppartamento) continue;

          // Data check-out da due_date.timestamp (unix seconds)
          const checkOutTs = r.due_date?.timestamp;
          if (!checkOutTs) continue;
          const checkOutDate = new Date(checkOutTs * 1000);
          const checkOutStr = checkOutDate.toISOString().slice(0, 10);

          // Data prossimo check-in
          const nextCiTs = r.next_checkin_datetime?.timestamp;
          const nextCiStr = nextCiTs ? new Date(nextCiTs * 1000).toISOString().slice(0, 10) : null;

          const ospiti_entranti = parseInt(r.next_checkin_pax) || 0;
          const note = r.notes && r.notes !== '-' ? r.notes : null;
          const categoria = r.housecleaning_category || null;

          // Cerca appartamento per nome esatto o parziale
          const appRes = await pool.query(
            `SELECT id FROM appartamenti WHERE LOWER(nome) = LOWER($1) LIMIT 1`,
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

          // Evita duplicati: stesso appartamento + check_out
          const esistente = await pool.query(
            `SELECT id FROM prenotazioni WHERE appartamento_id=$1 AND check_out=$2`,
            [appartamento_id, checkOutStr]
          );

          if (esistente.rows.length > 0) {
            // Aggiorna gli ospiti se cambiati
            await pool.query(
              `UPDATE prenotazioni SET num_ospiti=$1 WHERE appartamento_id=$2 AND check_out=$3`,
              [ospiti_entranti || 1, appartamento_id, checkOutStr]
            );
            risultati.saltate++;
            continue;
          }

          await pool.query(
            `INSERT INTO prenotazioni (appartamento_id, check_in, check_out, num_ospiti, note, stato)
             VALUES ($1, $2, $3, $4, $5, 'confermata')`,
            [
              appartamento_id,
              nextCiStr || checkOutStr,
              checkOutStr,
              ospiti_entranti || 1,
              [categoria, note].filter(Boolean).join(' | ') || null
            ]
          );
          risultati.importate++;

        } catch (err) {
          risultati.errori.push(`Errore riga: ${err.message}`);
        }
      }

      // Pausa breve tra le date per non sovraccaricare il server
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      risultati.errori.push(`Errore data ${dateStr}: ${err.message}`);
    }
  }

  // Salva timestamp ultimo sync nel DB
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

// POST manuale: triggera sync da frontend
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

// GET ultimo sync
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
// Sync automatico ogni giorno alle 02:00 e alle 07:00 (ora server UTC)
const scheduleCron = () => {
  const checkCron = () => {
    const now = new Date();
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    // 02:00 UTC = 04:00 Roma, 07:00 UTC = 09:00 Roma
    if ((h === 2 || h === 7) && m === 0) {
      console.log(`Cron sync ItalianWay avviato alle ${now.toISOString()}`);
      syncItalianway(30).then(r => {
        console.log(`Cron sync completato: ${r.importate} importate, ${r.saltate} saltate`);
      }).catch(err => {
        console.error('Cron sync errore:', err.message);
      });
    }
  };
  // Controlla ogni minuto
  setInterval(checkCron, 60000);
  console.log('Cron job ItalianWay attivo (02:00 e 07:00 UTC)');
};

scheduleCron();
