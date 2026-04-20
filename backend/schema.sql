-- Import appartamenti dal tuo file Excel
-- I campi mancanti (email, telefono) restano NULL per ora

INSERT INTO appartamenti (nome, indirizzo, zona, cliente_nome, tempo_pulizia_stimato, richiede_motorino, note) VALUES
-- Zona Vaticano/Aurelia (0-10 min logistica)
('Argilla', 'Via dell''Argilla 4', 'Vaticano', 'Pringo S.r.l.', 60, false, 'Prezzo: €24 | Biancheria: €8/persona'),
('Cipro', 'Via Cipro 84', 'Vaticano', 'Filidori Flaviu Anton Francescu', 120, false, 'Prezzo: €40 | Biancheria: €8/persona'),
('Clivo', 'Clivo delle mura vaticane 60', 'Vaticano', 'LAMACA S.N.C.', 150, false, 'Prezzo: €45 | Biancheria: €8.5/persona'),
('Domus Cynthia', 'Via Terrione 83', 'Vaticano', NULL, NULL, false, 'Prezzo: €30 | Biancheria: €8/persona'),
('Domus Peter', 'Via Missori 3', 'Vaticano', 'Laghi Andrea', 135, false, 'Prezzo: €45 | Biancheria: €8.5/persona'),
('Doria - Roof Garden', 'Via Andrea Doria 36', 'Prati', 'LARES & LUMEN S.R.L.S.', 150, false, 'Prezzo: €121.5'),
('San Peter Loft', 'Via Terrione 83', 'Vaticano', 'Pellegrin Andrea', 60, false, 'Prezzo: €35 | Biancheria: €9/persona'),
('San Peter View', 'Via Terrione 83', 'Vaticano', 'Giulia Leonardi', 60, false, 'Prezzo: €35 | Biancheria: €9/persona'),
('Santamaura', 'Via Santamaura 46', 'Prati', 'LARES & LUMEN S.R.L.S.', 150, false, 'Prezzo: €111'),
('Vatican Flower', 'Via Savonarola 39', 'Vaticano', 'Pierca/Lolli', 135, false, 'Prezzo: €67'),
('Vatican Suite', 'Via Cava Aurelia', 'Vaticano', 'Fantauzzi Andrea', 80, false, 'Prezzo: €35 | Biancheria: €10/persona'),
('Vatican Terrace', 'Viale Vaticano 29', 'Vaticano', 'Pierca', 105, false, 'Prezzo: €28 | Biancheria: €6/persona'),
('Garden', 'Viale Vaticano 29', 'Vaticano', 'Pierca', 75, false, 'Prezzo: €28 | Biancheria: €7.5/persona'),

