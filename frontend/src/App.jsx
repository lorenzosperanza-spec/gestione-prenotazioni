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
    } catch (err) { console.error('Errore caricamento dati:', err) }
    finally { setLoading(false) }
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
          <button className={vista === 'import' ? 'active' : ''} onClick={() => setVista('import')}>⬆ Import</button>
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

  const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
  const giornoSelezionato = new Date(oggi); giornoSelezionato.setDate(oggi.getDate() + giornoOffset)
  const fineOrizzonte = new Date(oggi); fineOrizzonte.setDate(oggi.getDate() + orizzonte)

  const toDateStr = (d) => {
    if (typeof d === 'string') return d.slice(0, 10)
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  const prossimaPren = (appartamento_id, checkOutStr) => {
    return prenotazioni.filter(p => String(p.appartamento_id) === String(appartamento_id) && toDateStr(p.check_in) >= checkOutStr && toDateStr(p.check_out) !== checkOutStr && p.stato !== 'cancellata')
      .sort((a, b) => toDateStr(a.check_in).localeCompare(toDateStr(b.check_in)))[0] || null
  }

  const filtraPerGiorno = (giorno) => {
    const giornoStr = toDateStr(giorno)
    const normali = prenotazioni.filter(p => toDateStr(p.check_out) === giornoStr && p.tipo !== 'spot').map(p => ({ ...p, prossima: prossimaPren(p.appartamento_id, toDateStr(p.check_out)) }))
    const spot = prenotazioni.filter(p => p.tipo === 'spot' && toDateStr(p.check_out) === giornoStr).map(p => ({ ...p, prossima: null }))
    return [...normali, ...spot]
  }

  const pulizieOggi = filtraPerGiorno(oggi)
  const domani = new Date(oggi); domani.setDate(oggi.getDate() + 1)
  const pulizieFuture = prenotazioni.filter(p => { const co = toDateStr(p.check_out); return co >= toDateStr(domani) && co <= toDateStr(fineOrizzonte) })
    .sort((a, b) => toDateStr(a.check_out).localeCompare(toDateStr(b.check_out))).map(p => ({ ...p, prossima: prossimaPren(p.appartamento_id, toDateStr(p.check_out)) }))
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
    const gg = p.tipo === 'spot' ? 0 : giorniA(p.check_out)
    const label = gg === 0 ? 'oggi' : gg === 1 ? 'domani' : gg === -1 ? 'ieri' : gg > 0 ? `tra ${gg} giorni` : `${Math.abs(gg)} giorni fa`
    const dipAssegnato = assegnazioni[p.id] !== undefined ? assegnazioni[p.id] : (p.dipendente_id || '')
    const statoPulizia = p.stato_pulizia || 'da_fare'
    const [mostraPosticipa, setMostraPosticipa] = useState(false)
    const [nuovaData, setNuovaData] = useState('')
    const [editNote, setEditNote] = useState(false)
    const [noteText, setNoteText] = useState(p.note || '')
    const cardClass = `pulizia-card ${evidenzia ? 'pulizia-oggi' : ''} ${statoPulizia === 'completata' ? 'pulizia-completata' : ''} ${statoPulizia === 'posticipata' ? 'pulizia-posticipata' : ''} ${p.tipo === 'spot' ? 'pulizia-spot' : ''}`

    const salvaNota = async () => {
      try {
        await fetch(`${API_URL}/prenotazioni/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...p, appartamento_id: p.appartamento_id, note: noteText }) })
        caricaDati(); setEditNote(false)
      } catch (err) { console.error('Errore salvataggio nota:', err) }
    }

    return (
      <div className={cardClass}>
        <div className="pulizia-header">
          <div className="pulizia-header-left">
            <span className="pulizia-nome">{p.appartamento_nome}</span>
            {p.tipo === 'spot' && <span className="badge-spot">🧹 Pulizia Spot</span>}
            {statoPulizia === 'completata' && <span className="badge-completata">✅ Completata</span>}
            {statoPulizia === 'posticipata' && <span className="badge-posticipata">⏭ Posticipata</span>}
          </div>
          <div className="pulizia-header-right">
            <select className="assegna-select" value={dipAssegnato} onChange={e => salvaAssegnazione(p.id, e.target.value)}>
              <option value="">👤 Assegna...</option>
              {dipendenti.map(d => <option key={d.id} value={d.id}>{d.nome_cognome}{d.patente ? ' 🚗' : ''}</option>)}
            </select>
            {modalita === 'panoramica' && p.tipo !== 'spot' && (
              <span className={`pulizia-quando ${gg === 0 ? 'tag-oggi' : gg === 1 ? 'tag-domani' : gg < 0 ? 'tag-passato' : 'tag-futuro'}`}>🧹 {label}</span>
            )}
          </div>
        </div>
        <div className="pulizia-body">
          <div className="pulizia-info">
            {p.tipo === 'spot' ? <span>👥 Ospiti da preparare: <strong>{p.num_ospiti}</strong></span> : (
              <>
                <span>🚪 Check-out: <strong>{fmtData(p.check_out)}</strong></span>
                {p.prossima ? (<><span>✅ Prossimo check-in: <strong>{fmtData(p.prossima.check_in)}</strong></span><span>👥 Ospiti in arrivo: <strong>{p.prossima.num_ospiti}</strong></span></>) : <span className="nessuna-pren">— nessuna prenotazione successiva</span>}
              </>
            )}
          </div>
          <div className="pulizia-note-section">
            {editNote ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                <input className="edit-input" style={{ flex: 1 }} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Aggiungi nota..." autoFocus onKeyDown={e => { if (e.key === 'Enter') salvaNota(); if (e.key === 'Escape') setEditNote(false); }} />
                <button className="btn-pulizia btn-completa" onClick={salvaNota}>✓</button>
                <button className="btn-pulizia btn-annulla-stato" onClick={() => { setEditNote(false); setNoteText(p.note || ''); }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', cursor: 'pointer' }} onClick={() => setEditNote(true)}>
                {noteText ? <span className="pulizia-note-text">📋 {noteText} <span style={{ color: '#aaa', fontSize: '11px' }}>✏️</span></span> : <span style={{ color: '#aaa', fontSize: '12px' }}>+ Aggiungi nota ✏️</span>}
              </div>
            )}
          </div>
        </div>
        <div className="pulizia-azioni">
          {statoPulizia !== 'completata' && <button className="btn-pulizia btn-completa" onClick={() => salvaStatoPulizia(p.id, 'completata')}>✅ Segna completata</button>}
          {statoPulizia === 'completata' && <button className="btn-pulizia btn-annulla-stato" onClick={() => salvaStatoPulizia(p.id, 'da_fare')}>↩ Annulla</button>}
          {statoPulizia !== 'completata' && !mostraPosticipa && p.tipo !== 'spot' && <button className="btn-pulizia btn-posticipa" onClick={() => setMostraPosticipa(true)}>⏭ Posticipa</button>}
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

  const appartamentiFiltrati = appartamenti.filter(a => [a.nome, a.via, a.gestore, a.owner].filter(Boolean).some(v => v.toLowerCase().includes(filtro.toLowerCase())))
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
      <input type="text" placeholder="Cerca per nome, via, owner o gestore..." value={filtro} onChange={e => setFiltro(e.target.value)} className="search-input" />
      <div className="table-container">
        <table>
          <thead><tr><th>Appartamento</th><th>Via</th><th>Owner</th><th>Gestore</th><th>Prezzo (€)</th><th>Biancheria (€)</th><th>Logistica (min)</th><th>Pulizia (min)</th><th>Letti Max</th><th>Azioni</th></tr></thead>
          <tbody>
            {appartamentiFiltrati.map(a => (
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

  const apriModifica = (p) => { setModificaId(p.id); setFormModifica({ appartamento_id: p.appartamento_id, check_in: p.check_in ? p.check_in.slice(0, 10) : '', check_out: p.check_out ? p.check_out.slice(0, 10) : '', num_ospiti: p.num_ospiti, note: p.note || '', stato: p.stato }) }
  const salvaModifica = async (id) => {
    if (saving) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/prenotazioni/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formModifica) })
      if (res.ok) { setModificaId(null); onUpdate() } else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore') }
    } catch { alert('Errore di connessione') } finally { setSaving(false) }
  }
  const eliminaPrenotazione = async (id) => {
    if (!confirm('Eliminare questa prenotazione?')) return
    try { await fetch(`${API_URL}/prenotazioni/${id}`, { method: 'DELETE' }); onUpdate() } catch { console.error('Errore eliminazione') }
  }
  const upd = (field, value) => setFormModifica(prev => ({ ...prev, [field]: value }))
  const hasFiltri = filtroAppartamento || filtroStato || filtroData

  return (
    <div className="lista-prenotazioni">
      <div className="section-header">
        <h2>Prenotazioni</h2>
        <span className="count-badge">{prenotazioniFiltrate.length} / {prenotazioni.length}</span>
      </div>
      <div className="filtri-bar">
        <input type="text" placeholder="🔍 Cerca appartamento..." value={filtroAppartamento} onChange={e => setFiltroAppartamento(e.target.value)} className="search-input filtro-input" />
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
              {prenotazioniFiltrate.map(p => (
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
  const [tipo, setTipo] = useState('prenotazione')
  const [form, setForm] = useState({ appartamento_id: '', check_in: '', check_out: '', num_ospiti: 1, note: '' })
  const [formSpot, setFormSpot] = useState({ appartamento_id: '', data: '', num_ospiti: 1, note: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); if (saving) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/prenotazioni`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { onSave() } else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore'); setSaving(false) }
    } catch { alert('Errore di connessione'); setSaving(false) }
  }

  const handleSubmitSpot = async (e) => {
    e.preventDefault(); if (saving) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/prenotazioni`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appartamento_id: formSpot.appartamento_id, check_in: formSpot.data, check_out: formSpot.data, num_ospiti: formSpot.num_ospiti, note: formSpot.note, tipo: 'spot', stato: 'confermata' }) })
      if (res.ok) { onSave() } else { const data = await res.json().catch(() => ({})); alert(data.error || 'Errore'); setSaving(false) }
    } catch { alert('Errore di connessione'); setSaving(false) }
  }

  return (
    <div className="nuova-prenotazione">
      <h2>Nuova Prenotazione</h2>
      <div className="modalita-toggle" style={{ marginBottom: '24px' }}>
        <button className={tipo === 'prenotazione' ? 'active' : ''} onClick={() => setTipo('prenotazione')}>📅 Prenotazione</button>
        <button className={tipo === 'spot' ? 'active' : ''} onClick={() => setTipo('spot')}>🧹 Pulizia Spot</button>
      </div>
      {tipo === 'prenotazione' && (
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Appartamento *</label><select required value={form.appartamento_id} onChange={e => setForm({ ...form, appartamento_id: e.target.value })}><option value="">Seleziona appartamento...</option>{appartamenti.map(a => <option key={a.id} value={a.id}>{a.nome} - {a.via}</option>)}</select></div>
          <div className="form-row">
            <div className="form-group"><label>Check-in *</label><input type="date" required value={form.check_in} onChange={e => setForm({ ...form, check_in: e.target.value })} /></div>
            <div className="form-group"><label>Check-out *</label><input type="date" required value={form.check_out} onChange={e => setForm({ ...form, check_out: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Numero Ospiti</label><input type="number" min="1" value={form.num_ospiti} onChange={e => setForm({ ...form, num_ospiti: parseInt(e.target.value) })} /></div>
          <div className="form-group"><label>Note</label><textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Note aggiuntive..." /></div>
          <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Salvataggio...' : 'Salva Prenotazione'}</button>
        </form>
      )}
      {tipo === 'spot' && (
        <form onSubmit={handleSubmitSpot}>
          <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>Una pulizia spot è una pulizia una tantum non legata a un check-in/check-out.</p>
          <div className="form-group"><label>Appartamento *</label><select required value={formSpot.appartamento_id} onChange={e => setFormSpot({ ...formSpot, appartamento_id: e.target.value })}><option value="">Seleziona appartamento...</option>{appartamenti.map(a => <option key={a.id} value={a.id}>{a.nome} - {a.via}</option>)}</select></div>
          <div className="form-group"><label>Data pulizia *</label><input type="date" required value={formSpot.data} onChange={e => setFormSpot({ ...formSpot, data: e.target.value })} /></div>
          <div className="form-group"><label>Numero ospiti da preparare</label><input type="number" min="1" value={formSpot.num_ospiti} onChange={e => setFormSpot({ ...formSpot, num_ospiti: parseInt(e.target.value) })} /></div>
          <div className="form-group"><label>Note</label><textarea value={formSpot.note} onChange={e => setFormSpot({ ...formSpot, note: e.target.value })} placeholder="Es. pulire anche balcone, cambiare lenzuola..." /></div>
          <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Salvataggio...' : '🧹 Salva Pulizia Spot'}</button>
        </form>
      )}
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
            <input type={['prezzo','biancheria','logistica','pulizia','letti_max'].includes(field) ? 'number' : 'text'} step="0.01" value={form[field]} onChange={e => setForm({...form, [field]: e.target.value})} required={field === 'nome'} />
          </div>
        ))}
        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Salvataggio...' : 'Salva Appartamento'}</button>
      </form>
    </div>
  )
}

/* ---------- IMPORT ---------- */
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
  const [emailMatchOverride, setEmailMatchOverride] = useState({})
  const [importandoEmail, setImportandoEmail] = useState(false)
  const [selezionate, setSelezionate] = useState({})

  // Smoobu
  const [smoobuFile, setSmoobuFile] = useState(null)
  const [smoobuAnteprima, setSmoobuAnteprima] = useState([])
  const [smoobuLoading, setSmoobuLoading] = useState(false)
  const [smoobuRisultato, setSmoobuRisultato] = useState(null)
  const [smoobuErrore, setSmoobuErrore] = useState('')
  const [smoobuMappingTemp, setSmoobuMappingTemp] = useState({})
  const [smoobuSelezione, setSmoobuSelezione] = useState({})
  const [smoobuOspitiOverride, setSmoobuOspitiOverride] = useState({})

  // Google Sheet
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetAnteprima, setSheetAnteprima] = useState(null)
  const [sheetRisultato, setSheetRisultato] = useState(null)
  const [sheetTabs, setSheetTabs] = useState([])
  const [sheetTabSelezionato, setSheetTabSelezionato] = useState('')
  const [sheetSelezione, setSheetSelezione] = useState({})
  const [sheetMatchOverride, setSheetMatchOverride] = useState({})

  // SmartPMS
  const [smartpmsLoading, setSmartpmsLoading] = useState(false)
  const [smartpmsAnteprima, setSmartpmsAnteprima] = useState([])
  const [smartpmsRisultato, setSmartpmsRisultato] = useState(null)
  const [smartpmsSelezione, setSmartpmsSelezione] = useState({})
  const [smartpmsMappingTemp, setSmartpmsMappingTemp] = useState({})
  const [smartpmsOspitiOverride, setSmartpmsOspitiOverride] = useState({})

  useEffect(() => { caricaSyncLog() }, [])
  const caricaSyncLog = async () => { try { const res = await fetch(`${API_URL}/sync/status`); setSyncLog(await res.json()) } catch {} }

  const eseguiSync = async (giorni = 30) => {
    setSyncing(true); setSyncStatus(null)
    try { const res = await fetch(`${API_URL}/sync/italianway?giorni=${giorni}`, { method: 'POST' }); const data = await res.json(); setSyncStatus(data); caricaSyncLog(); if (data.importate > 0) setTimeout(() => onImport(), 1500) }
    catch (err) { setSyncStatus({ error: 'Errore: ' + err.message }) } finally { setSyncing(false) }
  }

  const leggiEmailAnteprima = async () => {
    setSyncingEmail(true); setSyncEmailStatus(null); setAnteprimaEmail(null); setSelezionate({})
    try {
      const res = await fetch(`${API_URL}/sync/email/preview`, { method: 'POST' })
      const data = await res.json()
      if (data.errore) { setSyncEmailStatus({ errore: data.errore }) }
      else if (!data.prenotazioni || data.prenotazioni.length === 0) { setSyncEmailStatus({ messaggio: 'Nessuna prenotazione trovata nelle email.' }) }
      else { const sel = {}; data.prenotazioni.forEach((_, i) => { sel[i] = true }); setSelezionate(sel); setAnteprimaEmail(data) }
    } catch (err) { setSyncEmailStatus({ errore: 'Errore: ' + err.message }) } finally { setSyncingEmail(false) }
  }

  const confermaImportEmail = async () => {
    if (!anteprimaEmail) return; setImportandoEmail(true)
    const prenotazioniDaImportare = anteprimaEmail.prenotazioni.filter((_, i) => selezionate[i]).map(p => {
      const i = anteprimaEmail.prenotazioni.indexOf(p)
      return emailMatchOverride[i] ? { ...p, appartamento_id_override: parseInt(emailMatchOverride[i]) } : p
    })
    try {
      const res = await fetch(`${API_URL}/sync/email/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prenotazioni: prenotazioniDaImportare, msgIds: anteprimaEmail.msgIds, labelIds: anteprimaEmail.labelIds }) })
      const data = await res.json(); setAnteprimaEmail(null); setSyncEmailStatus(data); setEmailMatchOverride({})
      if (data.importate > 0 || data.cancellate > 0) onImport()
    } catch (err) { setSyncEmailStatus({ errore: 'Errore: ' + err.message }) } finally { setImportandoEmail(false) }
  }

  const matchApp = (nome) => appartamenti.find(a => a.nome.toLowerCase() === nome.toLowerCase() || nome.toLowerCase().includes(a.nome.toLowerCase()) || a.nome.toLowerCase().includes(nome.toLowerCase()))

  const smoobuDateToISO = (v) => {
    if (!v) return null
    const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
    if (m) { const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0'), yy = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${yy}-${mm}-${dd}` }
    return null
  }

  const leggiSmoobuCSV = (f) => {
    setSmoobuErrore(''); setSmoobuRisultato(null); setSmoobuAnteprima([])
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result, lines = text.split('\n').filter(l => l.trim())
        if (lines.length < 2) { setSmoobuErrore('File vuoto'); return }
        const headers = lines[0].replace(/^\uFEFF/, '').split(';').map(h => h.replace(/"/g, '').trim())
        const idxOf = (name) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
        const iApp = idxOf('Proprietà') !== -1 ? idxOf('Proprietà') : idxOf('Propr'), iArrivo = idxOf('Arrivo'), iPartenza = idxOf('Partenza')
        const iAdulti = idxOf('Adulti'), iBambini = idxOf('Bambini'), iNote = idxOf('Note assistente') !== -1 ? idxOf('Note assistente') : idxOf('Note')
        const iPortale = idxOf('Portale'), iStato = idxOf('stato')
        const righe = lines.slice(1).map(line => {
          const cols = line.split(';').map(c => c.replace(/"/g, '').trim())
          if ((cols[iStato] || '').toLowerCase().includes('cancell')) return null
          const appartamento = cols[iApp] || '', check_in = smoobuDateToISO(cols[iArrivo]), check_out = smoobuDateToISO(cols[iPartenza])
          if (!appartamento || !check_in || !check_out) return null
          return { appartamento, check_in, check_out, num_ospiti: (parseInt(cols[iAdulti]) || 0) + (parseInt(cols[iBambini]) || 0) || 1, portale: cols[iPortale] || '', note: cols[iNote] || '' }
        }).filter(Boolean)
        setSmoobuAnteprima(righe)
      } catch (err) { setSmoobuErrore('Errore lettura: ' + err.message) }
    }
    reader.readAsText(f, 'utf-8')
  }

  const handleSmoobuFile = (e) => { const f = e.target.files[0]; if (f) { setSmoobuFile(f); leggiSmoobuCSV(f) } }

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
        const wb = XLSX.read(e.target.result, { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]], rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
        let headerIdx = rows.findIndex(r => r.some(c => String(c).includes('API ID')))
        if (headerIdx === -1) { setErroreFile('Formato non riconosciuto'); return }
        const headers = rows[headerIdx].map(h => String(h || '').trim())
        const idxOf = (name) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
        const righe = rows.slice(headerIdx + 1).filter(r => r.length > 2 && r[0]).map(r => ({
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
      <h2>⬆ Import</h2>
      <p className="import-desc">Sincronizza da KALISI, Smoobu, SmartPMS, Google Sheet, Email o importa manualmente da Excel.</p>

      {/* SYNC KALISI */}
      <div className="sync-panel">
        <div className="sync-panel-header">
          <div><h3>🔄 Sync ItalianWay (KALISI)</h3><p className="sync-desc">Attivo automaticamente alle 02:00 e 07:00 UTC.</p></div>
          <div className="sync-buttons">
            <button className="btn-sync" onClick={() => eseguiSync(14)} disabled={syncing}>{syncing ? '⏳ Sync...' : '🔄 2 settimane'}</button>
            <button className="btn-sync btn-sync-month" onClick={() => eseguiSync(30)} disabled={syncing}>{syncing ? '⏳ Sync...' : '🔄 1 mese'}</button>
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
            {syncLog.map((s, i) => <div key={i} className="sync-log-row"><span className="sync-log-date">{new Date(s.eseguito_il).toLocaleString('it-IT')}</span><span className="sync-log-fonte">[{s.fonte}]</span><span className="sync-log-ok">✅ {s.importate}</span><span className="sync-log-skip">⏭ {s.saltate}</span></div>)}
          </div>
        )}
      </div>

      {/* SMARTPMS */}
      <div className="sync-panel" style={{ marginTop: '16px' }}>
        <div className="sync-panel-header">
          <div>
            <h3>🏨 Sync da SmartPMS</h3>
            <p className="sync-desc">Legge tutte le prenotazioni da SmartPMS (CiaoBooking) in automatico.</p>
          </div>
          <button className="btn-sync" onClick={async () => {
            setSmartpmsLoading(true); setSmartpmsRisultato(null); setSmartpmsAnteprima([]);
            try {
              const res = await fetch(`${API_URL}/sync/smartpms/anteprima`, { method: 'POST' });
              const data = await res.json();
              if (data.errore) { setSmartpmsRisultato({ errori: [data.errore] }); return; }
              const mappingInit = {};
              data.prenotazioni.forEach(p => { if (!p.mappato) mappingInit[p.nome_smartpms] = ''; });
              setSmartpmsMappingTemp(mappingInit);
              const sel = {}; data.prenotazioni.forEach((p, i) => { sel[i] = !p.esistente; }); setSmartpmsSelezione(sel);
              setSmartpmsOspitiOverride({});
              setSmartpmsAnteprima(data.prenotazioni || []);
            } catch (err) { setSmartpmsRisultato({ errori: ['Errore connessione: ' + err.message] }); }
            finally { setSmartpmsLoading(false); }
          }} disabled={smartpmsLoading}>
            {smartpmsLoading ? '⏳ Caricamento...' : '🏨 Leggi prenotazioni SmartPMS'}
          </button>
        </div>

        {smartpmsLoading && <div className="sync-loading"><div className="sync-spinner" />Connessione a SmartPMS in corso...</div>}

        {smartpmsAnteprima.length > 0 && !smartpmsRisultato && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#2d5a3d' }}>📋 Anteprima — {smartpmsAnteprima.length} prenotazioni trovate</h4>

            {/* Mapping appartamenti non trovati */}
            {smartpmsAnteprima.some(p => !p.mappato) && (
              <div className="import-warning" style={{ marginBottom: '12px' }}>
                <strong>⚠️ Associa gli appartamenti SmartPMS al gestionale:</strong>
                {[...new Set(smartpmsAnteprima.filter(p => !p.mappato).map(p => p.nome_smartpms))].map(nome => (
                  <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <span style={{ minWidth: '200px', fontWeight: 'bold', fontSize: '13px' }}>"{nome}"</span>
                    <span>→</span>
                    <select className="edit-input" style={{ flex: 1 }} value={smartpmsMappingTemp[nome] || ''} onChange={e => setSmartpmsMappingTemp(prev => ({ ...prev, [nome]: e.target.value }))}>
                      <option value="">Seleziona appartamento...</option>
                      {appartamenti.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>
                      <input type="checkbox"
                        checked={smartpmsAnteprima.filter(p => !p.esistente).length > 0 && smartpmsAnteprima.filter(p => !p.esistente).every((_, idx) => { const i = smartpmsAnteprima.indexOf(smartpmsAnteprima.filter(p => !p.esistente)[idx]); return smartpmsSelezione[i] !== false; })}
                        onChange={e => { const s = {}; smartpmsAnteprima.forEach((p, i) => { s[i] = p.esistente ? false : e.target.checked; }); setSmartpmsSelezione(s); }} />
                    </th>
                    <th>Appartamento SmartPMS</th>
                    <th>Match DB</th>
                    <th>Ospite</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Ospiti</th>
                    <th>Note</th>
                    <th>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {smartpmsAnteprima.map((p, i) => (
                    <tr key={i} style={{ opacity: smartpmsSelezione[i] === false || p.esistente ? 0.45 : 1 }}>
                      <td>
                        <input type="checkbox" checked={!p.esistente && smartpmsSelezione[i] !== false} disabled={p.esistente}
                          onChange={e => setSmartpmsSelezione(prev => ({ ...prev, [i]: e.target.checked }))} />
                      </td>
                      <td><strong style={{ fontSize: '12px' }}>{p.nome_smartpms}</strong></td>
                      <td>
                        {/* Match DB modificabile */}
                        <select className="edit-input" style={{ fontSize: '11px', minWidth: '140px' }}
                          value={smartpmsMappingTemp[p.nome_smartpms] || p.appartamento_id || ''}
                          onChange={e => {
                            setSmartpmsMappingTemp(prev => ({ ...prev, [p.nome_smartpms]: e.target.value }));
                            setSmartpmsAnteprima(prev => prev.map((item, idx) =>
                              idx === i ? { ...item, appartamento_id: parseInt(e.target.value) || null, appartamento_nome: appartamenti.find(a => String(a.id) === e.target.value)?.nome || null, mappato: !!e.target.value } : item
                            ));
                          }}>
                          {!p.appartamento_id && !smartpmsMappingTemp[p.nome_smartpms] && <option value="">⚠️ non trovato</option>}
                          {appartamenti.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                        </select>
                        {(smartpmsMappingTemp[p.nome_smartpms] || p.appartamento_nome) && (
                          <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '2px' }}>
                            ✅ {appartamenti.find(a => String(a.id) === String(smartpmsMappingTemp[p.nome_smartpms] || p.appartamento_id))?.nome || p.appartamento_nome}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '12px' }}>{p.guest_name || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{p.check_in}</td>
                      <td style={{ fontSize: '12px' }}>{p.check_out}</td>
                      <td>
                        <input type="number" min="1" max="20" className="edit-input" style={{ width: '60px', textAlign: 'center' }}
                          value={smartpmsOspitiOverride[i] ?? p.num_ospiti ?? 1}
                          onChange={e => setSmartpmsOspitiOverride(prev => ({ ...prev, [i]: parseInt(e.target.value) || 1 }))} />
                      </td>
                      <td>
                        {/* Note editabile */}
                        <input type="text" className="edit-input" style={{ width: '120px', fontSize: '11px' }}
                          placeholder="Aggiungi nota..."
                          value={p.note || ''}
                          onChange={e => {
                            setSmartpmsAnteprima(prev => prev.map((item, idx) =>
                              idx === i ? { ...item, note: e.target.value } : item
                            ));
                          }} />
                      </td>
                      <td>
                        {p.esistente
                          ? <span style={{ color: '#777', fontSize: '12px' }}>già presente</span>
                          : <span style={{ color: '#16a34a', fontSize: '12px' }}>da importare</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn-import" disabled={smartpmsLoading} onClick={async () => {
                setSmartpmsLoading(true);
                // Salva mapping
                for (const [nome, appId] of Object.entries(smartpmsMappingTemp)) {
                  if (appId) await fetch(`${API_URL}/smartpms/mapping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome_smartpms: nome, appartamento_id: parseInt(appId) }) }).catch(() => {});
                }
                const daImportare = smartpmsAnteprima
                  .filter((p, i) => smartpmsSelezione[i] !== false && !p.esistente)
                  .map((p, _) => {
                    const i = smartpmsAnteprima.indexOf(p);
                    return {
                      ...p,
                      num_ospiti: smartpmsOspitiOverride[i] ?? p.num_ospiti ?? 1,
                      appartamento_id: smartpmsMappingTemp[p.nome_smartpms] ? parseInt(smartpmsMappingTemp[p.nome_smartpms]) : p.appartamento_id
                    };
                  });
                try {
                  const res = await fetch(`${API_URL}/sync/smartpms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prenotazioni: daImportare }) });
                  const data = await res.json(); setSmartpmsRisultato(data); setSmartpmsAnteprima([]);
                  if (data.importate > 0) setTimeout(() => onImport(), 1500);
                } catch { setSmartpmsRisultato({ errori: ['Errore connessione'] }); }
                finally { setSmartpmsLoading(false); }
              }}>
                {smartpmsLoading ? '⏳ Importazione...' : `✅ Importa SmartPMS (${smartpmsAnteprima.filter((p, i) => smartpmsSelezione[i] !== false && !p.esistente).length})`}
              </button>
              <button className="btn-icon btn-cancel-icon" onClick={() => setSmartpmsAnteprima([])} style={{ padding: '10px 16px' }}>✕ Annulla</button>
            </div>
          </div>
        )}

        {smartpmsRisultato && !smartpmsAnteprima.length && (
          <div className={`import-result ${smartpmsRisultato.errori?.length && !smartpmsRisultato.importate ? 'result-warn' : 'result-ok'}`} style={{ marginTop: '12px' }}>
            <div className="result-row">✅ Importate: <strong>{smartpmsRisultato.importate || 0}</strong></div>
            <div className="result-row">⏭ Saltate: <strong>{smartpmsRisultato.saltate || 0}</strong></div>
            {smartpmsRisultato.errori?.length > 0 && <div className="result-errors"><strong>Dettagli:</strong><ul>{smartpmsRisultato.errori.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          </div>
        )}
      </div>

      {/* SYNC GOOGLE SHEET */}
      <div className="sync-panel" style={{ marginTop: '16px' }}>
        <div className="sync-panel-header">
          <div><h3>📊 Sync da Google Sheet</h3><p className="sync-desc">Legge il calendario pulizie dal foglio condiviso.</p></div>
          <button className="btn-sync" onClick={async () => {
            setSheetLoading(true); setSheetAnteprima(null); setSheetRisultato(null);
            try {
              const tabRes = await fetch(`${API_URL}/sync/sheets/tabs`); const tabData = await tabRes.json();
              if (tabData.errore) { setSheetRisultato({ errore: tabData.errore }); return; }
              setSheetTabs(tabData.tabs || []);
              const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
              const tabCorrente = mesi[new Date().getMonth()];
              const tabDaLeggere = tabData.tabs.includes(tabCorrente) ? tabCorrente : tabData.tabs[tabData.tabs.length - 1];
              setSheetTabSelezionato(tabDaLeggere);
              const res = await fetch(`${API_URL}/sync/sheets/anteprima`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tab: tabDaLeggere }) });
              const data = await res.json();
              if (data.errore) { setSheetRisultato({ errore: data.errore }); return; }
              setSheetAnteprima(data);
              const sel = {}; data.prenotazioni.forEach((p, i) => { sel[i] = !p.gia_processato && !p.esistente; }); setSheetSelezione(sel);
            } catch { setSheetRisultato({ errore: 'Errore connessione' }); } finally { setSheetLoading(false); }
          }} disabled={sheetLoading}>
            {sheetLoading ? '⏳ Lettura...' : '📊 Leggi Google Sheet'}
          </button>
        </div>
        {sheetLoading && <div className="sync-loading"><div className="sync-spinner" />Lettura foglio in corso...</div>}
        {sheetAnteprima && !sheetLoading && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Tab mese:</label>
              <select className="edit-input" style={{ width: '160px' }} value={sheetTabSelezionato}
                onChange={async e => {
                  const tab = e.target.value; setSheetTabSelezionato(tab); setSheetLoading(true);
                  try { const res = await fetch(`${API_URL}/sync/sheets/anteprima`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tab }) }); const data = await res.json(); setSheetAnteprima(data); const sel = {}; data.prenotazioni.forEach((p, i) => { sel[i] = !p.gia_processato && !p.esistente; }); setSheetSelezione(sel); } catch {} finally { setSheetLoading(false); }
                }}>
                {sheetTabs.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{ fontSize: '13px', color: '#666' }}>{sheetAnteprima.totale} prenotazioni trovate</span>
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th style={{width:'36px'}}><input type="checkbox" checked={Object.values(sheetSelezione).every(Boolean)} onChange={e => { const s = {}; sheetAnteprima.prenotazioni.forEach((_, i) => { s[i] = e.target.checked; }); setSheetSelezione(s); }} /></th><th>Appartamento</th><th>Match DB</th><th>Ospite</th><th>Check-in</th><th>Check-out</th><th>Ospiti</th><th>Note</th><th>Stato</th></tr></thead>
                <tbody>
                  {sheetAnteprima.prenotazioni.map((p, i) => (
                    <tr key={i} style={{ opacity: sheetSelezione[i] ? 1 : 0.45 }}>
                      <td><input type="checkbox" checked={!!sheetSelezione[i]} onChange={e => setSheetSelezione(prev => ({ ...prev, [i]: e.target.checked }))} /></td>
                      <td><strong style={{ fontSize: '12px' }}>{p.appartamento}</strong></td>
                      <td><select className="edit-input" style={{ fontSize: '11px', minWidth: '140px' }} value={sheetMatchOverride[i] || p.appartamento_id || ''} onChange={e => setSheetMatchOverride(prev => ({ ...prev, [i]: e.target.value }))}>{!p.appartamento_id && !sheetMatchOverride[i] && <option value="">⚠️ non trovato</option>}{appartamenti.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></td>
                      <td style={{ fontSize: '12px' }}>{p.nome_ospite || '—'}</td><td style={{ fontSize: '12px' }}>{p.check_in}</td><td style={{ fontSize: '12px' }}>{p.check_out}</td><td>{p.num_ospiti}</td><td style={{ fontSize: '11px', color: '#555' }}>{p.note || '—'}</td>
                      <td style={{ fontSize: '11px' }}>{p.esistente ? <span style={{ color: '#888' }}>già nel DB</span> : p.gia_processato ? <span style={{ color: '#f59e0b' }}>già processato</span> : <span style={{ color: '#16a34a' }}>da importare</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'center' }}>
              <button className="btn-import" disabled={sheetLoading || Object.values(sheetSelezione).every(v => !v)} onClick={async () => {
                setSheetLoading(true);
                const sel = sheetAnteprima.prenotazioni.filter((_, i) => sheetSelezione[i]).map(p => { const i = sheetAnteprima.prenotazioni.indexOf(p); return { ...p, appartamento_id: sheetMatchOverride[i] || p.appartamento_id }; });
                try { const res = await fetch(`${API_URL}/sync/sheets/importa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prenotazioni: sel, marcaProcessato: true }) }); const data = await res.json(); setSheetRisultato(data); setSheetAnteprima(null); if (data.importate > 0) setTimeout(() => onImport(), 1500); } catch { setSheetRisultato({ errore: 'Errore connessione' }); } finally { setSheetLoading(false); }
              }}>
                {sheetLoading ? '⏳...' : `✅ Importa (${Object.values(sheetSelezione).filter(Boolean).length})`}
              </button>
              <button className="btn-icon btn-cancel-icon" style={{ padding: '10px 16px' }} onClick={() => setSheetAnteprima(null)}>✕ Annulla</button>
            </div>
          </div>
        )}
        {sheetRisultato && !sheetAnteprima && (
          <div className={`import-result ${sheetRisultato.errore ? 'result-warn' : 'result-ok'}`} style={{ marginTop: '12px' }}>
            {sheetRisultato.errore ? <div className="result-row">❌ {sheetRisultato.errore}</div> : <><div className="result-row">✅ Importate: <strong>{sheetRisultato.importate}</strong></div><div className="result-row">⏭ Saltate: <strong>{sheetRisultato.saltate}</strong></div>{sheetRisultato.errori?.length > 0 && <div className="result-errors"><ul>{sheetRisultato.errori.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}</>}
          </div>
        )}
      </div>

      {/* SYNC EMAIL */}
      <div className="sync-panel" style={{ marginTop: '16px' }}>
        <div className="sync-panel-header">
          <div><h3>📧 Sync da Email</h3><p className="sync-desc">Legge le email con label pl2-importa/pl2-cancella/pl2-aggiungi.{' '}<a href="https://gestione-prenotazioni-production.up.railway.app/auth/google" target="_blank" rel="noreferrer" style={{color:'#2d5a3d'}}>Autorizza Gmail →</a></p></div>
          <button className="btn-sync" onClick={leggiEmailAnteprima} disabled={syncingEmail || importandoEmail}>{syncingEmail ? '⏳ Lettura...' : '📧 Leggi email ora'}</button>
        </div>
        {syncingEmail && <div className="sync-loading"><div className="sync-spinner" />Lettura e analisi email in corso...</div>}
        {anteprimaEmail && !syncingEmail && (
          <div className="email-preview-panel">
            <div className="email-preview-header">
              <h4>📋 Anteprima — {anteprimaEmail.prenotazioni.length} prenotazioni in {anteprimaEmail.emailAnalizzate} email</h4>
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th style={{width:'40px'}}><input type="checkbox" checked={Object.values(selezionate).every(v => v)} onChange={e => { const sel = {}; anteprimaEmail.prenotazioni.forEach((_, i) => { sel[i] = e.target.checked }); setSelezionate(sel) }} /></th><th>Appartamento</th><th>Match DB</th><th>Check-in</th><th>Check-out</th><th>Ospiti</th><th>Note</th><th>Azione</th></tr></thead>
                <tbody>
                  {anteprimaEmail.prenotazioni.map((p, i) => {
                    const match = matchApp(p.appartamento), matchOverride = emailMatchOverride[i]
                    return (
                      <tr key={i} style={{ opacity: selezionate[i] ? 1 : 0.4 }}>
                        <td><input type="checkbox" checked={!!selezionate[i]} onChange={e => setSelezionate(prev => ({ ...prev, [i]: e.target.checked }))} /></td>
                        <td><strong>{p.appartamento}</strong></td>
                        <td><select className="edit-input" style={{ minWidth: '180px', fontSize: '12px' }} value={matchOverride || match?.id || ''} onChange={e => setEmailMatchOverride(prev => ({ ...prev, [i]: e.target.value }))}>{!match && !matchOverride && <option value="">⚠️ non trovato</option>}{appartamenti.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></td>
                        <td>{fmtData(p.check_in)}</td><td>{fmtData(p.check_out)}</td><td>{p.ospiti || '—'}</td>
                        <td style={{ fontSize: '12px', color: '#555', maxWidth: '150px' }}>{p.note || '—'}</td>
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
              <button className="btn-import" onClick={confermaImportEmail} disabled={importandoEmail || Object.values(selezionate).every(v => !v)}>{importandoEmail ? '⏳ Importazione...' : `✅ Conferma (${Object.values(selezionate).filter(Boolean).length})`}</button>
            </div>
          </div>
        )}
        {syncEmailStatus && !syncingEmail && !anteprimaEmail && (
          <div className={`import-result ${syncEmailStatus.errore ? 'result-warn' : 'result-ok'}`} style={{marginTop:'12px'}}>
            {syncEmailStatus.errore ? <div className="result-row">❌ {syncEmailStatus.errore}</div>
              : syncEmailStatus.messaggio ? <div className="result-row">ℹ️ {syncEmailStatus.messaggio}</div>
              : <><div className="result-row">✅ Importate: <strong>{syncEmailStatus.importate}</strong></div><div className="result-row">🗑 Cancellate: <strong>{syncEmailStatus.cancellate}</strong></div></>}
          </div>
        )}
      </div>

      {/* SMOOBU */}
      <div className="sync-panel" style={{ marginTop: '16px' }}>
        <div className="sync-panel-header">
          <div><h3>🏠 Sync da Smoobu</h3><p className="sync-desc">Sincronizza automaticamente alle 02:00 e 07:00 UTC.</p></div>
          <button className="btn-sync" onClick={async () => {
            setSmoobuLoading(true); setSmoobuRisultato(null); setSmoobuAnteprima([]);
            try {
              const res = await fetch(`${API_URL}/sync/smoobu/anteprima`, { method: 'POST' }); const data = await res.json();
              if (data.errore) { setSmoobuRisultato({ errori: [data.errore] }); return; }
              const mappingInit = {}; data.prenotazioni.forEach(p => { if (!p.mappato) mappingInit[p.nome_smoobu] = ''; }); setSmoobuMappingTemp(mappingInit);
              const sel = {}; data.prenotazioni.forEach((p, i) => { sel[i] = !p.esistente }); setSmoobuSelezione(sel); setSmoobuOspitiOverride({}); setSmoobuAnteprima(data.prenotazioni || []);
            } catch (err) { setSmoobuRisultato({ errori: ['Errore connessione'] }); } finally { setSmoobuLoading(false); }
          }} disabled={smoobuLoading}>
            {smoobuLoading ? '⏳ Caricamento...' : '🏠 Leggi prenotazioni Smoobu'}
          </button>
        </div>
        {smoobuLoading && <div className="sync-loading"><div className="sync-spinner" />Connessione a Smoobu in corso...</div>}
        {smoobuAnteprima.length > 0 && !smoobuRisultato && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#2d5a3d' }}>📋 Anteprima — {smoobuAnteprima.length} prenotazioni trovate</h4>
            {smoobuAnteprima.some(p => !p.mappato) && (
              <div className="import-warning" style={{ marginBottom: '12px' }}>
                <strong>⚠️ Associa gli appartamenti Smoobu al gestionale:</strong>
                {[...new Set(smoobuAnteprima.filter(p => !p.mappato).map(p => p.nome_smoobu))].map(nome => (
                  <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <span style={{ minWidth: '200px', fontWeight: 'bold', fontSize: '13px' }}>"{nome}"</span><span>→</span>
                    <select className="edit-input" style={{ flex: 1 }} value={smoobuMappingTemp[nome] || ''} onChange={e => setSmoobuMappingTemp(prev => ({ ...prev, [nome]: e.target.value }))}><option value="">Seleziona appartamento...</option>{appartamenti.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
                  </div>
                ))}
              </div>
            )}
            <div className="table-container">
              <table>
                <thead><tr><th style={{width:'36px'}}><input type="checkbox" onChange={e => { const s = {}; smoobuAnteprima.forEach((p, i) => { s[i] = p.esistente ? false : e.target.checked; }); setSmoobuSelezione(s); }} /></th><th>Appartamento Smoobu</th><th>Match DB</th><th>Check-in</th><th>Check-out</th><th>Ospiti</th><th>Portale</th><th>Stato</th></tr></thead>
                <tbody>
                  {smoobuAnteprima.map((p, i) => (
                    <tr key={i} style={{ opacity: smoobuSelezione[i] === false || p.esistente ? 0.45 : 1 }}>
                      <td><input type="checkbox" checked={!p.esistente && smoobuSelezione[i] !== false} disabled={p.esistente} onChange={e => setSmoobuSelezione(prev => ({ ...prev, [i]: e.target.checked }))} /></td>
                      <td><strong>{p.nome_smoobu}</strong></td>
                      <td>{p.appartamento_nome ? <span className="match-ok">✅ {p.appartamento_nome}</span> : smoobuMappingTemp[p.nome_smoobu] ? <span className="match-ok">🔗 {appartamenti.find(a => String(a.id) === String(smoobuMappingTemp[p.nome_smoobu]))?.nome}</span> : <span className="match-ko">⚠️ non mappato</span>}</td>
                      <td>{p.check_in}</td><td>{p.check_out}</td>
                      <td><input type="number" min="1" max="20" className="edit-input" style={{ width: '60px', textAlign: 'center' }} value={smoobuOspitiOverride[i] ?? p.num_ospiti ?? 1} onChange={e => setSmoobuOspitiOverride(prev => ({ ...prev, [i]: parseInt(e.target.value) || 1 }))} /></td>
                      <td style={{ fontSize: '12px', color: '#777' }}>{p.portale || '—'}</td>
                      <td>{p.esistente ? <span style={{ color: '#777', fontSize: '12px' }}>già presente</span> : <span style={{ color: '#16a34a', fontSize: '12px' }}>da importare</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn-import" disabled={smoobuLoading} onClick={async () => {
                setSmoobuLoading(true);
                for (const [nomeSmoobu, appId] of Object.entries(smoobuMappingTemp)) { if (appId) await fetch(`${API_URL}/smoobu/mapping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome_smoobu: nomeSmoobu, appartamento_id: parseInt(appId) }) }).catch(() => {}); }
                const daImportare = smoobuAnteprima.filter((_, i) => smoobuSelezione[i] !== false && !smoobuAnteprima[i].esistente).map((p, _) => { const i = smoobuAnteprima.indexOf(p); return { ...p, num_ospiti: smoobuOspitiOverride[i] ?? p.num_ospiti ?? 1, appartamento_id: smoobuMappingTemp[p.nome_smoobu] || p.appartamento_id }; });
                try { const res = await fetch(`${API_URL}/sync/smoobu`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prenotazioni: daImportare }) }); const data = await res.json(); setSmoobuRisultato(data); setSmoobuAnteprima([]); if (data.importate > 0) setTimeout(() => onImport(), 1500); }
                catch { setSmoobuRisultato({ errori: ['Errore connessione'] }); } finally { setSmoobuLoading(false); }
              }}>
                {smoobuLoading ? '⏳ Importazione...' : `✅ Importa Smoobu`}
              </button>
              <button className="btn-icon btn-cancel-icon" onClick={() => setSmoobuAnteprima([])} style={{ padding: '10px 16px' }}>✕ Annulla</button>
            </div>
          </div>
        )}
        {smoobuRisultato && !smoobuAnteprima.length && (
          <div className={`import-result ${smoobuRisultato.errori?.length && !smoobuRisultato.importate ? 'result-warn' : 'result-ok'}`} style={{ marginTop: '12px' }}>
            <div className="result-row">✅ Importate: <strong>{smoobuRisultato.importate || 0}</strong></div>
            <div className="result-row">⏭ Saltate: <strong>{smoobuRisultato.saltate || 0}</strong></div>
            {smoobuRisultato.errori?.length > 0 && <div className="result-errors"><ul>{smoobuRisultato.errori.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          </div>
        )}
        <div style={{ borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />
        <p className="sync-desc" style={{ marginBottom: '8px' }}>Oppure importa manualmente un CSV da Smoobu → Prenotazioni → Esporta.</p>
        <div className={`drop-zone ${smoobuFile ? 'has-file' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setSmoobuFile(f); leggiSmoobuCSV(f) } }} onClick={() => document.getElementById('smoobu-csv-input').click()}>
          <input id="smoobu-csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleSmoobuFile} />
          {smoobuFile ? <div className="drop-zone-ok"><span className="drop-icon">✅</span><span>{smoobuFile.name}</span><span className="drop-sub">{smoobuAnteprima.length} prenotazioni trovate</span></div> : <div className="drop-zone-empty"><span className="drop-icon">📂</span><span>Trascina il file .csv Smoobu qui oppure clicca</span></div>}
        </div>
        {smoobuErrore && <div className="error-message">{smoobuErrore}</div>}
      </div>

      <div className="import-divider">oppure importa manualmente da Excel ItalianWay</div>

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
              <tbody>{anteprima.map((r, i) => { const match = matchApp(r.appartamento); return (<tr key={i}><td><strong>{r.appartamento}</strong></td><td>{match ? <span className="match-ok">✅ {match.nome}</span> : <span className="match-ko">⚠️ non trovato</span>}</td><td>{r.check_out}</td><td>{r.check_in || '—'}</td><td>{r.ospiti_entranti || '—'}</td><td style={{ fontSize: '12px', color: '#777' }}>{[r.categoria !== '-' ? r.categoria : '', r.note !== '-' ? r.note : ''].filter(Boolean).join(' | ') || '—'}</td></tr>) })}</tbody>
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
