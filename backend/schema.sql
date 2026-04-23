-- Elimina tabelle esistenti se presenti (attenzione: cancella i dati!)
DROP TABLE IF EXISTS prenotazioni;
DROP TABLE IF EXISTS appartamenti;

-- Tabella appartamenti
CREATE TABLE appartamenti (
    id SERIAL PRIMARY KEY,
    owner VARCHAR(255),
    gestore VARCHAR(255),
    via VARCHAR(255),
    nome VARCHAR(255) NOT NULL UNIQUE,
    prezzo DECIMAL(10,2),
    biancheria DECIMAL(10,2) DEFAULT 0,
    logistica DECIMAL(10,2) DEFAULT 0,
    pulizia DECIMAL(10,2),
    letti_max INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella prenotazioni
CREATE TABLE prenotazioni (
    id SERIAL PRIMARY KEY,
    appartamento_id INTEGER REFERENCES appartamenti(id),
    guest_name VARCHAR(255),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    num_ospiti INTEGER,
    note TEXT,
    stato VARCHAR(50) DEFAULT 'confermata',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
