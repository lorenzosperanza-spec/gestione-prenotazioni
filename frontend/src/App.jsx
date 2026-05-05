import { useState, useEffect } from 'react'
import './App.css'

const API_URL = 'https://gestione-prenotazioni-production.up.railway.app/api';

function App() {
  const [appartamenti, setAppartamenti] = useState([])
  const [prenotazioni, setPrenotazioni] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [vista, setVista] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  useEffect(() => { caricaDati() }, [])

  const caricaDati = async () => {
    try {
      const [appRes, prenRes, dipRes] = await Promise.all([
        fetch(`${API_URL}/appartamenti`),
        fetch(`${API_URL}/prenotazioni`),
        fetch(`${API_URL}/dipendenti`)
      ])
      setAppartamenti(await appRes.json())
      setPrenotazioni(await prenRes.json())
      setDipendenti(await dipRes.json())
    } catch (err) {
      console.error('Errore caricamento dati:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Caricamento...</div>

  return (
    <div className="app">
      <header className="header">
        <h1>🏠 Gestione Prenotazioni</h1>
        <nav>
          <button className={vista === 'dashboard' ? 'active' : ''} onClick={() => setVista('dashboard')}>
            Dashboard
          </button>
          <button className={vista === 'appartamenti' ? 'active' : ''} onClick={() => setVista('appartamenti')}>
            Appartamenti ({appartamenti.length})
          </button>
          <button className={vista === 'prenotazioni' ? 'active' : ''} onClick={() => setVista('prenotazioni')}>
            Prenotazioni ({prenotazioni.length})
          </button>
          <button className={vista === 'dipendenti' ? 'active' : ''} onClick={() => setVista('dipendenti')}>
            Dipendenti ({dipendenti.length})
          </button>
          <button className={vista === 'nuova' ? 'active' : ''} onClick={() => setVista('nuova')}>
            + Nuova Prenotazione
          </button>
          <button className={vista === 'nuovo_app' ? 'active' : ''} onClick={() => setVista('nuovo_app')}>
            + Nuovo Appartamento
          </button>
        </nav>
      </header>

      <main className="main">
        {vista === 'dashboard' && (
          <Dashboard prenotazioni={prenotazioni} dipendenti={dipendenti} />
        )}
        {vista === 'appartamenti' && (
          <ListaAppartamenti appartamenti={appartamenti} onUpdate={caricaDati} />
        )}
        {vista === 'prenotazioni' && (
          <ListaPrenotazioni prenotazioni={prenotazioni} appartamenti={appartamenti} onUpdate={caricaDati} />
        )}
        {vista === 'dipendenti' && (
          <ListaDipendenti dipendenti={dipendenti} onUpdate={caricaDati} />
        )}
        {vista === 'nuova' && (
          <NuovaPrenotazione
            appartamenti={appartamenti}
            onSave={() => { caricaDati(); setVista('prenotazioni') }}
          />
        )}
        {vista === 'nuovo_app' && (
          <NuovoAppartamento
            onSave={() => { caricaDati(); setVista('appartamenti') }}
          />
        )}
      </main>
    </div>
  )
}

/* ---------- DASHBOARD ---------- */
function Dashboard({ prenotazioni, dipendenti }) {
  const [modalita, setModalita] = useState('panoramica')
  const [orizzonte, setOrizzonte] = useState(14)
  const [giornoOffset, setGiornoOffset] = useState(0)
  const [assegnazioni, setAssegnazioni] = useState({})

  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)

  const giornoSelezionato = new Date(oggi)
  giornoSelezionato.setDate(oggi.getDate() + giornoOffset)

  const fineOrizzonte = new Date(oggi)
  fineOrizzonte.setDate(oggi.getDate() + orizzonte)

  // Converte data in stringa YYYY-MM-DD senza problemi di timezone
  const toDateStr = (d) => {
    if (typeof d === 'string') return d.slice(0, 10)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  // Trova la prenotazione successiva confrontando stringhe YYYY-MM-DD (no timezone bug)
  const prossimaPren = (appartamento_id, checkOutStr) => {
    const future = prenotazioni
      .filter(p =>
        String(p.appartamento_id) === String(appartamento_id) &&
        toDateStr(p.check_in) >= checkOutStr &&
        toDateStr(p.check_out) !== checkOutStr
      )
      .sort((a, b) => toDateStr(a.check_in).localeCompare(toDateStr(b.check_in)))
    return future[0] || null
  }

  const filtraPerGiorno = (giorno) => {
    const giornoStr = toDateStr(giorno)
    return prenotazioni
      .filter(p => toDateStr(p.check_out) === giornoStr)
      .map(p => ({ ...p, prossima: prossimaPren(p.appartamento_id, toDateStr(p.check_out)) }))
  }

  const pulizieOggi = filtraPerGiorno(oggi)

  const domani = new Date(oggi); domani.setDate(oggi.getDate() + 1)
  const pulizieFuture = prenotazioni
    .filter(p => {
      const co = toDateStr(p.check_out)
      return co >= toDateStr(domani) && co <= toDateStr(fineOrizzonte)
    })
    .sort((a, b) => toDateStr(a.check_out).localeCompare(toDateStr(b.check_out)))
    .map(p => ({ ...p, prossima: prossimaPren(p.appartamento_id, toDateStr(p.check_out)) }))

  const pulizieGiornoSel = filtraPerGiorno(giornoSelezionato)

  const giorniA = (dateStr) => {
    const diff = new Date(toDateStr(dateStr)) - new Date(toDateStr(oggi))
    return Math.round(diff / 86400000)
  }

  const fmtData = (dateStr) => {
    const [y, m, d] = toDateStr(dateStr).split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const fmtDataLunga = (d) =>
    d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  const labelGiorno = (offset) => {
    if (offset === 0) return 'Oggi'
    if (offset === 1) return 'Domani'
    if (offset === -1) return 'Ieri'
    const d = new Date(oggi); d.setDate(oggi.getDate() + offset)
    return fmtDataLunga(d)
  }

  const setAssegnazione = (prenId, dipId) =>
    setAssegnazioni(prev => ({ ...prev, [prenId]: dipId }))

  const PuliziaCard = ({ p, evidenzia }) => {
    const gg = giorniA(p.check_out)
    const label = gg === 0 ? 'oggi' : gg === 1 ? 'domani' : gg === -1 ? 'ieri' : gg > 0 ? `tra ${gg} giorni` : `${Math.abs(gg)} giorni fa`
    const dipAssegnato = assegnazioni[p.id] || ''
    return (
      <div className={`pulizia-card ${evidenzia ? 'pulizia-oggi' : ''}`}>
        <div className="pulizia-header">
          <span className="pulizia-nome">{p.appartamento_nome}</span>
          <div className="pulizia-header-right">
            <select className="assegna-select" value={dipAssegnato}
              onChange={e => setAssegnazione(p.id, e.target.value)}>
              <option value="">👤 Assegna...</option>
              {dipendenti.map(d => (
                <option key={d.id} value={d.id}>{d.nome_cognome}{d.patente ? ' 🚗' : ''}</option>
              ))}
            </select>
            {modalita === 'panoramica' && (
              <span className={`pulizia-quando ${gg === 0 ? 'tag-oggi' : gg === 1 ? 'tag-domani' : gg < 0 ? 'tag-passato' : 'tag-futuro'}`}>
                🧹 {label}
              </span>
            )}
          </div>
        </div>
        <div className="pulizia-body">
          <div className="pulizia-info">
            <span>🚪 Check-out: <strong>{fmtData(p.check_out)}</strong></span>
            {p.prossima ? (
              <>
                <span>✅ Prossimo check-in: <strong>{fmtData(p.prossima.check_in)}</strong></span>
                <span>👥 Ospiti in arrivo: <strong>{p.prossima.num_ospiti}</strong></span>
              </>
            ) : (
              <span className="nessuna-pren">— nessuna prenotazione successiva</span>
            )}
          </div>
          {(p.note || (p.prossima && p.prossima.note)) && (
            <div className="pulizia-note">
              {p.note && p.note !== 'N/A' && <span>📋 Note: {p.note}</span>}
              {p.prossima && p.prossima.note && p.prossima.note !== 'N/A' && <span>📋 Note check-in: {p.prossima.note}</span>}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Pillole centrate sul giorno selezionato: 3 prima, quello corrente, 3 dopo
  const pilloleOffsets = [-3, -2, -1, 0, 1, 2, 3].map(d => giornoOffset + d)

  return (
    <div className="dashboard">
      <div className="dash-header">
        <h2>
          {oggi.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h2>
        <div className="dash-controls">
          <div className="modalita-toggle">
            <button className={modalita === 'panoramica' ? 'active' : ''} onClick={() => setModalita('panoramica')}>
              📅 Panoramica
            </button>
            <button className={modalita === 'giorno' ? 'active' : ''} onClick={() => setModalita('giorno')}>
              🔍 Per giorno
            </button>
          </div>
          {modalita === 'panoramica' && (
            <div className="orizzonte-toggle">
              <button className={orizzonte === 14 ? 'active' : ''} onClick={() => setOrizzonte(14)}>2 settimane</button>
              <button className={orizzonte === 30 ? 'active' : ''} onClick={() => setOrizzonte(30)}>1 mese</button>
            </div>
          )}
        </div>
      </div>

      {/* VISTA PANORAMICA */}
      {modalita === 'panoramica' && (
        <>
          <section className="dash-section">
            <h3 className="dash-section-title">🧹 Pulizie oggi ({pulizieOggi.length})</h3>
            {pulizieOggi.length === 0
              ? <p className="dash-empty">Nessuna pulizia prevista per oggi</p>
              : pulizieOggi.map(p => <PuliziaCard key={p.id} p={p} evidenzia />)
            }
          </section>
          <section className="dash-section">
            <h3 className="dash-section-title">
              📅 Prossime pulizie — {orizzonte === 14 ? '2 settimane' : '1 mese'} ({pulizieFuture.length})
            </h3>
            {pulizieFuture.length === 0
              ? <p className="dash-empty">Nessuna pulizia nei prossimi {orizzonte} giorni</p>
              : pulizieFuture.map(p => <PuliziaCard key={p.id} p={p} evidenzia={false} />)
            }
          </section>
        </>
      )}

      {/* VISTA PER GIORNO */}
      {modalita === 'giorno' && (
        <section className="dash-section">
          <div className="day-nav">
            <button className="day-nav-btn" onClick={() => setGiornoOffset(o => o - 1)}>‹</button>
            <div className="day-nav-center">
              <div className="day-nav-label">{labelGiorno(giornoOffset)}</div>
              <div className="day-nav-shortcuts">
                {pilloleOffsets.map(offset => {
                  const d = new Date(oggi); d.setDate(oggi.getDate() + offset)
                  const hasWork = filtraPerGiorno(d).length > 0
                  const isOggi = offset === 0
                  const shortLabel = isOggi ? 'Oggi' : d.toLocaleDateString('it-IT', { weekday: 'short' })
                  return (
                    <button
                      key={offset}
                      className={`day-pill ${giornoOffset === offset ? 'active' : ''} ${hasWork ? 'has-work' : ''} ${offset < 0 ? 'past' : ''}`}
                      onClick={() => setGiornoOffset(offset)}
                    >
                      <span className="day-pill-label">{shortLabel}</span>
                      <span className="day-pill-num">{d.getDate()}</span>
                      {hasWork && <span className="day-pill-dot" />}
                    </button>
                  )
                })}
              </div>
            </div>
            <button className="day-nav-btn" onClick={() => setGiornoOffset(o => o + 1)}>›</button>
          </div>

          <h3 className="dash-section-title" style={{ marginTop: '20px' }}>
            🧹 Pulizie {labelGiorno(giornoOffset).toLowerCase()} ({pulizieGiornoSel.length})
          </h3>
          {pulizieGiornoSel.length === 0
            ? <p className="dash-empty">Nessuna pulizia prevista per questo giorno</p>
            : pulizieGiornoSel.map(p => <PuliziaCard key={p.id} p={p} evidenzia={giornoOffset === 0} />)
          }
        </section>
      )}
    </div>
  )
}


/* ---------- LISTA DIPENDENTI ---------- */
function ListaDipendenti({ dipendenti, onUpdate }) {
  const [modificaId, setModificaId] = useState(null)
  const [formModifica, setFormModifica] = useState({})
  const [saving, setSaving] = useState(false)
  const [showNuovo, setShowNuovo] = useState(false)
  const [formNuovo, setFormNuovo] = useState({ nome_cognome: '', ore_settimanali: '', patente: false })
  const [errore, setErrore] = useState('')

  const apriModifica = (d) => {
    setModificaId(d.id)
    setFormModifica({ nome_cognome: d.nome_cognome, ore_settimanali: d.ore_settimanali, patente: d.patente })
  }

  const salvaModifica = async (id) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/dipendenti/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formModifica)
      })
      if (res.ok) { setModificaId(null); onUpdate() }
      else { const d = await res.json().catch(() => ({})); alert(d.error || 'Errore salvataggio') }
    } catch { alert('Errore di connessione') }
    finally { setSaving(false) }
  }

  const elimina = async (id, nome) => {
    if (!confirm(`Eliminare "${nome}"?`)) return
    try {
      const res = await fetch(`${API_URL}/dipendenti/${id}`, { method: 'DELETE' })
      if (res.ok) onUpdate()
      else { const d = await res.json().catch(() => ({})); alert(d.error || 'Errore eliminazione') }
    } catch { alert('Errore di connessione') }
  }

  const salvanuovo = async () => {
    if (saving) return
    if (!formNuovo.nome_cognome.trim()) { setErrore('Il nome è obbligatorio'); return }
    setErrore('')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/dipendenti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formNuovo)
      })
      if (res.ok) {
        setShowNuovo(false)
        setFormNuovo({ nome_cognome: '', ore_settimanali: '', patente: false })
        onUpdate()
      } else { const d = await res.json().catch(() => ({})); setErrore(d.error || 'Errore') }
    } catch { setErrore('Errore di connessione') }
    finally { setSaving(false) }
  }

  const upd = (field, value) => setFormModifica(prev => ({ ...prev, [field]: value }))

  return (
    <div className="lista-dipendenti">
      <div className="section-header">
        <h2>Dipendenti</h2>
        <button className="btn-add" onClick={() => { setShowNuovo(!showNuovo); setErrore('') }}>
          {showNuovo ? '✕ Annulla' : '+ Nuovo Dipendente'}
        </button>
      </div>

      {showNuovo && (
        <div className="nuovo-dipendente-form">
          {errore && <div className="error-message">{errore}</div>}
          <div className="form-row-3">
            <div className="form-group">
              <label>NOME COGNOME *</label>
              <input
                type="text"
                value={formNuovo.nome_cognome}
                onChange={e => setFormNuovo({ ...formNuovo, nome_cognome: e.target.value })}
                placeholder="Es. Mario Rossi"
              />
            </div>
            <div className="form-group">
              <label>ORE CONTRATTUALI/SETTIMANA</label>
              <input
                type="number"
                min="1" max="50"
                value={formNuovo.ore_settimanali}
                onChange={e => setFormNuovo({ ...formNuovo, ore_settimanali: e.target.value })}
                placeholder="Es. 40"
              />
            </div>
            <div className="form-group patente-group">
              <label>PATENTE</label>
              <div className="toggle-patente">
                <input
                  type="checkbox"
                  id="patente-nuovo"
                  checked={formNuovo.patente}
                  onChange={e => setFormNuovo({ ...formNuovo, patente: e.target.checked })}
                />
                <label htmlFor="patente-nuovo" className="toggle-label">
                  {formNuovo.patente ? '✅ Sì' : '❌ No'}
                </label>
              </div>
            </div>
          </div>
          <button className="btn-save-inline" onClick={salvanuovo} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva Dipendente'}
          </button>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nome Cognome</th>
              <th>Ore/Settimana</th>
              <th>Patente</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {dipendenti.map(d => (
              <tr key={d.id}>
                {modificaId === d.id ? (
                  <>
                    <td><input className="edit-input" value={formModifica.nome_cognome} onChange={e => upd('nome_cognome', e.target.value)} /></td>
                    <td><input className="edit-input" type="number" value={formModifica.ore_settimanali} onChange={e => upd('ore_settimanali', e.target.value)} /></td>
                    <td>
                      <select className="edit-input" value={formModifica.patente ? 'si' : 'no'} onChange={e => upd('patente', e.target.value === 'si')}>
                        <option value="si">✅ Sì</option>
                        <option value="no">❌ No</option>
                      </select>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-icon btn-confirm" onClick={() => salvaModifica(d.id)} disabled={saving}>{saving ? '…' : '✓'}</button>
                      <button className="btn-icon btn-cancel-icon" onClick={() => setModificaId(null)}>✕</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td><strong>{d.nome_cognome}</strong></td>
                    <td>{d.ore_settimanali ? `${d.ore_settimanali}h` : '-'}</td>
                    <td>{d.patente ? '✅ Sì' : '❌ No'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-icon btn-edit" title="Modifica" onClick={() => apriModifica(d)}>✏️</button>
                      <button className="btn-icon btn-trash" title="Elimina" onClick={() => elimina(d.id, d.nome_cognome)}>🗑️</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- LISTA APPARTAMENTI ---------- */
function ListaAppartamenti({ appartamenti, onUpdate }) {
  const [filtro, setFiltro] = useState('')
  const [modificaId, setModificaId] = useState(null)
  const [formModifica, setFormModifica] = useState({})
  const [saving, setSaving] = useState(false)

  const appartamentiFiltrati = appartamenti.filter((a) =>
    [a.nome, a.via, a.gestore, a.owner]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(filtro.toLowerCase()))
  )

  const apriModifica = (a) => {
    setModificaId(a.id)
    setFormModifica({
      owner: a.owner || '', gestore: a.gestore || '', via: a.via || '', nome: a.nome || '',
      prezzo: a.prezzo || '', biancheria: a.biancheria || '', logistica: a.logistica || '',
      pulizia: a.pulizia || '', letti_max: a.letti_max || ''
    })
  }

  const salvaModifica = async (id) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/appartamenti/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formModifica)
      })
      if (res.ok) { setModificaId(null); onUpdate() }
      else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore nel salvataggio') }
    } catch { alert('Errore di connessione') }
    finally { setSaving(false) }
  }

  const eliminaAppartamento = async (id, nome) => {
    if (!confirm(`Eliminare "${nome}"? L'operazione non è reversibile.`)) return
    try {
      const res = await fetch(`${API_URL}/appartamenti/${id}`, { method: 'DELETE' })
      if (res.ok) onUpdate()
      else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore eliminazione') }
    } catch { alert('Errore di connessione') }
  }

  const aggiornaField = (field, value) => setFormModifica(prev => ({ ...prev, [field]: value }))

  return (
    <div className="lista-appartamenti">
      <h2>Appartamenti</h2>
      <input type="text" placeholder="Cerca per nome, via, owner o gestore..." value={filtro}
        onChange={(e) => setFiltro(e.target.value)} className="search-input" />
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Appartamento</th><th>Via</th><th>Owner</th><th>Gestore</th>
              <th>Prezzo (€)</th><th>Biancheria (€)</th><th>Logistica (min)</th>
              <th>Pulizia (min)</th><th>Letti Max</th><th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {appartamentiFiltrati.map((a) => (
              <tr key={a.id}>
                {modificaId === a.id ? (
                  <>
                    <td><input className="edit-input" value={formModifica.nome} onChange={e => aggiornaField('nome', e.target.value)} /></td>
                    <td><input className="edit-input" value={formModifica.via} onChange={e => aggiornaField('via', e.target.value)} /></td>
                    <td><input className="edit-input" value={formModifica.owner} onChange={e => aggiornaField('owner', e.target.value)} /></td>
                    <td><input className="edit-input" value={formModifica.gestore} onChange={e => aggiornaField('gestore', e.target.value)} /></td>
                    <td><input className="edit-input" type="number" step="0.01" value={formModifica.prezzo} onChange={e => aggiornaField('prezzo', e.target.value)} /></td>
                    <td><input className="edit-input" type="number" step="0.01" value={formModifica.biancheria} onChange={e => aggiornaField('biancheria', e.target.value)} /></td>
                    <td><input className="edit-input" type="number" value={formModifica.logistica} onChange={e => aggiornaField('logistica', e.target.value)} /></td>
                    <td><input className="edit-input" type="number" value={formModifica.pulizia} onChange={e => aggiornaField('pulizia', e.target.value)} /></td>
                    <td><input className="edit-input" type="number" value={formModifica.letti_max} onChange={e => aggiornaField('letti_max', e.target.value)} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-icon btn-confirm" onClick={() => salvaModifica(a.id)} disabled={saving}>{saving ? '…' : '✓'}</button>
                      <button className="btn-icon btn-cancel-icon" onClick={() => setModificaId(null)}>✕</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td><strong>{a.nome}</strong></td>
                    <td>{a.via || '-'}</td><td>{a.owner || '-'}</td><td>{a.gestore || '-'}</td>
                    <td>{a.prezzo != null ? `€${Number(a.prezzo).toFixed(2)}` : '-'}</td>
                    <td>{a.biancheria != null ? `€${Number(a.biancheria).toFixed(2)}` : '-'}</td>
                    <td>{a.logistica != null ? `${Number(a.logistica)} min` : '-'}</td>
                    <td>{a.pulizia != null ? `${Number(a.pulizia)} min` : '-'}</td>
                    <td>{a.letti_max || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-icon btn-edit" title="Modifica" onClick={() => apriModifica(a)}>✏️</button>
                      <button className="btn-icon btn-trash" title="Elimina" onClick={() => eliminaAppartamento(a.id, a.nome)}>🗑️</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- LISTA PRENOTAZIONI ---------- */
function ListaPrenotazioni({ prenotazioni, appartamenti, onUpdate }) {
  const [modificaId, setModificaId] = useState(null)
  const [formModifica, setFormModifica] = useState({})
  const [saving, setSaving] = useState(false)

  const apriModifica = (p) => {
    setModificaId(p.id)
    setFormModifica({
      appartamento_id: p.appartamento_id,
      check_in: p.check_in,
      check_out: p.check_out,
      num_ospiti: p.num_ospiti,
      note: p.note || '',
      stato: p.stato
    })
  }

  const salvaModifica = async (id) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/prenotazioni/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formModifica)
      })
      if (res.ok) { setModificaId(null); onUpdate() }
      else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore nel salvataggio') }
    } catch { alert('Errore di connessione') }
    finally { setSaving(false) }
  }

  const eliminaPrenotazione = async (id) => {
    if (!confirm('Eliminare questa prenotazione?')) return
    try {
      await fetch(`${API_URL}/prenotazioni/${id}`, { method: 'DELETE' })
      onUpdate()
    } catch { console.error('Errore eliminazione') }
  }

  const upd = (field, value) => setFormModifica(prev => ({ ...prev, [field]: value }))

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
                <th>Appartamento</th><th>Check-in</th><th>Check-out</th>
                <th>Ospiti</th><th>Note</th><th>Stato</th><th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {prenotazioni.map((p) => (
                <tr key={p.id}>
                  {modificaId === p.id ? (
                    <>
                      <td>
                        <select className="edit-input" value={formModifica.appartamento_id} onChange={e => upd('appartamento_id', e.target.value)}>
                          {appartamenti.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                        </select>
                      </td>
                      <td><input className="edit-input" type="date" value={formModifica.check_in} onChange={e => upd('check_in', e.target.value)} /></td>
                      <td><input className="edit-input" type="date" value={formModifica.check_out} onChange={e => upd('check_out', e.target.value)} /></td>
                      <td><input className="edit-input" type="number" min="1" value={formModifica.num_ospiti} onChange={e => upd('num_ospiti', e.target.value)} /></td>
                      <td><input className="edit-input" value={formModifica.note} onChange={e => upd('note', e.target.value)} /></td>
                      <td>
                        <select className="edit-input" value={formModifica.stato} onChange={e => upd('stato', e.target.value)}>
                          <option value="confermata">confermata</option>
                          <option value="in_attesa">in_attesa</option>
                          <option value="cancellata">cancellata</option>
                        </select>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-icon btn-confirm" onClick={() => salvaModifica(p.id)} disabled={saving}>{saving ? '…' : '✓'}</button>
                        <button className="btn-icon btn-cancel-icon" onClick={() => setModificaId(null)}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><strong>{p.appartamento_nome}</strong></td>
                      <td>{new Date(p.check_in).toLocaleDateString('it-IT')}</td>
                      <td>{new Date(p.check_out).toLocaleDateString('it-IT')}</td>
                      <td>{p.num_ospiti}</td>
                      <td>{p.note || '-'}</td>
                      <td><span className={`stato-badge ${p.stato}`}>{p.stato}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-icon btn-edit" title="Modifica" onClick={() => apriModifica(p)}>✏️</button>
                        <button className="btn-icon btn-trash" title="Elimina" onClick={() => eliminaPrenotazione(p.id)}>🗑️</button>
                      </td>
                    </>
                  )}
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
  const [form, setForm] = useState({ appartamento_id: '', check_in: '', check_out: '', num_ospiti: 1, note: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/prenotazioni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) { onSave() }
      else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore nel salvataggio'); setSaving(false) }
    } catch { alert('Errore di connessione'); setSaving(false) }
  }

  return (
    <div className="nuova-prenotazione">
      <h2>Nuova Prenotazione</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Appartamento *</label>
          <select required value={form.appartamento_id} onChange={(e) => setForm({ ...form, appartamento_id: e.target.value })}>
            <option value="">Seleziona appartamento...</option>
            {appartamenti.map((a) => <option key={a.id} value={a.id}>{a.nome} - {a.via}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Check-in *</label>
            <input type="date" required value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Check-out *</label>
            <input type="date" required value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Numero Ospiti</label>
          <input type="number" min="1" value={form.num_ospiti} onChange={(e) => setForm({ ...form, num_ospiti: parseInt(e.target.value) })} />
        </div>
        <div className="form-group">
          <label>Note</label>
          <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note aggiuntive..." />
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
  const [form, setForm] = useState({ owner: '', gestore: '', via: '', nome: '', prezzo: '', biancheria: '', logistica: '', pulizia: '', letti_max: '' })
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setErrore('')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/appartamenti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) { onSave() }
      else { const data = await res.json().catch(() => ({})); setErrore(data.error || 'Errore'); setSaving(false) }
    } catch { setErrore('Errore di connessione'); setSaving(false) }
  }

  return (
    <div className="nuovo-appartamento">
      <h2>Nuovo Appartamento</h2>
      {errore && <div className="error-message">{errore}</div>}
      <form onSubmit={handleSubmit}>
        {['owner','gestore','via','nome','prezzo','biancheria','logistica','pulizia','letti_max'].map(field => (
          <div className="form-group" key={field}>
            <label>{field.toUpperCase()}{field === 'nome' ? ' *' : ''}</label>
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
