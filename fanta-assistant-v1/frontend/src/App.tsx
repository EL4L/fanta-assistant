import { useState, useEffect } from 'react';

// Definiamo la struttura del nostro Giocatore (TypeScript)
interface Player {
  id: number;
  name: string;
  team: string;
  role: string;
  quotation: number;
  fvm: number;
  tier: string;
  favorite: number;
  target: number;
  my_max: number;
  status: string;
}

const ROLE_COLORS: Record<string, string> = {
  P: 'bg-yellow-500 text-white',
  D: 'bg-green-600 text-white',
  C: 'bg-blue-600 text-white',
  A: 'bg-red-600 text-white',
};

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [onlyTargets, setOnlyTargets] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/players');
      const data = await response.json();
      setPlayers(data);
    } catch (error) {
      console.error("Errore API:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePlayer = async (id: number, field: keyof Player, value: any) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    try {
      await fetch(`http://localhost:8000/api/players/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
    } catch (error) {
      console.error(`Errore aggiornamento ${field}:`, error);
      fetchPlayers(); 
    }
  };

  const filteredPlayers = players.filter(p => {
    const matchRole = roleFilter === 'All' || p.role === roleFilter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                        p.team.toLowerCase().includes(search.toLowerCase());
    const matchTarget = !onlyTargets || p.target === 1;
    return matchRole && matchSearch && matchTarget && p.status === 'Libero';
  });

  if (loading) return <div className="p-8 text-center text-xl text-gray-400">Caricamento database...</div>;

  return (
    <div className="bg-gray-900 min-h-screen text-gray-100 p-6 font-sans">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Fanta Assistant 26/27</h1>
          <div className="flex gap-4">
            <input 
              type="text" 
              placeholder="🔍 Cerca giocatore..." 
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select 
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All">Tutti i Ruoli</option>
              <option value="P">Portieri</option>
              <option value="D">Difensori</option>
              <option value="C">Centrocampisti</option>
              <option value="A">Attaccanti</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer bg-gray-800 px-4 py-2 rounded border border-gray-700">
          <input 
            type="checkbox" 
            checked={onlyTargets}
            onChange={(e) => setOnlyTargets(e.target.checked)}
            className="w-5 h-5"
          />
          <span>Solo 🎯 Obiettivi</span>
        </label>
      </div>

      <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-xl border border-gray-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-center">⭐</th>
              <th className="px-4 py-3 text-center">🎯</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3 text-center">R</th>
              <th className="px-4 py-3">Squadra</th>
              <th className="px-4 py-3">Fascia</th>
              <th className="px-4 py-3 text-right">FVM</th>
              <th className="px-4 py-3 text-right text-yellow-400">Mio MAX</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.slice(0, 100).map((p) => (
              <tr key={p.id} className="border-b border-gray-700 hover:bg-gray-700">
                <td className="px-4 py-3 text-center">
                  <button onClick={() => updatePlayer(p.id, 'favorite', p.favorite ? 0 : 1)}>
                    {p.favorite ? '⭐' : '☆'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => updatePlayer(p.id, 'target', p.target ? 0 : 1)}>
                    {p.target ? '🎯' : '◎'}
                  </button>
                </td>
                <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${ROLE_COLORS[p.role]}`}>{p.role}</span>
                </td>
                <td className="px-4 py-3 text-gray-300">{p.team}</td>
                <td className="px-4 py-3">
                  <select 
                    value={p.tier}
                    onChange={(e) => updatePlayer(p.id, 'tier', e.target.value)}
                    className="bg-transparent text-gray-200 outline-none cursor-pointer"
                  >
                    <option className="bg-gray-800" value="1. Top">1. Top</option>
                    <option className="bg-gray-800" value="2. Semi-Top">2. Semi-Top</option>
                    <option className="bg-gray-800" value="3. Terza">3. Terza</option>
                    <option className="bg-gray-800" value="4. Quarta">4. Quarta</option>
                    <option className="bg-gray-800" value="5. Scommesse">5. Scommesse</option>
                    <option className="bg-gray-800" value="6. Riserve">6. Riserve</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right font-mono">{p.fvm}</td>
                <td className="px-4 py-3 text-right">
                  <input 
                    type="number" 
                    value={p.my_max || ''}
                    onChange={(e) => updatePlayer(p.id, 'my_max', parseInt(e.target.value) || 0)}
                    className="bg-gray-900 border border-gray-600 text-yellow-400 font-bold text-right rounded w-16 px-1 outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}