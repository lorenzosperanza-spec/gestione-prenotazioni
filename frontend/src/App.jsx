import { useState, useEffect } from 'react'
import './App.css'

const API_URL = '[gestione-prenotazioni-production.up.railway.app](https://gestione-prenotazioni-production.up.railway.app/api)'

function App() {
  const [appartamenti, setAppartamenti] = useState([])
  const [prenotazioni, setPrenotazioni] = useState([])
  const [vista, setVista] = useState('dashboard')
  const [loading, setLoading] = useState(true)

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
            + Nuovo Appartamento
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
            onSave={() => {
              caricaDati()
              setVista('prenotazioni')
            }}
          />
        )}

        {vista === 'nuovo_app' && (
          <NuovoAppartamento
            onSave={() => {
              caricaDati()
              setVista('appartamenti')
            }}
          />
        )}
      </main>
    </div>
  )
}

/* ---------- DASHBOARD ---------- */
function Dashboard({ appartamenti, prenotazioni }) {
  const oggi = new Date().toISOString().split('T')[0]
  const prenotazioniOggi = prenotazioni.filter(
    (p) => p.check_in <= oggi && p.check_out >= oggi
  )
  const checkInOggi = prenotazioni.filter((p) => p.check_in === oggi)
  const checkOutOggi = prenotazioni.filter((p) => p.check_out === oggi)

  return (
    <div className="dashboard">
      <h2>
        Dashboard -{' '}
        {new Date().toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}
      </h2>

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
    </div>
  )
}

/* ---------- LISTA APPARTAMENTI ---------- */
function ListaAppartamenti({ appartamenti }) {
  const [filtro, setFiltro] = useState('')

  const appartamentiFiltrati = appartamenti.filter((a) =>
    [a.nome, a.via, a.gestore, a.owner]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(filtro.toLowerCase()))
  )

  return (
    <div className="lista-appartamenti">
      <h2>Appartamenti</h2>
      <input
        type="text"
        placeholder="Cerca per nome, via, owner o gestore..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="search-input"
      />

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Appartamento</th>
              <th>Via</th>
              <th>Owner</th>
              <th>Gestore</th>
              <th>Prezzo (€)</th>
              <th>Biancheria (€)</th>
              <th>Logistica (min)</th>
              <th>Pulizia (min)</th>
              <th>Letti Max</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {appartamentiFiltrati.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.nome}</strong></td>
                <td>{a.via || '-'}</td>
                <td>{a.owner || '-'}</td>
                <td>{a.gestore || '-'}</td>
                <td>{a.prezzo != null ? `€${Number(a.prezzo).toFixed(2)}` : '-'}</td>
                <td>{a.biancheria != null ? `€${Number(a.biancheria).toFixed(2)}` : '-'}</td>
                <td>{a.logistica != null ? `${Number(a.logistica)} min` : '-'}</td>
                <td>{a.pulizia != null ? `${Number(a.pulizia)} min` : '-'}</td>
                <td>{a.letti_max || '-'}</td>
                <td>
                  <button className="btn-delete">Modifica</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- LISTA PRENOTAZIONI ---------- */
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
              {prenotazioni.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.appartamento_nome}</strong></td>
                  <td>{p.guest_name}</td>
                  <td>{new Date(p.check_in).toLocaleDateString('it-IT')}</td>
                  <td>{new Date(p.check_out).toLocaleDateString('it-IT')}</td>
                  <td>{p.num_ospiti}</td>
                  <td>
                    <span className={`stato-badge ${p.stato}`}>{p.stato}</span>
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

/* ---------- NUOVA PRENOTAZIONE ---------- */
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
            onChange={(e) => setForm({ ...form, appartamento_id: e.target.value })}
          >
            <option value="">Seleziona appartamento...</option>
            {appartamenti.map((a) => (
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
            onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
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
              onChange={(e) => setForm({ ...form, check_in: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Check-out *</label>
            <input
              type="date"
              required
              value={form.check_out}
              onChange={(e) => setForm({ ...form, check_out: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Numero Ospiti</label>
          <input
            type="number"
            min="1"
            value={form.num_ospiti}
            onChange={(e) =>
              setForm({ ...form, num_ospiti: parseInt(e.target.value) })
            }
          />
        </div>

        <div className="form-group">
          <label>Note</label>
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
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

/* ---------- NUOVO APPARTAMENTO ---------- */
function NuovoAppartamento({ onSave }) {
  const [form, setForm] = useState({
    owner: '',
    gestore: '',
    via: '',
    nome: '',
    prezzo: '',
    biancheria: '',
    logistica: '',
    pulizia: '',
    letti_max: ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/appartamenti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        alert('Appartamento aggiunto con successo!')
        onSave()
      } else {
        alert('Errore nell\'inserimento dei dati')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="nuovo-appartamento">
      <h2>Nuovo Appartamento</h2>
      <form onSubmit={handleSubmit}>
        {['owner','gestore','via','nome','prezzo','biancheria','logistica','pulizia','letti_max'].map(field => (
          <div className="form-group" key={field}>
            <label>{field.toUpperCase()}</label>
            <input 
              type={['prezzo','biancheria','logistica','pulizia','letti_max'].includes(field) ? 'number' : 'text'}
              step="0.01"
              value={form[field]}
              onChange={(e) => setForm({...form, [field]: e.target.value})}
              required={field === 'nome'}
            />
          </div>
        ))}
        <button type="submit" className="btn-save" disabled={saving}>
          {saving ? 'Salvataggio...' : 'Salva Appartamento'}
        </button>
      </form>
    </div>
  )
}

export default App