-- Zona Centro (15-20 min logistica)  
('Artale', 'Via Vito Artale 12', 'Tuscolano', 'Emilia Battaglia', 150, true, 'Prezzo: €40'),
('Babbuino Terrace', 'Via del Babuino 29', 'Centro', 'Michele Mazzarda', 90, true, 'Prezzo: €40 | Biancheria: €8.5/persona'),
('Bonelli Loft', 'Via Gaetano Fuggetta 47', 'Monteverde', 'Leonardi Giovanni', 60, true, 'Prezzo: €35 | Biancheria: €9/persona'),
('Bonelli Penthouse', 'Via Livio Mariani', 'Monteverde', 'Raudino Stefania', 60, true, 'Prezzo: €40 | Biancheria: €9/persona'),
('Bricca', 'Via Mantegazza 19', 'Monteverde', 'Faustini Adriana', 75, false, 'Prezzo: €45 | Biancheria: €9/persona'),
('Carracci', 'Piazza dei Carracci 1', 'Prati', NULL, 120, true, 'Prezzo: €38 | Biancheria: €8/persona'),
('Cosy', 'Via del Colosseo 2a', 'Centro', 'Pietro Cartoni', 165, true, 'Prezzo: €42 | Biancheria: €8/persona'),
('Domus Claudia', 'Via del Colosseo 2a', 'Centro', 'FIDIA PALACE S.R.L.', 135, true, 'Prezzo: €40 | Biancheria: €6/persona'),
('Domus Flavia', 'Via del Colosseo 2a', 'Centro', 'FIDIA PALACE S.R.L.', 135, true, 'Prezzo: €40 | Biancheria: €6/persona'),
('Domus Marco Aurelio', 'Via del Colosseo 2a', 'Centro', 'FIDIA PALACE S.R.L.', 135, true, NULL),
('Fancy', 'Via del Colosseo 2a', 'Centro', 'Pietro Cartoni', 150, true, 'Prezzo: €40 | Biancheria: €8/persona'),
('Flaminio', 'Piazza Perin del Vaga 4', 'Flaminio', '4BNB', 135, true, 'Prezzo: €80'),
('Marche2', 'Via Marche 73, 2 piano', 'Centro', 'Ferretti Emanuele', 90, true, 'Prezzo: €30 | Biancheria: €8.5/persona'),
('Marche4', 'Via Marche 73, 4 piano', 'Centro', NULL, 90, true, 'Prezzo: €40 | Biancheria: €9/persona'),
('Marmorata', 'Viale Marmorata 37', 'Testaccio', '4BNB', 60, false, 'Prezzo: €50'),
('Mecenate', 'Via Mecenate 59', 'Esquilino', 'Matteo Resparambia', 150, true, 'Prezzo: €99'),
('Otranto 8P', 'Via Otranto 12', 'Prati', '4BNB', 180, false, 'Prezzo: €107'),
('Otranto 9P', 'Via Otranto 12', 'Prati', '4BNB', 180, false, 'Prezzo: €115'),
('Peretti', 'Via Pietro Peretti 24', 'Prati', 'Cerrato Andrea', 105, false, 'Prezzo: €70'),
('Piramide Experience', 'Via Federico Nansen 88', 'Ostiense', 'Volpi Gianluca', 105, true, 'Prezzo: €45 | Biancheria: €8.5/persona'),
('Pregio A', 'Via Elio Toaff 4', 'EUR', NULL, 120, false, 'Prezzo: €50 | Biancheria: €10/persona'),
('Pregio B', 'Via Elio Toaff 4', 'EUR', NULL, 120, false, 'Prezzo: €55 | Biancheria: €10/persona'),
('Room Ostiense', 'Largo Luigi Antonelli 20', 'Ostiense', 'Coppola Giovanni', 60, true, 'Prezzo: €30 | Biancheria: €10/persona'),
('Stylish & Spacius', 'Viale Giulio Cesare 59', 'Prati', '4BNB', 165, false, 'Prezzo: €97'),
('Sun', 'Via dei Colli Portuensi 94', 'Portuense', 'Bernardini Fabiola', 75, false, 'Prezzo: €45 | Biancheria: €9/persona'),
('Trastevere Lovely Loft', 'Via di S. Francesco a Ripa 161', 'Trastevere', 'Fulvio Berretta', 75, false, 'Prezzo: €35 | Biancheria: €9/persona'),
('Vittoria', 'Via Vittoria 20', 'Centro', 'Allegrini Gabriele', 75, true, 'Prezzo: €69'),
('Vignola', 'Viale del Vignola 75', 'Flaminio', 'Diego', 90, false, 'Prezzo: €40 | Biancheria: €8/persona'),
('Victoria Palace', 'Via Leone IV', 'Prati', '4BNB', NULL, false, 'Prezzo: €155'),
('Po', 'Via Po 39', 'Centro', 'Diego', 105, true, 'Prezzo: €40 | Biancheria: €8/persona'),

-- Zone periferiche / tempi logistica mancanti
('Style Apartment', 'Via degli Equi 7', 'San Lorenzo', 'Lolli', 105, true, 'Prezzo: €30 | Biancheria: €8/persona'),
('Branca', 'Via Giovanni Branca 79', 'Testaccio', 'CELESTE S PLACE SAS', NULL, false, 'Prezzo: €90'),
('Fabriano', 'Piazza Gentile da Fabriano 3', 'Flaminio', 'CELESTE S PLACE SAS', NULL, false, 'Prezzo: €63'),
('Rondanini', 'Piazza Rondanini 4', 'Centro', 'CELESTE S PLACE SAS', NULL, true, 'Prezzo: €107'),
('Condominio Boccea', 'Via Boccea 302', 'Boccea', NULL, NULL, true, 'Prezzo: €35'),
('Condominio Giulietti', 'Via Giulietti 21', 'Prati', NULL, NULL, false, 'Prezzo: €40'),
('Condominio Pio IX', 'Via Pio IX 128', 'Aurelio', NULL, NULL, false, 'Prezzo: €35'),
('Medaglie d''oro', 'Viale Medaglie d''Oro 160', 'Balduina', NULL, NULL, false, 'Prezzo: €40 | Biancheria: €8/persona'),
('Guesthouse Ormisda', 'Via Ormisda 10', 'Aventino', 'Arcieri Stefano', NULL, false, NULL),
('Ufficio Agnelli', 'Via Agnelli 48', 'EUR', 'GENCOLOR S.R.L.', NULL, false, 'Prezzo: €50 | Solo ufficio');

-- Inserimento motorini
INSERT INTO motorini (targa, nome) VALUES
('AA000AA', 'Motorino 1'),
('BB111BB', 'Motorino 2'),
('CC222CC', 'Motorino 3'),
('DD333DD', 'Motorino 4');
