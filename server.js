// server.js - Entry point
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ============================================
// API ENDPOINTS - APPARTAMENTI
// ============================================

// Lista appartamenti
app.get('/api/appartamenti', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM appartamenti WHERE attivo = true ORDER BY nome'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crea appartamento
app.post('/api/appartamenti', async (req, res) => {
    const { nome, indirizzo, zona, cliente_nome, cliente_email, cliente_telefono, note, tempo_pulizia_stimato, richiede_motorino } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO appartamenti (nome, indirizzo, zona, cliente_nome, cliente_email, cliente_telefono, note, tempo_pulizia_stimato, richiede_motorino)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [nome, indirizzo, zona, cliente_nome, cliente_email, cliente_telefono, note, tempo_pulizia_stimato || 90, richiede_motorino || false]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API ENDPOINTS - DIPENDENTI
// ============================================

app.get('/api/dipendenti', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM dipendenti WHERE attivo = true ORDER BY cognome, nome'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/dipendenti', async (req, res) => {
    const { nome, cognome, telefono, email, ha_patente, mezzo_trasporto, zone_competenza } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO dipendenti (nome, cognome, telefono, email, ha_patente, mezzo_trasporto, zone_competenza)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [nome, cognome, telefono, email, ha_patente, mezzo_trasporto || 'bicicletta', zone_competenza || []]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API ENDPOINTS - PRENOTAZIONI
// ============================================

// Lista prenotazioni con filtri
app.get('/api/prenotazioni', async (req, res) => {
    const { data_da, data_a, appartamento_id } = req.query;
    try {
        let query = `
            SELECT p.*, a.nome as appartamento_nome, a.indirizzo as appartamento_indirizzo
            FROM prenotazioni p
            JOIN appartamenti a ON p.appartamento_id = a.id
            WHERE 1=1
        `;
        const params = [];
        
        if (data_da) {
            params.push(data_da);
            query += ` AND p.data_checkout >= $${params.length}`;
        }
        if (data_a) {
            params.push(data_a);
            query += ` AND p.data_checkin <= $${params.length}`;
        }
        if (appartamento_id) {
            params.push(appartamento_id);
            query += ` AND p.appartamento_id = $${params.length}`;
        }
        
        query += ' ORDER BY p.data_checkin';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crea prenotazione manuale
app.post('/api/prenotazioni', async (req, res) => {
    const { appartamento_id, data_checkin, data_checkout, ora_checkin, ora_checkout, numero_ospiti, nome_ospite, note } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO prenotazioni (appartamento_id, data_checkin, data_checkout, ora_checkin, ora_checkout, numero_ospiti, nome_ospite, fonte, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'manuale', $8) RETURNING *`,
            [appartamento_id, data_checkin, data_checkout, ora_checkin || '15:00', ora_checkout || '10:00', numero_ospiti || 2, nome_ospite, note]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API ENDPOINTS - PULIZIE
// ============================================

// Dashboard pulizie giornaliere
app.get('/api/pulizie/giorno/:data', async (req, res) => {
    const { data } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM v_pulizie_giornaliere WHERE data_programmata = $1 ORDER BY priorita, ora_inizio_prevista`,
            [data]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Pulizie da assegnare
app.get('/api/pulizie/da-assegnare', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM v_pulizie_giornaliere 
             WHERE stato = 'da_assegnare' 
             AND data_programmata >= CURRENT_DATE
             ORDER BY data_programmata, priorita`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Assegna pulizia a dipendente
app.put('/api/pulizie/:id/assegna', async (req, res) => {
    const { id } = req.params;
    const { dipendente_id, motorino_id, ora_inizio_prevista } = req.body;
    try {
        const result = await pool.query(
            `UPDATE pulizie 
             SET dipendente_id = $1, motorino_id = $2, ora_inizio_prevista = $3, stato = 'assegnata', updated_at = NOW()
             WHERE id = $4 RETURNING *`,
            [dipendente_id, motorino_id, ora_inizio_prevista, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Posticipa pulizia
app.put('/api/pulizie/:id/posticipa', async (req, res) => {
    const { id } = req.params;
    const { nuova_data, motivo } = req.body;
    try {
        const result = await pool.query(
            `UPDATE pulizie 
             SET data_programmata = $1, posticipata = true, motivo_posticipo = $2, updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [nuova_data, motivo, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Aggiorna stato pulizia (per dipendenti)
app.put('/api/pulizie/:id/stato', async (req, res) => {
    const { id } = req.params;
    const { stato, note_dipendente } = req.body;
    try {
        let updateFields = ['stato = $1', 'updated_at = NOW()'];
        let params = [stato];
        
        if (stato === 'in_corso') {
            updateFields.push('ora_inizio_effettiva = NOW()');
        } else if (stato === 'completata') {
            updateFields.push('ora_fine_effettiva = NOW()');
        }
        
        if (note_dipendente) {
            params.push(note_dipendente);
            updateFields.push(`note_dipendente = $${params.length}`);
        }
        
        params.push(id);
        
        const result = await pool.query(
            `UPDATE pulizie SET ${updateFields.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Pulizie assegnate a un dipendente (per app mobile)
app.get('/api/dipendenti/:id/pulizie', async (req, res) => {
    const { id } = req.params;
    const { data } = req.query;
    try {
        const result = await pool.query(
            `SELECT * FROM v_pulizie_giornaliere 
             WHERE dipendente_id = $1 
             AND data_programmata = $2
             AND stato IN ('assegnata', 'in_corso')
             ORDER BY ora_inizio_prevista`,
            [id, data || new Date().toISOString().split('T')[0]]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API ENDPOINTS - STATISTICHE
// ============================================

app.get('/api/statistiche/overview', async (req, res) => {
    try {
        const oggi = new Date().toISOString().split('T')[0];
        
        const [pulizieOggi, daAssegnare, completateOggi, appartamentiAttivi] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM pulizie WHERE data_programmata = $1`, [oggi]),
            pool.query(`SELECT COUNT(*) FROM pulizie WHERE stato = 'da_assegnare' AND data_programmata >= $1`, [oggi]),
            pool.query(`SELECT COUNT(*) FROM pulizie WHERE stato = 'completata' AND data_programmata = $1`, [oggi]),
            pool.query(`SELECT COUNT(*) FROM appartamenti WHERE attivo = true`)
        ]);
        
        res.json({
            pulizie_oggi: parseInt(pulizieOggi.rows[0].count),
            da_assegnare: parseInt(daAssegnare.rows[0].count),
            completate_oggi: parseInt(completateOggi.rows[0].count),
            appartamenti_attivi: parseInt(appartamentiAttivi.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// EMAIL PARSER
// ============================================

const parseEmailContent = (subject, body, from) => {
    // Pattern per estrarre informazioni dalle email
    // Questi pattern vanno personalizzati in base al formato delle email dei tuoi clienti
    
    const patterns = {
        // Pattern generico
        appartamento: /(?:appartamento|casa|alloggio)[:\s]+([^\n,]+)/i,
        checkin: /(?:check-?in|arrivo|ingresso)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        checkout: /(?:check-?out|partenza|uscita)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        ospiti: /(?:ospiti|persone|guests)[:\s]+(\d+)/i,
        nome_ospite: /(?:nome ospite|guest name|ospite)[:\s]+([^\n,]+)/i
    };
    
    const fullText = `${subject}\n${body}`;
    
    const extracted = {};
    
    for (const [key, pattern] of Object.entries(patterns)) {
        const match = fullText.match(pattern);
        if (match) {
            extracted[key] = match[1].trim();
        }
    }
    
    // Converti date
    if (extracted.checkin) {
        extracted.data_checkin = parseDate(extracted.checkin);
    }
    if (extracted.checkout) {
        extracted.data_checkout = parseDate(extracted.checkout);
    }
    if (extracted.ospiti) {
        extracted.numero_ospiti = parseInt(extracted.ospiti);
    }
    
    return extracted;
};

const parseDate = (dateStr) => {
    // Gestisce formati: DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
        let [day, month, year] = parts;
        if (year.length === 2) {
            year = '20' + year;
        }
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return null;
};

const checkEmails = async () => {
    console.log('Controllo email in corso...');
    
    const imap = new Imap({
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
        host: process.env.EMAIL_HOST || 'imap.gmail.com',
        port: process.env.EMAIL_PORT || 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
    });
    
    return new Promise((resolve, reject) => {
        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Cerca email non lette
                imap.search(['UNSEEN'], (err, results) => {
                    if (err || !results.length) {
                        imap.end();
                        resolve([]);
                        return;
                    }
                    
                    const fetch = imap.fetch(results, { bodies: '', markSeen: true });
                    const emails = [];
                    
                    fetch.on('message', (msg, seqno) => {
                        msg.on('body', async (stream) => {
                            const parsed = await simpleParser(stream);
                            emails.push({
                                messageId: parsed.messageId,
                                from: parsed.from?.text,
                                subject: parsed.subject,
                                body: parsed.text,
                                date: parsed.date
                            });
                        });
                    });
                    
                    fetch.once('end', async () => {
                        imap.end();
                        
                        // Processa ogni email
                        for (const email of emails) {
                            await processEmail(email);
                        }
                        
                        resolve(emails);
                    });
                });
            });
        });
        
        imap.once('error', reject);
        imap.connect();
    });
};

const processEmail = async (email) => {
    try {
        // Controlla se già processata
        const existing = await pool.query(
            'SELECT id FROM email_log WHERE message_id = $1',
            [email.messageId]
        );
        
        if (existing.rows.length > 0) {
            return;
        }
        
        // Estrai informazioni
        const extracted = parseEmailContent(email.subject, email.body, email.from);
        
        // Log dell'email
        const logResult = await pool.query(
            `INSERT INTO email_log (message_id, mittente, oggetto, corpo, data_ricezione)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [email.messageId, email.from, email.subject, email.body, email.date]
        );
        const logId = logResult.rows[0].id;
        
        // Se abbiamo abbastanza dati, crea prenotazione
        if (extracted.data_checkin && extracted.data_checkout && extracted.appartamento) {
            // Cerca appartamento per nome (fuzzy match)
            const appartamento = await pool.query(
                `SELECT id FROM appartamenti 
                 WHERE LOWER(nome) LIKE LOWER($1) OR LOWER(indirizzo) LIKE LOWER($1)
                 LIMIT 1`,
                [`%${extracted.appartamento}%`]
            );
            
            if (appartamento.rows.length > 0) {
                const prenotazione = await pool.query(
                    `INSERT INTO prenotazioni (appartamento_id, data_checkin, data_checkout, numero_ospiti, nome_ospite, fonte, email_originale_id)
                     VALUES ($1, $2, $3, $4, $5, 'email', $6) RETURNING id`,
                    [
                        appartamento.rows[0].id,
                        extracted.data_checkin,
                        extracted.data_checkout,
                        extracted.numero_ospiti || 2,
                        extracted.nome_ospite,
                        email.messageId
                    ]
                );
                
                await pool.query(
                    `UPDATE email_log SET elaborata = true, esito = 'successo', prenotazione_creata_id = $1 WHERE id = $2`,
                    [prenotazione.rows[0].id, logId]
                );
                
                console.log(`Prenotazione creata da email: ${prenotazione.rows[0].id}`);
            } else {
                await pool.query(
                    `UPDATE email_log SET elaborata = true, esito = 'manuale', errore_dettaglio = 'Appartamento non trovato' WHERE id = $1`,
                    [logId]
                );
            }
        } else {
            await pool.query(
                `UPDATE email_log SET elaborata = true, esito = 'manuale', errore_dettaglio = 'Dati insufficienti' WHERE id = $1`,
                [logId]
            );
        }
    } catch (err) {
        console.error('Errore processing email:', err);
    }
};

// Cron job: controlla email ogni 5 minuti
cron.schedule('*/5 * * * *', () => {
    checkEmails().catch(console.error);
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
