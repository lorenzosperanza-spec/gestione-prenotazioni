// App.jsx - Componente principale dashboard
import React, { useState, useEffect } from 'react';

const API_BASE = '[localhost](http://localhost:3001/api)';

// Utility per chiamate API
const api = {
    get: async (endpoint) => {
        const res = await fetch(`${API_BASE}${endpoint}`);
        return res.json();
    },
    post: async (endpoint, data) => {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    put: async (endpoint, data) => {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    }
};

// ============================================
// COMPONENTE STATISTICHE
// ============================================
const StatCard = ({ label, value, color = 'blue', icon }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6`}>
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-gray-500 mb-1">{label}</p>
                <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
            </div>
            <div className={`w-12 h-12 bg-${color}-100 rounded-full flex items-center justify-center`}>
                <span className="text-2xl">{icon}</span>
            </div>
        </div>
    </div>
);

// ============================================
// COMPONENTE CARD PULIZIA
// ============================================
const PuliziaCard = ({ pulizia, dipendenti, motorini, onAssegna, onPosticipa, onCambiaStato }) => {
    const [assegnando, setAssegnando] = useState(false);
    const [dipendenteSelezionato, setDipendenteSelezionato] = useState('');
    const [motorinoSelezionato, setMotorinoSelezionato] = useState('');
    
    const getPrioritaColor = (priorita, haCheckin) => {
        if (haCheckin) return 'bg-red-100 border-red-300 text-red-800';
        if (priorita <= 3) return 'bg-orange-100 border-orange-300 text-orange-800';
        return 'bg-gray-100 border-gray-300 text-gray-800';
    };
    
    const getStatoBadge = (stato) => {
        const stati = {
            'da_assegnare': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Da assegnare' },
            'assegnata': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Assegnata' },
            'in_corso': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'In corso' },
            'completata': { bg: 'bg-green-100', text: 'text-green-800', label: 'Completata' }
        };
        const s = stati[stato] || stati['da_assegnare'];
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
    };
    
    const handleAssegna = () => {
        if (dipendenteSelezionato) {
            onAssegna(pulizia.id, {
                dipendente_id: parseInt(dipendenteSelezionato),
                motorino_id: motorinoSelezionato ? parseInt(motorinoSelezionato) : null
            });
            setAssegnando(false);
        }
    };
    
    return (
        <div className={`rounded-xl border-2 p-4 mb-3 ${getPrioritaColor(pulizia.priorita, pulizia.ha_checkin_stesso_giorno)}`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="font-bold text-lg">{pulizia.appartamento_nome}</h3>
                    <p className="text-sm opacity-75">{pulizia.appartamento_indirizzo}</p>
                </div>
                <div className="flex items-center gap-2">
                    {pulizia.ha_checkin_stesso_giorno && (
                        <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-pulse">
                            ⚡ CHECK-IN OGGI
                        </span>
                    )}
                    {getStatoBadge(pulizia.stato)}
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div>
                    <span className="opacity-60">Check-out:</span>
                    <span className="ml-1 font-medium">{pulizia.ora_checkout}</span>
                </div>
                <div>
                    <span className="opacity-60">Ospiti:</span>
                    <span className="ml-1 font-medium">{pulizia.numero_ospiti}</span>
                </div>
                <div>
                    <span className="opacity-60">Zona:</span>
                    <span className="ml-1 font-medium">{pulizia.zona}</span>
                </div>
            </div>
            
            {pulizia.richiede_motorino && (
                <div className="bg-yellow-200 text-yellow-900 px-2 py-1 rounded text-xs mb-3 inline-block">
                    🛵 Richiede motorino
                </div>
            )}
            
            {pulizia.stato === 'da_assegnare' && !assegnando && (
                <div className="flex gap-2 mt-3">
                    <button
                        onClick={() => setAssegnando(true)}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                        Assegna
                    </button>
                    <button
                        onClick={() => onPosticipa(pulizia.id)}
                        className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
                    >
                        Posticipa
                    </button>
                </div>
            )}
            
            {assegnando && (
                <div className="mt-3 p-3 bg-white bg-opacity-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <select
                            value={dipendenteSelezionato}
                            onChange={(e) => setDipendenteSelezionato(e.target.value)}
                            className="w-full p-2 rounded border border-gray-300"
                        >
                            <option value="">Seleziona dipendente</option>
                            {dipendenti.map(d => (
                                <option key={d.id} value={d.id}>
                                    {d.nome} {d.cognome} ({d.mezzo_trasporto})
                                </option>
                            ))}
                        </select>
                        
                        {pulizia.richiede_motorino && (
                            <select
                                value={motorinoSelezionato}
                                onChange={(e) => setMotorinoSelezionato(e.target.value)}
                                className="w-full p-2 rounded border border-gray-300"
                            >
                                <option value="">Seleziona motorino</option>
                                {motorini.map(m => (
                                    <option key={m.id} value={m.id}>{m.nome}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAssegna}
                            disabled={!dipendenteSelezionato}
                            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                            Conferma
                        </button>
                        <button
                            onClick={() => setAssegnando(false)}
                            className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
                        >
                            Annulla
                        </button>
                    </div>
                </div>
            )}
            
            {pulizia.stato === 'assegnata' && (
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm">
                        👤 <strong>{pulizia.dipendente_nome}</strong>
                        {pulizia.motorino_nome && <span className="ml-2">🛵 {pulizia.motorino_nome}</span>}
                    </span>
                </div>
            )}
        </div>
    );
};

// ============================================
// COMPONENTE PRINCIPALE DASHBOARD
// ============================================
const Dashboard = () => {
    const [dataSelezionata, setDataSelezionata] = useState(new Date().toISOString().split('T')[0]);
    const [pulizie, setPulizie] = useState([]);
    const [dipendenti, setDipendenti] = useState([]);
    const [motorini, setMotorini] = useState([]);
    const [statistiche, setStatistiche] = useState({});
    const [loading, setLoading] = useState(true);
    const [vista, setVista] = useState('giorno'); // 'giorno', 'settimana', 'da_assegnare'
    
    useEffect(() => {
        caricaDati();
    }, [dataSelezionata, vista]);
    
    const caricaDati = async () => {
        setLoading(true);
        try {
            const [pulizieData, dipendentiData, motoriniData, statsData] = await Promise.all([
                vista === 'da_assegnare' 
                    ? api.get('/pulizie/da-assegnare')
                    : api.get(`/pulizie/giorno/${dataSelezionata}`),
                api.get('/dipendenti'),
                api.get('/motorini'),
                api.get('/statistiche/overview')
            ]);
            
            setPulizie(pulizieData);
            setDipendenti(dipendentiData);
            setMotorini(motoriniData);
            setStatistiche(statsData);
        } catch (err) {
            console.error('Errore caricamento dati:', err);
        }
        setLoading(false);
    };
    
    const handleAssegna = async (puliziaId, dati) => {
        await api.put(`/pulizie/${puliziaId}/assegna`, dati);
        caricaDati();
    };
    
    const handlePosticipa = async (puliziaId) => {
        const domani = new Date(dataSelezionata);
        domani.setDate(domani.getDate() + 1);
        await api.put(`/pulizie/${puliziaId}/posticipa`, {
            nuova_data: domani.toISOString().split('T')[0],
            motivo: 'Nessun check-in'
        });
        caricaDati();
    };
    
    const cambiaGiorno = (delta) => {
        const nuovaData = new Date(dataSelezionata);
        nuovaData.setDate(nuovaData.getDate() + delta);
        setDataSelezionata(nuovaData.toISOString().split('T')[0]);
    };
    
    const formatData = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    };
    
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-gray-800">🧹 Gestionale Pulizie</h1>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setVista('giorno')}
                                className={`px-4 py-2 rounded-lg transition ${vista === 'giorno' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                            >
                                Vista Giorno
                            </button>
                            <button 
                                onClick={() => setVista('da_assegnare')}
                                className={`px-4 py-2 rounded-lg transition ${vista === 'da_assegnare' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                            >
                                Da Assegnare ({statistiche.da_assegnare || 0})
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            
            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Statistiche */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Pulizie Oggi" value={statistiche.pulizie_oggi || 0} color="blue" icon="🏠" />
                    <StatCard label="Da Assegnare" value={statistiche.da_assegnare || 0} color="yellow" icon="⏳" />
                    <StatCard label="Completate Oggi" value={statistiche.completate_oggi || 0} color="green" icon="✅" />
                    <StatCard label="Appartamenti Attivi" value={statistiche.appartamenti_attivi || 0} color="purple" icon="🏢" />
                </div>
                
                {/* Selettore data */}
                {vista === 'giorno' && (
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <button 
                            onClick={() => cambiaGiorno(-1)}
                            className="p-2 rounded-lg bg-white shadow hover:bg-gray-50 transition"
                        >
                            ◀️
                        </button>
                        <div className="bg-white px-6 py-3 rounded-xl shadow">
                            <span className="text-lg font-medium capitalize">{formatData(dataSelezionata)}</span>
                        </div>
                        <button 
                            onClick={() => cambiaGiorno(1)}
                            className="p-2 rounded-lg bg-white shadow hover:bg-gray-50 transition"
                        >
                            ▶️
                        </button>
                        <input
                            type="date"
                            value={dataSelezionata}
                            onChange={(e) => setDataSelezionata(e.target.value)}
                            className="ml-4 p-2 rounded-lg border"
                        />
                    </div>
                )}
                
                {/* Lista pulizie */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin text-4xl">🔄</div>
                        <p className="mt-2 text-gray-500">Caricamento...</p>
                    </div>
                ) : pulizie.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                        <span className="text-6xl">🎉</span>
                        <p className="mt-4 text-xl text-gray-600">
                            {vista === 'da_assegnare' 
                                ? 'Tutte le pulizie sono state assegnate!'
                                : 'Nessuna pulizia programmata per questo giorno'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {pulizie.map(pulizia => (
                            <PuliziaCard
                                key={pulizia.id}
                                pulizia={pulizia}
                                dipendenti={dipendenti}
                                motorini={motorini}
                                onAssegna={handleAssegna}
                                onPosticipa={handlePosticipa}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
