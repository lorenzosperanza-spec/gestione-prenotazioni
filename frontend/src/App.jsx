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
          <button className={vista === 'dashboard' ? 'active' : ''} onClick={() => setVista('dashboard')}>Dashboard</button>
          <button className={vista === 'appartamenti' ? 'active' : ''} onClick={() => setVista('appartamenti')}>Appartamenti ({appartamenti.length})</button>
          <button className={vista === 'prenotazioni' ? 'active' : ''} onClick={() => setVista('prenotazioni')}>Prenotazioni ({prenotazioni.length})</button>
          <button className={vista === 'dipendenti' ? 'active' : ''} onClick={() => setVista('dipendenti')}>Dipendenti ({dipendenti.length})</button>
          <button className={vista === 'nuova' ? 'active' : ''} onClick={() => setVista('nuova')}>+ Nuova Prenotazione</button>
          <button className={vista === 'nuovo_app' ? 'active' : ''} onClick={() => setVista('nuovo_app')}>+ Nuovo Appartamento</button>
          <button className={vista === 'import' ? 'active' : ''} onClick={() => setVista('import')}>⬆ Import ItalianWay</button>
        </nav>
      </header>

      <main className="main">
        {vista === 'dashboard' && <Dashboard prenotazioni={prenotazioni} dipendenti={dipendenti} caricaDati={caricaDati} />}
        {vista === 'appartamenti' && <ListaAppartamenti appartamenti={appartamenti} onUpdate={caricaDati} />}
        {vista === 'prenotazioni' && <ListaPrenotazioni prenotazioni={prenotazioni} appartamenti={appartamenti} onUpdate={caricaDati} />}
        {vista === 'dipendenti' && <ListaDipendenti dipendenti={dipendenti} onUpdate={caricaDati} />}
        {vista === 'nuova' && <NuovaPrenotazione appartamenti={appartamenti} onSave={() => { caricaDati(); setVista('prenotazioni') }} />}
        {vista === 'nuovo_app' && <NuovoAppartamento onSave={() => { caricaDati(); setVista('appartamenti') }} />}
        {vista === 'import' && <ImportItalianWay appartamenti={appartamenti} onImport={() => { caricaDati(); setVista('prenotazioni') }} />}
      </main>
    </div>
  )
}

