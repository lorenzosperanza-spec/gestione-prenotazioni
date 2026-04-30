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
