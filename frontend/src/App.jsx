import { useState, useEffect } from 'react'
import './App.css'

//const API_URL = 'https://gestione-prenotazioni-production.up.railway.app'
const API_URL = 'https://gestione-prenotazioni-production.up.railway.app/api'

function App() {
  const [appartamenti, setAppartamenti] = useState([])
  const [prenotazioni, setPrenotazioni] = useState([])
  const [vista, setVista] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  // Carica dati all'avvio
  useEffect(() => {
    caricaDati()
  }, [])

  const caricaDati = async () => {
    try {
      const [appRes, prenRes] = await Promise.all([
  fetch(`${API_URL}/appartamenti`),
  fetch(`${API_URL}/prenotazioni`)
])
      setAppartamenti(await appRes.json())
      setPrenotazioni(await prenRes.json())
    } catch (err) {
      console.error('Errore caricamento dati:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Caricamento...</div>
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🏠 Gestione Prenotazioni</h1>
        <nav>
          <button 
            className={vista === 'dashboard' ? 'active' : ''} 
            onClick={() => setVista('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={vista === 'appartamenti' ? 'active' : ''} 
            onClick={() => setVista('appartamenti')}
          >
            Appartamenti ({appartamenti.length})
          </button>
          <button 
            className={vista === 'prenotazioni' ? 'active' : ''} 
            onClick={() => setVista('prenotazioni')}
          >
            Prenotazioni ({prenotazioni.length})
          </button>
          <button 
            className={vista === 'nuova' ? 'active' : ''} 
            onClick={() => setVista('nuova')}
          >
            + Nuova Prenotazione
          </button>
          <button 
  className={vista === 'nuovo_app' ? 'active' : ''} 
  onClick={() => setVista('nuovo_app')}
>
  + Nuovo appartamento
</button>

        </nav>
      </header>

      <main className="main">
        {vista === 'dashboard' && (
          <Dashboard appartamenti={appartamenti} prenotazioni={prenotazioni} />
        )}
        {vista === 'appartamenti' && (
          <ListaAppartamenti appartamenti={appartamenti} />
        )}
        {vista === 'prenotazioni' && (
          <ListaPrenotazioni prenotazioni={prenotazioni} onUpdate={caricaDati} />
        )}
        {vista === 'nuova' && (
          <NuovaPrenotazione 
            appartamenti={appartamenti} 
            onSave={() => { caricaDati(); setVista('prenotazioni'); }} 
          />
        )}
        {vista === 'nuovo_app' && (
  <NuovoAppartamento onSave={() => { caricaDati(); setVista('appartamenti'); }} />
)}

      </main>
    </div>
  )
}

// Componente Dashboard
function Dashboard({ appartamenti, prenotazioni }) {
  const oggi = new Date().toISOString().split('T')[0]
  
  const prenotazioniOggi = prenotazioni.filter(p => 
    p.check_in <= oggi && p.check_out >= oggi
  )
  
  const checkInOggi = prenotazioni.filter(p => p.check_in === oggi)
  const checkOutOggi = prenotazioni.filter(p => p.check_out === oggi)

  return (
    <div className="dashboard">
      <h2>Dashboard - {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>🏠 Appartamenti</h3>
          <p className="stat-number">{appartamenti.length}</p>
        </div>
        <div className="stat-card">
          <h3>📅 Occupati Oggi</h3>
          <p className="stat-number">{prenotazioniOggi.length}</p>
        </div>
        <div className="stat-card green">
          <h3>✅ Check-in Oggi</h3>
          <p className="stat-number">{checkInOggi.length}</p>
        </div>
        <div className="stat-card orange">
          <h3>🚪 Check-out Oggi</h3>
          <p className="stat-number">{checkOutOggi.length}</p>
        </div>
      </div>

      {checkInOggi.length > 0 && (
        <div className="section">
          <h3>✅ Check-in di Oggi</h3>
          <ul className="event-list">
            {checkInOggi.map(p => (
              <li key={p.id} className="event-item green">
                <strong>{p.appartamento_nome}</strong> - {p.guest_name} ({p.num_ospiti} ospiti)
              </li>
            ))}
          </ul>
        </div>
      )}

      {checkOutOggi.length > 0 && (
        <div className="section">
          <h3>🚪 Check-out di Oggi</h3>
          <ul className="event-list">
            {checkOutOggi.map(p => (
              <li key={p.id} className="event-item orange">
                <strong>{p.appartamento_nome}</strong> - {p.guest_name}
                <span className="pulizia-tag">Pulizia: €{p.pulizia}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ListaAppartamenti({ appartamenti, setAppartamenti }) {
  const [filtro, setFiltro] = useState('');
  const [editing, setEditing] = useState(null);

  const appartamentiFiltrati = appartamenti.filter(a =>
    a.nome.toLowerCase().includes(filtro.toLowerCase()) ||
    a.via?.toLowerCase().includes(filtro.toLowerCase()) ||
    a.gestore?.toLowerCase().includes(filtro.toLowerCase())
  );

  async function saveEdit() {
    try {
      const response = await fetch(
        `https://gestione-prenotazioni-production.up.railway.app/api/appartamenti/${editing.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing)
        }
      );

      if (!response.ok) throw new Error("Errore aggiornamento");

      const updated = await response.json();

      // aggiorna la lista
      setAppartamenti(appartamenti.map(a =>
        a.id === updated.id ? updated : a
      ));

      setEditing(null);
    } catch (err) {
      console.error(err);
      alert("Errore durante il salvataggio");
    }
  }

  return (
    <div className="lista-appartamenti">
      <h2>Appartamenti</h2>

      <input
        type="text"
        placeholder="Cerca per nome, via o gestore..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="search-input"
      />

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Indirizzo</th>
              <th>Gestore</th>
              <th>Letti</th>
              <th>Pulizia</th>
              <th>Biancheria</th>
              <th>Logistica</th>
              <th>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {appartamentiFiltrati.map(a => (
              <tr key={a.id}>
                <td><strong>{a.nome}</strong></td>
                <td>{a.via}</td>
                <td>{a.gestore || '-'}</td>
                <td>{a.letti_max || '-'}</td>
                <td>€{a.pulizia}</td>
                <td>€{a.biancheria}</td>
                <td>€{a.logistica}</td>
                <td>
                  <button onClick={() => setEditing(a)}>Modifica</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DI MODIFICA */}
      {editing && (
        <>
          <div className="modal-overlay"></div>

          <div className="modal">
            <h3>Modifica appartamento</h3>

            <label>Nome</label>
            <input
              value={editing.nome}
              onChange={e => setEditing({ ...editing, nome: e.target.value })}
            />

            <label>Via</label>
            <input
              value={editing.via}
              onChange={e => setEditing({ ...editing, via: e.target.value })}
            />

            <label>Gestore</label>
            <input
              value={editing.gestore}
              onChange={e => setEditing({ ...editing, gestore: e.target.value })}
            />

            <label>Letti</label>
            <input
              type="number"
              value={editing.letti_max}
              onChange={e => setEditing({ ...editing, letti_max: e.target.value })}
            />

            <label>Pulizia</label>
            <input
              type="number"
              value={editing.pulizia}
              onChange={e => setEditing({ ...editing, pulizia: e.target.value })}
            />

            <label>Biancheria</label>
            <input
              type="number"
              value={editing.biancheria}
              onChange={e => setEditing({ ...editing, biancheria: e.target.value })}
            />

            <label>Logistica</label>
            <input
              type="number"
              value={editing.logistica}
              onChange={e => setEditing({ ...editing, logistica: e.target.value })}
            />

            <button onClick={saveEdit}>Salva</button>
            <button onClick={() => setEditing(null)}>Annulla</button>
          </div>
        </>
      )}
    </div>
  );
}

// Componente Lista Prenotazioni
function ListaPrenotazioni({ prenotazioni, onUpdate }) {
  const eliminaPrenotazione = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa prenotazione?')) return
    
    try {
      await fetch(`${API_URL}/prenotazioni/${id}`, { method: 'DELETE' })
      onUpdate()
    } catch (err) {
      console.error('Errore eliminazione:', err)
    }
  }

  return (
    <div className="lista-prenotazioni">
      <h2>Prenotazioni</h2>
      
      {prenotazioni.length === 0 ? (
        <p className="empty-message">Nessuna prenotazione presente</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Appartamento</th>
                <th>Ospite</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Ospiti</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {prenotazioni.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.appartamento_nome}</strong></td>
                  <td>{p.guest_name}</td>
                  <td>{new Date(p.check_in).toLocaleDateString('it-IT')}</td>
                  <td>{new Date(p.check_out).toLocaleDateString('it-IT')}</td>
                  <td>{p.num_ospiti}</td>
                  <td>
                    <span className={`stato-badge ${p.stato}`}>
                      {p.stato}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn-delete"
                      onClick={() => eliminaPrenotazione(p.id)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Componente Nuova Prenotazione
function NuovaPrenotazione({ appartamenti, onSave }) {
  const [form, setForm] = useState({
    appartamento_id: '',
    guest_name: '',
    check_in: '',
    check_out: '',
    num_ospiti: 1,
    note: ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const res = await fetch(`${API_URL}/prenotazioni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      
      if (res.ok) {
        onSave()
      } else {
        alert('Errore nel salvataggio')
      }
    } catch (err) {
      console.error('Errore:', err)
      alert('Errore di connessione')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="nuova-prenotazione">
      <h2>Nuova Prenotazione</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Appartamento *</label>
          <select
            required
            value={form.appartamento_id}
            onChange={(e) => setForm({...form, appartamento_id: e.target.value})}
          >
            <option value="">Seleziona appartamento...</option>
            {appartamenti.map(a => (
              <option key={a.id} value={a.id}>
                {a.nome} - {a.via}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Nome Ospite *</label>
          <input
            type="text"
            required
            value={form.guest_name}
            onChange={(e) => setForm({...form, guest_name: e.target.value})}
            placeholder="Nome e cognome"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Check-in *</label>
            <input
              type="date"
              required
              value={form.check_in}
              onChange={(e) => setForm({...form, check_in: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label>Check-out *</label>
            <input
              type="date"
              required
              value={form.check_out}
              onChange={(e) => setForm({...form, check_out: e.target.value})}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Numero Ospiti</label>
          <input
            type="number"
            min="1"
            value={form.num_ospiti}
            onChange={(e) => setForm({...form, num_ospiti: parseInt(e.target.value)})}
          />
        </div>

        <div className="form-group">
          <label>Note</label>
          <textarea
            value={form.note}
            onChange={(e) => setForm({...form, note: e.target.value})}
            placeholder="Note aggiuntive..."
          />
        </div>

        <button type="submit" className="btn-save" disabled={saving}>
          {saving ? 'Salvataggio...' : 'Salva Prenotazione'}
        </button>
      </form>
    </div>
  )
}

export default App