/* ---------- DASHBOARD ---------- */
function Dashboard({ prenotazioni, dipendenti, caricaDati }) {
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

  const toDateStr = (d) => {
    if (typeof d === 'string') return d.slice(0, 10)
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  const prossimaPren = (appartamento_id, checkOutStr) => {
    const future = prenotazioni
      .filter(p => String(p.appartamento_id) === String(appartamento_id) && toDateStr(p.check_in) >= checkOutStr && toDateStr(p.check_out) !== checkOutStr && p.stato !== 'cancellata')
      .sort((a, b) => toDateStr(a.check_in).localeCompare(toDateStr(b.check_in)))
    return future[0] || null
  }

  const filtraPerGiorno = (giorno) => {
    const giornoStr = toDateStr(giorno)
    return prenotazioni.filter(p => toDateStr(p.check_out) === giornoStr).map(p => ({ ...p, prossima: prossimaPren(p.appartamento_id, toDateStr(p.check_out)) }))
  }

  const pulizieOggi = filtraPerGiorno(oggi)
  const domani = new Date(oggi); domani.setDate(oggi.getDate() + 1)
  const pulizieFuture = prenotazioni
    .filter(p => { const co = toDateStr(p.check_out); return co >= toDateStr(domani) && co <= toDateStr(fineOrizzonte) })
    .sort((a, b) => toDateStr(a.check_out).localeCompare(toDateStr(b.check_out)))
    .map(p => ({ ...p, prossima: prossimaPren(p.appartamento_id, toDateStr(p.check_out)) }))
  const pulizieGiornoSel = filtraPerGiorno(giornoSelezionato)

  const giorniA = (dateStr) => Math.round((new Date(toDateStr(dateStr)) - new Date(toDateStr(oggi))) / 86400000)
  const fmtData = (dateStr) => { const [y, m, d] = toDateStr(dateStr).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) }
  const fmtDataLunga = (d) => d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const labelGiorno = (offset) => {
    if (offset === 0) return 'Oggi'; if (offset === 1) return 'Domani'; if (offset === -1) return 'Ieri'
    const d = new Date(oggi); d.setDate(oggi.getDate() + offset); return fmtDataLunga(d)
  }

  const salvaAssegnazione = async (prenId, dipId) => {
    setAssegnazioni(prev => ({ ...prev, [prenId]: dipId }))
    try { await fetch(`${API_URL}/prenotazioni/${prenId}/assegna`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dipendente_id: dipId || null }) }) }
    catch (err) { console.error('Errore assegnazione:', err) }
  }

  const salvaStatoPulizia = async (prenId, stato, nuovaData) => {
    try { await fetch(`${API_URL}/prenotazioni/${prenId}/stato-pulizia`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stato_pulizia: stato, nuova_data: nuovaData }) }); caricaDati() }
    catch (err) { console.error('Errore stato pulizia:', err) }
  }

  const PuliziaCard = ({ p, evidenzia }) => {
    const gg = giorniA(p.check_out)
    const label = gg === 0 ? 'oggi' : gg === 1 ? 'domani' : gg === -1 ? 'ieri' : gg > 0 ? `tra ${gg} giorni` : `${Math.abs(gg)} giorni fa`
    const dipAssegnato = assegnazioni[p.id] !== undefined ? assegnazioni[p.id] : (p.dipendente_id || '')
    const statoPulizia = p.stato_pulizia || 'da_fare'
    const [mostraPosticipa, setMostraPosticipa] = useState(false)
    const [nuovaData, setNuovaData] = useState('')
    const cardClass = `pulizia-card ${evidenzia ? 'pulizia-oggi' : ''} ${statoPulizia === 'completata' ? 'pulizia-completata' : ''} ${statoPulizia === 'posticipata' ? 'pulizia-posticipata' : ''}`

    return (
      <div className={cardClass}>
        <div className="pulizia-header">
          <div className="pulizia-header-left">
            <span className="pulizia-nome">{p.appartamento_nome}</span>
            {statoPulizia === 'completata' && <span className="badge-completata">✅ Completata</span>}
            {statoPulizia === 'posticipata' && <span className="badge-posticipata">⏭ Posticipata</span>}
          </div>
          <div className="pulizia-header-right">
            <select className="assegna-select" value={dipAssegnato} onChange={e => salvaAssegnazione(p.id, e.target.value)}>
              <option value="">👤 Assegna...</option>
              {dipendenti.map(d => <option key={d.id} value={d.id}>{d.nome_cognome}{d.patente ? ' 🚗' : ''}</option>)}
            </select>
            {modalita === 'panoramica' && (
              <span className={`pulizia-quando ${gg === 0 ? 'tag-oggi' : gg === 1 ? 'tag-domani' : gg < 0 ? 'tag-passato' : 'tag-futuro'}`}>🧹 {label}</span>
            )}
          </div>
        </div>
        <div className="pulizia-body">
          <div className="pulizia-info">
            <span>🚪 Check-out: <strong>{fmtData(p.check_out)}</strong></span>
            {p.prossima ? (<><span>✅ Prossimo check-in: <strong>{fmtData(p.prossima.check_in)}</strong></span><span>👥 Ospiti in arrivo: <strong>{p.prossima.num_ospiti}</strong></span></>) : (<span className="nessuna-pren">— nessuna prenotazione successiva</span>)}
          </div>
          {p.prossima && p.prossima.note && p.prossima.note !== 'N/A' && <div className="pulizia-note"><span>📋 Note check-in: {p.prossima.note}</span></div>}
        </div>
        <div className="pulizia-azioni">
          {statoPulizia !== 'completata' && <button className="btn-pulizia btn-completa" onClick={() => salvaStatoPulizia(p.id, 'completata')}>✅ Segna completata</button>}
          {statoPulizia === 'completata' && <button className="btn-pulizia btn-annulla-stato" onClick={() => salvaStatoPulizia(p.id, 'da_fare')}>↩ Annulla</button>}
          {statoPulizia !== 'completata' && !mostraPosticipa && <button className="btn-pulizia btn-posticipa" onClick={() => setMostraPosticipa(true)}>⏭ Posticipa</button>}
          {mostraPosticipa && (
            <div className="posticipa-form">
              <input type="date" value={nuovaData} onChange={e => setNuovaData(e.target.value)} min={toDateStr(new Date())} className="edit-input" />
              <button className="btn-pulizia btn-completa" disabled={!nuovaData} onClick={() => { salvaStatoPulizia(p.id, 'posticipata', nuovaData); setMostraPosticipa(false) }}>Conferma</button>
              <button className="btn-pulizia btn-annulla-stato" onClick={() => setMostraPosticipa(false)}>✕</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const pilloleOffsets = [-3, -2, -1, 0, 1, 2, 3].map(d => giornoOffset + d)

  return (
    <div className="dashboard">
      <div className="dash-header">
        <h2>{oggi.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
        <div className="dash-controls">
          <div className="modalita-toggle">
            <button className={modalita === 'panoramica' ? 'active' : ''} onClick={() => setModalita('panoramica')}>📅 Panoramica</button>
            <button className={modalita === 'giorno' ? 'active' : ''} onClick={() => setModalita('giorno')}>🔍 Per giorno</button>
          </div>
          {modalita === 'panoramica' && (
            <div className="orizzonte-toggle">
              <button className={orizzonte === 14 ? 'active' : ''} onClick={() => setOrizzonte(14)}>2 settimane</button>
              <button className={orizzonte === 30 ? 'active' : ''} onClick={() => setOrizzonte(30)}>1 mese</button>
            </div>
          )}
        </div>
      </div>

      {modalita === 'panoramica' && (
        <>
          <section className="dash-section">
            <h3 className="dash-section-title">🧹 Pulizie oggi ({pulizieOggi.length})</h3>
            {pulizieOggi.length === 0 ? <p className="dash-empty">Nessuna pulizia prevista per oggi</p> : pulizieOggi.map(p => <PuliziaCard key={p.id} p={p} evidenzia />)}
          </section>
          <section className="dash-section">
            <h3 className="dash-section-title">📅 Prossime pulizie — {orizzonte === 14 ? '2 settimane' : '1 mese'} ({pulizieFuture.length})</h3>
            {pulizieFuture.length === 0 ? <p className="dash-empty">Nessuna pulizia nei prossimi {orizzonte} giorni</p> : pulizieFuture.map(p => <PuliziaCard key={p.id} p={p} evidenzia={false} />)}
          </section>
        </>
      )}

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
                  return (
                    <button key={offset} className={`day-pill ${giornoOffset === offset ? 'active' : ''} ${hasWork ? 'has-work' : ''} ${offset < 0 ? 'past' : ''}`} onClick={() => setGiornoOffset(offset)}>
                      <span className="day-pill-label">{offset === 0 ? 'Oggi' : d.toLocaleDateString('it-IT', { weekday: 'short' })}</span>
                      <span className="day-pill-num">{d.getDate()}</span>
                      {hasWork && <span className="day-pill-dot" />}
                    </button>
                  )
                })}
              </div>
            </div>
            <button className="day-nav-btn" onClick={() => setGiornoOffset(o => o + 1)}>›</button>
          </div>
          <h3 className="dash-section-title" style={{ marginTop: '20px' }}>🧹 Pulizie {labelGiorno(giornoOffset).toLowerCase()} ({pulizieGiornoSel.length})</h3>
          {pulizieGiornoSel.length === 0 ? <p className="dash-empty">Nessuna pulizia prevista per questo giorno</p> : pulizieGiornoSel.map(p => <PuliziaCard key={p.id} p={p} evidenzia={giornoOffset === 0} />)}
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

  const apriModifica = (d) => { setModificaId(d.id); setFormModifica({ nome_cognome: d.nome_cognome, ore_settimanali: d.ore_settimanali, patente: d.patente }) }

  const salvaModifica = async (id) => {
    if (saving) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/dipendenti/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formModifica) })
      if (res.ok) { setModificaId(null); onUpdate() } else { const d = await res.json().catch(() => ({})); alert(d.error || 'Errore') }
    } catch { alert('Errore di connessione') } finally { setSaving(false) }
  }

  const elimina = async (id, nome) => {
    if (!confirm(`Eliminare "${nome}"?`)) return
    try { const res = await fetch(`${API_URL}/dipendenti/${id}`, { method: 'DELETE' }); if (res.ok) onUpdate(); else { const d = await res.json().catch(() => ({})); alert(d.error || 'Errore') } }
    catch { alert('Errore di connessione') }
  }

  const salvanuovo = async () => {
    if (saving) return; if (!formNuovo.nome_cognome.trim()) { setErrore('Il nome è obbligatorio'); return }
    setErrore(''); setSaving(true)
    try {
      const res = await fetch(`${API_URL}/dipendenti`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formNuovo) })
      if (res.ok) { setShowNuovo(false); setFormNuovo({ nome_cognome: '', ore_settimanali: '', patente: false }); onUpdate() }
      else { const d = await res.json().catch(() => ({})); setErrore(d.error || 'Errore') }
    } catch { setErrore('Errore di connessione') } finally { setSaving(false) }
  }

  const upd = (field, value) => setFormModifica(prev => ({ ...prev, [field]: value }))

  return (
    <div className="lista-dipendenti">
      <div className="section-header">
        <h2>Dipendenti</h2>
        <button className="btn-add" onClick={() => { setShowNuovo(!showNuovo); setErrore('') }}>{showNuovo ? '✕ Annulla' : '+ Nuovo Dipendente'}</button>
      </div>
      {showNuovo && (
        <div className="nuovo-dipendente-form">
          {errore && <div className="error-message">{errore}</div>}
          <div className="form-row-3">
            <div className="form-group"><label>NOME COGNOME *</label><input type="text" value={formNuovo.nome_cognome} onChange={e => setFormNuovo({ ...formNuovo, nome_cognome: e.target.value })} placeholder="Es. Mario Rossi" /></div>
            <div className="form-group"><label>ORE CONTRATTUALI/SETTIMANA</label><input type="number" min="1" max="50" value={formNuovo.ore_settimanali} onChange={e => setFormNuovo({ ...formNuovo, ore_settimanali: e.target.value })} placeholder="Es. 40" /></div>
            <div className="form-group patente-group"><label>PATENTE</label><div className="toggle-patente"><input type="checkbox" id="patente-nuovo" checked={formNuovo.patente} onChange={e => setFormNuovo({ ...formNuovo, patente: e.target.checked })} /><label htmlFor="patente-nuovo" className="toggle-label">{formNuovo.patente ? '✅ Sì' : '❌ No'}</label></div></div>
          </div>
          <button className="btn-save-inline" onClick={salvanuovo} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva Dipendente'}</button>
        </div>
      )}
      <div className="table-container">
        <table>
          <thead><tr><th>Nome Cognome</th><th>Ore/Settimana</th><th>Patente</th><th>Azioni</th></tr></thead>
          <tbody>
            {dipendenti.map(d => (
              <tr key={d.id}>
                {modificaId === d.id ? (
                  <><td><input className="edit-input" value={formModifica.nome_cognome} onChange={e => upd('nome_cognome', e.target.value)} /></td><td><input className="edit-input" type="number" value={formModifica.ore_settimanali} onChange={e => upd('ore_settimanali', e.target.value)} /></td><td><select className="edit-input" value={formModifica.patente ? 'si' : 'no'} onChange={e => upd('patente', e.target.value === 'si')}><option value="si">✅ Sì</option><option value="no">❌ No</option></select></td><td style={{ whiteSpace: 'nowrap' }}><button className="btn-icon btn-confirm" onClick={() => salvaModifica(d.id)} disabled={saving}>{saving ? '…' : '✓'}</button><button className="btn-icon btn-cancel-icon" onClick={() => setModificaId(null)}>✕</button></td></>
                ) : (
                  <><td><strong>{d.nome_cognome}</strong></td><td>{d.ore_settimanali ? `${d.ore_settimanali}h` : '-'}</td><td>{d.patente ? '✅ Sì' : '❌ No'}</td><td style={{ whiteSpace: 'nowrap' }}><button className="btn-icon btn-edit" onClick={() => apriModifica(d)}>✏️</button><button className="btn-icon btn-trash" onClick={() => elimina(d.id, d.nome_cognome)}>🗑️</button></td></>
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

  const appartamentiFiltrati = appartamenti.filter((a) => [a.nome, a.via, a.gestore, a.owner].filter(Boolean).some((v) => v.toLowerCase().includes(filtro.toLowerCase())))

  const apriModifica = (a) => { setModificaId(a.id); setFormModifica({ owner: a.owner || '', gestore: a.gestore || '', via: a.via || '', nome: a.nome || '', prezzo: a.prezzo || '', biancheria: a.biancheria || '', logistica: a.logistica || '', pulizia: a.pulizia || '', letti_max: a.letti_max || '' }) }

  const salvaModifica = async (id) => {
    if (saving) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/appartamenti/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formModifica) })
      if (res.ok) { setModificaId(null); onUpdate() } else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore') }
    } catch { alert('Errore di connessione') } finally { setSaving(false) }
  }

  const eliminaAppartamento = async (id, nome) => {
    if (!confirm(`Eliminare "${nome}"?`)) return
    try { const res = await fetch(`${API_URL}/appartamenti/${id}`, { method: 'DELETE' }); if (res.ok) onUpdate(); else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore') } }
    catch { alert('Errore di connessione') }
  }

  const aggiornaField = (field, value) => setFormModifica(prev => ({ ...prev, [field]: value }))

  return (
    <div className="lista-appartamenti">
      <h2>Appartamenti</h2>
      <input type="text" placeholder="Cerca per nome, via, owner o gestore..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="search-input" />
      <div className="table-container">
        <table>
          <thead><tr><th>Appartamento</th><th>Via</th><th>Owner</th><th>Gestore</th><th>Prezzo (€)</th><th>Biancheria (€)</th><th>Logistica (min)</th><th>Pulizia (min)</th><th>Letti Max</th><th>Azioni</th></tr></thead>
          <tbody>
            {appartamentiFiltrati.map((a) => (
              <tr key={a.id}>
                {modificaId === a.id ? (
                  <><td><input className="edit-input" value={formModifica.nome} onChange={e => aggiornaField('nome', e.target.value)} /></td><td><input className="edit-input" value={formModifica.via} onChange={e => aggiornaField('via', e.target.value)} /></td><td><input className="edit-input" value={formModifica.owner} onChange={e => aggiornaField('owner', e.target.value)} /></td><td><input className="edit-input" value={formModifica.gestore} onChange={e => aggiornaField('gestore', e.target.value)} /></td><td><input className="edit-input" type="number" step="0.01" value={formModifica.prezzo} onChange={e => aggiornaField('prezzo', e.target.value)} /></td><td><input className="edit-input" type="number" step="0.01" value={formModifica.biancheria} onChange={e => aggiornaField('biancheria', e.target.value)} /></td><td><input className="edit-input" type="number" value={formModifica.logistica} onChange={e => aggiornaField('logistica', e.target.value)} /></td><td><input className="edit-input" type="number" value={formModifica.pulizia} onChange={e => aggiornaField('pulizia', e.target.value)} /></td><td><input className="edit-input" type="number" value={formModifica.letti_max} onChange={e => aggiornaField('letti_max', e.target.value)} /></td><td style={{ whiteSpace: 'nowrap' }}><button className="btn-icon btn-confirm" onClick={() => salvaModifica(a.id)} disabled={saving}>{saving ? '…' : '✓'}</button><button className="btn-icon btn-cancel-icon" onClick={() => setModificaId(null)}>✕</button></td></>
                ) : (
                  <><td><strong>{a.nome}</strong></td><td>{a.via || '-'}</td><td>{a.owner || '-'}</td><td>{a.gestore || '-'}</td><td>{a.prezzo != null ? `€${Number(a.prezzo).toFixed(2)}` : '-'}</td><td>{a.biancheria != null ? `€${Number(a.biancheria).toFixed(2)}` : '-'}</td><td>{a.logistica != null ? `${Number(a.logistica)} min` : '-'}</td><td>{a.pulizia != null ? `${Number(a.pulizia)} min` : '-'}</td><td>{a.letti_max || '-'}</td><td style={{ whiteSpace: 'nowrap' }}><button className="btn-icon btn-edit" onClick={() => apriModifica(a)}>✏️</button><button className="btn-icon btn-trash" onClick={() => eliminaAppartamento(a.id, a.nome)}>🗑️</button></td></>
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
  const [filtroAppartamento, setFiltroAppartamento] = useState('')
  const [filtroStato, setFiltroStato] = useState('')
  const [filtroData, setFiltroData] = useState('')

  const prenotazioniFiltrate = prenotazioni.filter(p => {
    const matchApp = !filtroAppartamento || (p.appartamento_nome || '').toLowerCase().includes(filtroAppartamento.toLowerCase())
    const matchStato = !filtroStato || p.stato === filtroStato
    const matchData = !filtroData || (p.check_in && p.check_in.slice(0, 10) <= filtroData && p.check_out && p.check_out.slice(0, 10) >= filtroData)
    return matchApp && matchStato && matchData
  })

  const apriModifica = (p) => {
    setModificaId(p.id)
    setFormModifica({ appartamento_id: p.appartamento_id, check_in: p.check_in ? p.check_in.slice(0, 10) : '', check_out: p.check_out ? p.check_out.slice(0, 10) : '', num_ospiti: p.num_ospiti, note: p.note || '', stato: p.stato })
  }

  const salvaModifica = async (id) => {
    if (saving) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/prenotazioni/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formModifica) })
      if (res.ok) { setModificaId(null); onUpdate() } else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore') }
    } catch { alert('Errore di connessione') } finally { setSaving(false) }
  }

  const eliminaPrenotazione = async (id) => {
    if (!confirm('Eliminare questa prenotazione?')) return
    try { await fetch(`${API_URL}/prenotazioni/${id}`, { method: 'DELETE' }); onUpdate() }
    catch { console.error('Errore eliminazione') }
  }

  const upd = (field, value) => setFormModifica(prev => ({ ...prev, [field]: value }))
  const hasFiltri = filtroAppartamento || filtroStato || filtroData

  return (
    <div className="lista-prenotazioni">
      <div className="section-header">
        <h2>Prenotazioni</h2>
        <span className="count-badge">{prenotazioniFiltrate.length} / {prenotazioni.length}</span>
      </div>

      {/* BARRA FILTRI */}
      <div className="filtri-bar">
        <input
          type="text"
          placeholder="🔍 Cerca appartamento..."
          value={filtroAppartamento}
          onChange={e => setFiltroAppartamento(e.target.value)}
          className="search-input filtro-input"
        />
        <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)} className="filtro-select">
          <option value="">Tutti gli stati</option>
          <option value="confermata">Confermata</option>
          <option value="in_attesa">In attesa</option>
          <option value="cancellata">Cancellata</option>
        </select>
        <div className="filtro-data-group">
          <label className="filtro-data-label">Attive il:</label>
          <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} className="filtro-date" />
        </div>
        {hasFiltri && <button className="btn-reset-filtri" onClick={() => { setFiltroAppartamento(''); setFiltroStato(''); setFiltroData('') }}>✕ Reset</button>}
      </div>

      {prenotazioniFiltrate.length === 0 ? (
        <p className="empty-message">{hasFiltri ? 'Nessuna prenotazione corrisponde ai filtri' : 'Nessuna prenotazione presente'}</p>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Appartamento</th><th>Check-in</th><th>Check-out</th><th>Ospiti</th><th>Note</th><th>Stato</th><th>Azioni</th></tr></thead>
            <tbody>
              {prenotazioniFiltrate.map((p) => (
                <tr key={p.id}>
                  {modificaId === p.id ? (
                    <><td><select className="edit-input" value={formModifica.appartamento_id} onChange={e => upd('appartamento_id', e.target.value)}>{appartamenti.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></td><td><input className="edit-input" type="date" value={formModifica.check_in} onChange={e => upd('check_in', e.target.value)} /></td><td><input className="edit-input" type="date" value={formModifica.check_out} onChange={e => upd('check_out', e.target.value)} /></td><td><input className="edit-input" type="number" min="1" value={formModifica.num_ospiti} onChange={e => upd('num_ospiti', e.target.value)} /></td><td><input className="edit-input" value={formModifica.note} onChange={e => upd('note', e.target.value)} /></td><td><select className="edit-input" value={formModifica.stato} onChange={e => upd('stato', e.target.value)}><option value="confermata">confermata</option><option value="in_attesa">in_attesa</option><option value="cancellata">cancellata</option></select></td><td style={{ whiteSpace: 'nowrap' }}><button className="btn-icon btn-confirm" onClick={() => salvaModifica(p.id)} disabled={saving}>{saving ? '…' : '✓'}</button><button className="btn-icon btn-cancel-icon" onClick={() => setModificaId(null)}>✕</button></td></>
                  ) : (
                    <><td><strong>{p.appartamento_nome}</strong></td><td>{p.check_in ? new Date(p.check_in).toLocaleDateString('it-IT') : '-'}</td><td>{p.check_out ? new Date(p.check_out).toLocaleDateString('it-IT') : '-'}</td><td>{p.num_ospiti}</td><td>{p.note || '-'}</td><td><span className={`stato-badge ${p.stato}`}>{p.stato}</span></td><td style={{ whiteSpace: 'nowrap' }}><button className="btn-icon btn-edit" onClick={() => apriModifica(p)}>✏️</button><button className="btn-icon btn-trash" onClick={() => eliminaPrenotazione(p.id)}>🗑️</button></td></>
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
    e.preventDefault(); if (saving) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/prenotazioni`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { onSave() } else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore'); setSaving(false) }
    } catch { alert('Errore di connessione'); setSaving(false) }
  }

  return (
    <div className="nuova-prenotazione">
      <h2>Nuova Prenotazione</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label>Appartamento *</label><select required value={form.appartamento_id} onChange={(e) => setForm({ ...form, appartamento_id: e.target.value })}><option value="">Seleziona appartamento...</option>{appartamenti.map((a) => <option key={a.id} value={a.id}>{a.nome} - {a.via}</option>)}</select></div>
        <div className="form-row">
          <div className="form-group"><label>Check-in *</label><input type="date" required value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} /></div>
          <div className="form-group"><label>Check-out *</label><input type="date" required value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Numero Ospiti</label><input type="number" min="1" value={form.num_ospiti} onChange={(e) => setForm({ ...form, num_ospiti: parseInt(e.target.value) })} /></div>
        <div className="form-group"><label>Note</label><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note aggiuntive..." /></div>
        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Salvataggio...' : 'Salva Prenotazione'}</button>
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
    e.preventDefault(); if (saving) return; setErrore(''); setSaving(true)
    try {
      const res = await fetch(`${API_URL}/appartamenti`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { onSave() } else { const data = await res.json().catch(() => ({})); setErrore(data.error || 'Errore'); setSaving(false) }
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
            <input type={['prezzo','biancheria','logistica','pulizia','letti_max'].includes(field) ? 'number' : 'text'} step="0.01" value={form[field]} onChange={(e) => setForm({...form, [field]: e.target.value})} required={field === 'nome'} />
          </div>
        ))}
        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Salvataggio...' : 'Salva Appartamento'}</button>
      </form>
    </div>
  )
}

/* ---------- IMPORT ITALIANWAY ---------- */
function ImportItalianWay({ appartamenti, onImport }) {
  const [file, setFile] = useState(null)
  const [anteprima, setAnteprima] = useState([])
  const [loading, setLoading] = useState(false)
  const [risultato, setRisultato] = useState(null)
  const [erroreFile, setErroreFile] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncLog, setSyncLog] = useState([])
  const [syncingEmail, setSyncingEmail] = useState(false)
  const [syncEmailStatus, setSyncEmailStatus] = useState(null)
  const [anteprimaEmail, setAnteprimaEmail] = useState(null)
  const [importandoEmail, setImportandoEmail] = useState(false)
  const [selezionate, setSelezionate] = useState({})

  useEffect(() => { caricaSyncLog() }, [])

  const caricaSyncLog = async () => {
    try { const res = await fetch(`${API_URL}/sync/status`); setSyncLog(await res.json()) } catch {}
  }

  const eseguiSync = async (giorni = 30) => {
    setSyncing(true); setSyncStatus(null)
    try {
      const res = await fetch(`${API_URL}/sync/italianway?giorni=${giorni}`, { method: 'POST' })
      const data = await res.json(); setSyncStatus(data); caricaSyncLog()
      if (data.importate > 0) setTimeout(() => onImport(), 1500)
    } catch (err) { setSyncStatus({ error: 'Errore: ' + err.message }) } finally { setSyncing(false) }
  }

  // Legge email e mostra ANTEPRIMA prima di importare
  const leggiEmailAnteprima = async () => {
    setSyncingEmail(true); setSyncEmailStatus(null); setAnteprimaEmail(null); setSelezionate({})
    try {
      const res = await fetch(`${API_URL}/sync/email/preview`, { method: 'POST' })
      const data = await res.json()
      if (data.errore) {
        setSyncEmailStatus({ errore: data.errore })
      } else if (!data.prenotazioni || data.prenotazioni.length === 0) {
        setSyncEmailStatus({ processate: data.processate || 0, importate: 0, cancellate: 0, saltate: data.saltate || 0, messaggio: 'Nessuna prenotazione trovata nelle email non lette.' })
      } else {
        const sel = {}; data.prenotazioni.forEach((_, i) => { sel[i] = true }); setSelezionate(sel); setAnteprimaEmail(data)
      }
    } catch (err) { setSyncEmailStatus({ errore: 'Errore: ' + err.message }) } finally { setSyncingEmail(false) }
  }

  const confermaImportEmail = async () => {
    if (!anteprimaEmail) return; setImportandoEmail(true)
    const prenotazioniDaImportare = anteprimaEmail.prenotazioni.filter((_, i) => selezionate[i])
    try {
      const res = await fetch(`${API_URL}/sync/email/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prenotazioni: prenotazioniDaImportare, messageIds: anteprimaEmail.messageIds }) })
      const data = await res.json(); setAnteprimaEmail(null); setSyncEmailStatus(data)
      if (data.importate > 0 || data.cancellate > 0) onImport()
    } catch (err) { setSyncEmailStatus({ errore: 'Errore: ' + err.message }) } finally { setImportandoEmail(false) }
  }

  const matchApp = (nome) => appartamenti.find(a => a.nome.toLowerCase() === nome.toLowerCase() || nome.toLowerCase().includes(a.nome.toLowerCase()) || a.nome.toLowerCase().includes(nome.toLowerCase()))

  const excelDateToISO = (v) => {
    if (!v) return null
    if (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/)) return v.slice(0, 10)
    if (typeof v === 'number') { const ms = (v - 25569) * 86400000; return new Date(ms).toISOString().slice(0, 10) }
    return null
  }

  const leggiFile = (f) => {
    setErroreFile(''); setRisultato(null); setAnteprima([])
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        if (typeof XLSX === 'undefined') { setErroreFile('Libreria XLSX non caricata.'); return }
        const wb = XLSX.read(e.target.result, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
        let headerIdx = rows.findIndex(r => r.some(c => String(c).includes('API ID')))
        if (headerIdx === -1) { setErroreFile('Formato non riconosciuto'); return }
        const headers = rows[headerIdx].map(h => String(h || '').trim())
        const dataRows = rows.slice(headerIdx + 1).filter(r => r.length > 2 && r[0])
        const idxOf = (name) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
        const righe = dataRows.map(r => ({
          api_id: r[idxOf('API ID')], appartamento: String(r[idxOf('Appartamento')] || '').trim(),
          check_out: excelDateToISO(r[idxOf('Data')]), check_in: excelDateToISO(r[idxOf('Prox. check-in')]),
          ospiti_entranti: parseInt(r[idxOf('Ospiti entranti')]) || 0, ospiti_uscenti: parseInt(r[idxOf('Ospiti uscenti')]) || 0,
          note: String(r[idxOf('Note')] || '').trim(), categoria: String(r[idxOf('Categoria')] || '').trim(),
        })).filter(r => r.appartamento && r.check_out)
        setAnteprima(righe)
      } catch (err) { setErroreFile('Errore lettura: ' + err.message) }
    }
    reader.readAsArrayBuffer(f)
  }

  const handleFile = (e) => { const f = e.target.files[0]; if (f) { setFile(f); leggiFile(f) } }
  const handleDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.name.endsWith('.xlsx')) { setFile(f); leggiFile(f) } }

  const eseguiImport = async () => {
    if (!anteprima.length) return; setLoading(true); setRisultato(null)
    try {
      const res = await fetch(`${API_URL}/import/italianway`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ righe: anteprima }) })
      const data = await res.json(); setRisultato(data); if (data.importate > 0) setTimeout(() => onImport(), 1500)
    } catch { setRisultato({ importate: 0, saltate: 0, errori: ['Errore di connessione'] }) } finally { setLoading(false) }
  }

  const fmtData = (d) => { if (!d) return '—'; const [y, m, dd] = d.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) }

  return (
    <div className="import-italianway">
      <h2>⬆ Import da ItalianWay</h2>
      <p className="import-desc">Sincronizza automaticamente da KALISI oppure importa manualmente un file Excel.</p>

      {/* SYNC KALISI */}
      <div className="sync-panel">
        <div className="sync-panel-header">
          <div><h3>🔄 Sincronizzazione automatica</h3><p className="sync-desc">Legge da KALISI senza scaricare file. Attivo ogni giorno alle 04:00 e 09:00.</p></div>
          <div className="sync-buttons">
            <button className="btn-sync" onClick={() => eseguiSync(14)} disabled={syncing}>{syncing ? '⏳ Sync...' : '🔄 Sync 2 settimane'}</button>
            <button className="btn-sync btn-sync-month" onClick={() => eseguiSync(30)} disabled={syncing}>{syncing ? '⏳ Sync...' : '🔄 Sync 1 mese'}</button>
          </div>
        </div>
        {syncing && <div className="sync-loading"><div className="sync-spinner" />Connessione a KALISI... 30-60 secondi</div>}
        {syncStatus && !syncing && (
          <div className={`import-result ${syncStatus.error ? 'result-warn' : syncStatus.importate > 0 ? 'result-ok' : 'result-warn'}`}>
            {syncStatus.error ? <div className="result-row">❌ {syncStatus.error}</div> : <><div className="result-row">✅ Importate: <strong>{syncStatus.importate}</strong></div><div className="result-row">⏭ Saltate: <strong>{syncStatus.saltate}</strong></div></>}
          </div>
        )}
        {syncLog.length > 0 && (
          <div className="sync-log"><strong>Ultimi sync:</strong>
            {syncLog.map((s, i) => <div key={i} className="sync-log-row"><span className="sync-log-date">{new Date(s.eseguito_il).toLocaleString('it-IT')}</span><span className="sync-log-ok">✅ {s.importate} importate</span><span className="sync-log-skip">⏭ {s.saltate} saltate</span></div>)}
          </div>
        )}
      </div>

      {/* SYNC EMAIL CON ANTEPRIMA */}
      <div className="sync-panel" style={{ marginTop: '16px' }}>
        <div className="sync-panel-header">
          <div>
            <h3>📧 Sync da Email</h3>
            <p className="sync-desc">Legge le email non lette su prenotazionepuliziepl2@gmail.com e mostra un'anteprima prima di importare.{' '}<a href="https://gestione-prenotazioni-production.up.railway.app/auth/google" target="_blank" rel="noreferrer" style={{color:'#2d5a3d'}}>Autorizza Gmail →</a></p>
          </div>
          <button className="btn-sync" onClick={leggiEmailAnteprima} disabled={syncingEmail || importandoEmail}>
            {syncingEmail ? '⏳ Lettura...' : '📧 Leggi email ora'}
          </button>
        </div>

        {syncingEmail && <div className="sync-loading"><div className="sync-spinner" />Lettura e analisi email in corso...</div>}

        {/* TABELLA ANTEPRIMA */}
        {anteprimaEmail && !syncingEmail && (
          <div className="email-preview-panel">
            <div className="email-preview-header">
              <h4>📋 Anteprima — {anteprimaEmail.prenotazioni.length} prenotazioni trovate in {anteprimaEmail.emailAnalizzate} email</h4>
              <p className="email-preview-sub">Seleziona le prenotazioni da importare e clicca Conferma</p>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{width:'40px'}}>
                      <input type="checkbox" checked={Object.values(selezionate).every(v => v)}
                        onChange={e => { const sel = {}; anteprimaEmail.prenotazioni.forEach((_, i) => { sel[i] = e.target.checked }); setSelezionate(sel) }} />
                    </th>
                    <th>Appartamento</th><th>Match DB</th><th>Check-in</th><th>Check-out</th><th>Ospiti</th><th>Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {anteprimaEmail.prenotazioni.map((p, i) => {
                    const match = matchApp(p.appartamento)
                    return (
                      <tr key={i} style={{ opacity: selezionate[i] ? 1 : 0.4 }}>
                        <td><input type="checkbox" checked={!!selezionate[i]} onChange={e => setSelezionate(prev => ({ ...prev, [i]: e.target.checked }))} /></td>
                        <td><strong>{p.appartamento}</strong></td>
                        <td>{match ? <span className="match-ok">✅ {match.nome}</span> : <span className="match-ko">⚠️ non trovato</span>}</td>
                        <td>{fmtData(p.check_in)}</td>
                        <td>{fmtData(p.check_out)}</td>
                        <td>{p.ospiti || '—'}</td>
                        <td><span className={`azione-badge ${p.azione === 'cancella' ? 'azione-cancella' : 'azione-nuova'}`}>{p.azione === 'cancella' ? '🗑 Cancella' : '✅ Nuova'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="email-preview-actions">
              <span className="email-preview-count">{Object.values(selezionate).filter(Boolean).length} selezionate su {anteprimaEmail.prenotazioni.length}</span>
              <button className="btn-reset-filtri" onClick={() => setAnteprimaEmail(null)}>✕ Annulla</button>
              <button className="btn-import" onClick={confermaImportEmail} disabled={importandoEmail || Object.values(selezionate).every(v => !v)}>
                {importandoEmail ? '⏳ Importazione...' : `✅ Conferma (${Object.values(selezionate).filter(Boolean).length})`}
              </button>
            </div>
          </div>
        )}

        {syncEmailStatus && !syncingEmail && !anteprimaEmail && (
          <div className={`import-result ${syncEmailStatus.errore ? 'result-warn' : 'result-ok'}`} style={{marginTop:'12px'}}>
            {syncEmailStatus.errore ? <div className="result-row">❌ {syncEmailStatus.errore}</div>
              : syncEmailStatus.messaggio ? <div className="result-row">ℹ️ {syncEmailStatus.messaggio}</div>
              : <><div className="result-row">📨 Email analizzate: <strong>{syncEmailStatus.processate}</strong></div><div className="result-row">✅ Importate: <strong>{syncEmailStatus.importate}</strong></div><div className="result-row">🗑 Cancellate: <strong>{syncEmailStatus.cancellate}</strong></div><div className="result-row">⏭ Non rilevanti: <strong>{syncEmailStatus.saltate}</strong></div>{syncEmailStatus.errori?.length > 0 && <div className="result-errors"><strong>Appartamenti non trovati:</strong><ul>{syncEmailStatus.errori.map((e,i) => <li key={i}>{e}</li>)}</ul></div>}</>
            }
          </div>
        )}
      </div>

      <div className="import-divider">oppure importa manualmente da Excel</div>

      <div className={`drop-zone ${file ? 'has-file' : ''}`} onDragOver={e => e.preventDefault()} onDrop={handleDrop} onClick={() => document.getElementById('xlsx-input').click()}>
        <input id="xlsx-input" type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFile} />
        {file ? <div className="drop-zone-ok"><span className="drop-icon">✅</span><span>{file.name}</span><span className="drop-sub">{anteprima.length} righe trovate — clicca per cambiare</span></div> : <div className="drop-zone-empty"><span className="drop-icon">📂</span><span>Trascina il file .xlsx qui oppure clicca per selezionarlo</span></div>}
      </div>

      {erroreFile && <div className="error-message">{erroreFile}</div>}

      {anteprima.length > 0 && !risultato && (
        <div className="import-preview">
          <h3>Anteprima ({anteprima.length} pulizie)</h3>
          <div className="table-container">
            <table>
              <thead><tr><th>Appartamento</th><th>Match DB</th><th>Check-out</th><th>Prossimo check-in</th><th>Ospiti</th><th>Note</th></tr></thead>
              <tbody>
                {anteprima.map((r, i) => { const match = matchApp(r.appartamento); return (<tr key={i}><td><strong>{r.appartamento}</strong></td><td>{match ? <span className="match-ok">✅ {match.nome}</span> : <span className="match-ko">⚠️ non trovato</span>}</td><td>{r.check_out}</td><td>{r.check_in || '—'}</td><td>{r.ospiti_entranti || '—'}</td><td style={{ fontSize: '12px', color: '#777' }}>{[r.categoria !== '-' ? r.categoria : '', r.note !== '-' ? r.note : ''].filter(Boolean).join(' | ') || '—'}</td></tr>) })}
              </tbody>
            </table>
          </div>
          <div className="import-warning">⚠️ Le righe con "non trovato" verranno saltate.</div>
          <button className="btn-import" onClick={eseguiImport} disabled={loading}>{loading ? 'Importazione...' : `⬆ Importa ${anteprima.length} prenotazioni`}</button>
        </div>
      )}

      {risultato && (
        <div className={`import-result ${risultato.importate > 0 ? 'result-ok' : 'result-warn'}`}>
          <div className="result-row">✅ Importate: <strong>{risultato.importate}</strong></div>
          <div className="result-row">⏭ Saltate: <strong>{risultato.saltate}</strong></div>
          {risultato.errori?.length > 0 && <div className="result-errors"><strong>Dettagli:</strong><ul>{risultato.errori.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          {risultato.importate > 0 && <p style={{ marginTop: '10px', color: '#2d6a4f' }}>Reindirizzamento...</p>}
        </div>
      )}
    </div>
  )
}

export default App
