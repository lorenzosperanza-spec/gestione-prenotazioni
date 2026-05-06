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

// Login a KALISI con Puppeteer (browser headless)
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

    // I campi sono in ordine: org_code, email, password
    const inputs = await page.$$('input[type="text"], input[type="email"], input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"])');
    console.log(`Trovati ${inputs.length} input nel form`);

    // Primo input visibile = org_code, secondo = email, terzo = password
    const visibleInputs = [];
    for (const input of inputs) {
      const visible = await input.isVisible().catch(() => false);
      const type = await input.evaluate(el => el.type);
      if (visible && type !== 'hidden') visibleInputs.push({ input, type });
    }
    console.log(`Input visibili: ${visibleInputs.length}`);

    // Compila in base alla posizione e al tipo
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

    // Click bottone LOGIN
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('button, input[type="submit"]')
    ]);

    const currentUrl = page.url();
    console.log('Puppeteer: dopo login URL:', currentUrl);

    if (currentUrl.includes('sign_in')) {
      throw new Error('Login fallito - ancora sulla pagina di login. Verifica credenziali.');
    }

    // Raccoglie i cookie
    const cookies = await page.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log(`Login KALISI OK via Puppeteer - ${cookies.length} cookie ottenuti`);
    return cookieStr;

  } finally {
    await browser.close();
  }
};

// Funzione core: chiama KALISI e importa le pulizie per un range di date
const syncItalianway = async (giorni = 30) => {
  const risultati = { importate: 0, saltate: 0, errori: [], sincronizzato_il: new Date().toISOString() };

  // Login automatico
  let cookie;
  try {
    cookie = await loginKalisi();
  } catch (loginErr) {
    console.error('Login KALISI fallito:', loginErr.message);
    risultati.errori.push('Login KALISI fallito: ' + loginErr.message);
    return risultati;
  }

  // Usa il Planner che contiene check-in e check-out reali
  try {
    const fine = new Date();
    fine.setDate(fine.getDate() + giorni);
    const startStr = new Date().toISOString().slice(0, 10);
    const endStr = fine.toISOString().slice(0, 10);

    console.log(`Fetch planner: da ${startStr} a ${endStr}`);

    // Prima prova con fetch diretto
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
      // Usa Puppeteer per estrarre gli eventi dal browser
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


  // Salva log sync
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
