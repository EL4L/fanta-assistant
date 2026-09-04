import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Search,
  Star,
  Target,
  BarChart3,
  Hammer,
  Users,
  Wallet,
  Sun,
  Moon,
  RefreshCw,
  ChevronDown,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import "./styles.css";


const API = "http://localhost:8000/api";

type Player = {
  id: number;
  name: string;
  team: string;
  role: string;
  quotation: number;
  fvm: number;
  tier: string;
  fantasy_score: number;
  auction_price: number | null;
  favorite: number;
  target: number;
  my_max: number;
  status: string;
  purchase_price: number;
};

type Page = "Dashboard" | "Listone" | "Obiettivi" | "Asta Live";
type ConnectionStatus = "connecting" | "online" | "offline";
type RoleCounts = Record<string, number>;

const ROLES = [
  { value: "Tutti", label: "Tutti i ruoli" },
  { value: "P", label: "Portieri" },
  { value: "D", label: "Difensori" },
  { value: "C", label: "Centrocampisti" },
  { value: "A", label: "Attaccanti" },
];

const TIERS = [
  "Tutte",
  "1. Top",
  "2. Semi-Top",
  "3. Terza",
  "4. Quarta",
  "5. Scommessa",
  "6. Riserve",
];

// Budget totale asta (crediti). Se la tua lega ne usa uno diverso, cambia solo qui.
const TOTAL_BUDGET = 500;

// Slot di rosa per ruolo. Default classico 3-8-8-6 (25 giocatori totali).
// Adatta ai regolamenti della tua lega, se diversi.
const ROLE_SLOTS: RoleCounts = {
  P: 3,
  D: 8,
  C: 8,
  A: 6,
};

const ROLE_LABELS: Record<string, string> = {
  P: "Portieri",
  D: "Difensori",
  C: "Centrocampisti",
  A: "Attaccanti",
};

function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [page, setPage] = useState<Page>("Listone");

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] =
    useState<ConnectionStatus>("connecting");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("Tutti");
  const [tierFilter, setTierFilter] = useState("Tutte");
  const [onlyTargets, setOnlyTargets] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [bidPrice, setBidPrice] = useState(1);
  const [auctionSearch, setAuctionSearch] = useState("");

  const [editingMaxId, setEditingMaxId] = useState<number | null>(null);
  const [editingMaxValue, setEditingMaxValue] = useState("");

  const [updatingIds, setUpdatingIds] = useState<number[]>([]);

async function loadPlayers() {
    try {
      setConnection("connecting");

      const response = await fetch(`${API}/players`);

      if (!response.ok) {
        throw new Error("API error");
      }

      const data = await response.json();

      // --- NOVITÀ: ADATTAMENTO FVM AL BUDGET ---
      // Divide l'FVM per 2 (da 1000 a 500 crediti). 
      // Usiamo Math.round per evitare decimali e Math.max per garantire che valga almeno 1.
      const adjustedData = data.map((player: Player) => ({
        ...player,
        fvm: Math.max(1, Math.round(player.fvm / 2))
      }));

      setPlayers(adjustedData);
      setConnection("online");
    } catch (error) {
      console.error("Errore caricamento giocatori:", error);
      setConnection("offline");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  async function updatePlayer(id: number, changes: Partial<Player>) {
    const previousPlayers = players;

    // Aggiornamento immediato UI (Optimistic UI)
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, ...changes } : player
      )
    );
    setUpdatingIds((current) => [...current, id]);

    try {
      const response = await fetch(`${API}/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      if (!response.ok) throw new Error("Aggiornamento fallito");
      
      // Se è un acquisto, mostra il toast di successo!
      if (changes.status === "Mio Team") {
        toast.success("Giocatore acquistato!");
      }
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast.error("Errore di rete. Modifica annullata.");
      setPlayers(previousPlayers); // Rollback in caso di errore
    } finally {
      setUpdatingIds((current) => current.filter((item) => item !== id));
    }
  }

  function toggleFavorite(player: Player) {
    updatePlayer(player.id, {
      favorite: player.favorite ? 0 : 1,
    });
  }

  function toggleTarget(player: Player) {
    updatePlayer(player.id, {
      target: player.target ? 0 : 1,
    });
  }

  function startEditingMax(player: Player) {
    setEditingMaxId(player.id);
    setEditingMaxValue(String(player.my_max || ""));
  }

  async function saveMax(player: Player) {
    const parsed = Number(editingMaxValue);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setEditingMaxId(null);
      return;
    }

    await updatePlayer(player.id, {
      my_max: Math.floor(parsed),
    });

    setEditingMaxId(null);
    setEditingMaxValue("");
  }

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return players
      .filter((player) => {
        const matchesSearch =
          !normalizedSearch ||
          player.name.toLowerCase().includes(normalizedSearch) ||
          player.team.toLowerCase().includes(normalizedSearch);

        const matchesRole =
          roleFilter === "Tutti" || player.role === roleFilter;

        const matchesTier =
          tierFilter === "Tutte" || player.tier === tierFilter;

        const matchesTarget =
          !onlyTargets || Boolean(player.target);

        const matchesFavorite =
          !onlyFavorites || Boolean(player.favorite);

        const isFree = player.status === "Libero";

        return (
          matchesSearch &&
          matchesRole &&
          matchesTier &&
          matchesTarget &&
          matchesFavorite &&
          isFree
        );
      })
      .sort((a, b) => {
        // Obiettivi e preferiti leggermente prioritari
        if (a.target !== b.target) return b.target - a.target;
        if (a.favorite !== b.favorite) return b.favorite - a.favorite;

        return b.fvm - a.fvm;
      });
  }, [
    players,
    search,
    roleFilter,
    tierFilter,
    onlyTargets,
    onlyFavorites,
  ]);

  const targetPlayers = useMemo(
    () => players.filter((player) => player.target && player.status === "Libero"),
    [players]
  );

  const favoritePlayers = useMemo(
    () =>
      players.filter(
        (player) => player.favorite && player.status === "Libero"
      ),
    [players]
  );

  const myPlayers = useMemo(
    () => players.filter((player) => player.status === "Mio Team"),
    [players]
  );

  // ---- Budget dinamico: crediti spesi = somma dei purchase_price della rosa ----
  const budgetSpent = useMemo(
    () =>
      myPlayers.reduce(
        (sum, player) => sum + (player.purchase_price || 0),
        0
      ),
    [myPlayers]
  );

  const budgetRemaining = TOTAL_BUDGET - budgetSpent;

  // ---- Slot rosa: quanti giocatori hai già per ciascun ruolo ----
  const roleCounts = useMemo(() => {
    const counts: RoleCounts = { P: 0, D: 0, C: 0, A: 0 };

    myPlayers.forEach((player) => {
      counts[player.role] = (counts[player.role] || 0) + 1;
    });

    return counts;
  }, [myPlayers]);

  const auctionPlayers = useMemo(() => {
    const normalized = auctionSearch.trim().toLowerCase();

    return players
      .filter((player) => {
        if (player.status !== "Libero") return false;

        if (!normalized) return true;

        return (
          player.name.toLowerCase().includes(normalized) ||
          player.team.toLowerCase().includes(normalized)
        );
      })
      .sort((a, b) => {
        if (a.target !== b.target) return b.target - a.target;
        if (a.favorite !== b.favorite) return b.favorite - a.favorite;
        return b.fvm - a.fvm;
      });
  }, [players, auctionSearch]);

  function openAuction(player: Player) {
    setActivePlayer(player);

    const initialPrice =
      player.auction_price && player.auction_price > 0
        ? player.auction_price
        : player.fvm > 0
        ? player.fvm
        : 1;

    setBidPrice(initialPrice);
  }

  async function assignPlayer() {
    if (!activePlayer) return;

    // Guardia di sicurezza: non assegnare se il ruolo è già al completo
    // (in UI il bottone è comunque disabilitato in questo caso).
    const roleLimit = ROLE_SLOTS[activePlayer.role] ?? Infinity;
    const currentRoleCount = roleCounts[activePlayer.role] ?? 0;

    if (currentRoleCount >= roleLimit) {
      return;
    }

    await updatePlayer(activePlayer.id, {
      status: "Mio Team",
      purchase_price: bidPrice,
      auction_price: bidPrice,
    });

    setActivePlayer(null);
    setBidPrice(1);
  }

  function clearFilters() {
    setSearch("");
    setRoleFilter("Tutti");
    setTierFilter("Tutte");
    setOnlyTargets(false);
    setOnlyFavorites(false);
  }

  if (loading) {
    return (
      <div className={`app ${theme}`}>
        <div className="loading-screen">
          <div className="loading-spinner">
            <RefreshCw size={24} />
          </div>
          <h2>Caricamento Fanta Assistant</h2>
          <p>Connessione al database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${theme}`}>
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
      <Sidebar
        page={page}
        setPage={setPage}
        budget={budgetRemaining}
        playerCount={myPlayers.length}
        roleCounts={roleCounts}
      />

      <main>
        <Header
          page={page}
          theme={theme}
          setTheme={setTheme}
          connection={connection}
          onRefresh={loadPlayers}
        />

        {page === "Dashboard" && (
          <Dashboard
            players={players}
            targets={targetPlayers}
            favorites={favoritePlayers}
            myPlayers={myPlayers}
            onNavigate={setPage}
          />
        )}

        {(page === "Listone" || page === "Obiettivi") && (
          <Listone
            page={page}
            players={filteredPlayers}
            search={search}
            setSearch={setSearch}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            tierFilter={tierFilter}
            setTierFilter={setTierFilter}
            onlyTargets={page === "Obiettivi" ? true : onlyTargets}
            setOnlyTargets={setOnlyTargets}
            onlyFavorites={onlyFavorites}
            setOnlyFavorites={setOnlyFavorites}
            editingMaxId={editingMaxId}
            editingMaxValue={editingMaxValue}
            setEditingMaxValue={setEditingMaxValue}
            startEditingMax={startEditingMax}
            saveMax={saveMax}
            toggleFavorite={toggleFavorite}
            toggleTarget={toggleTarget}
            updatingIds={updatingIds}
            clearFilters={clearFilters}
          />
        )}

        {page === "Asta Live" && (
          <AuctionLive
            players={auctionPlayers}
            search={auctionSearch}
            setSearch={setAuctionSearch}
            activePlayer={activePlayer}
            bidPrice={bidPrice}
            setBidPrice={setBidPrice}
            openAuction={openAuction}
            assignPlayer={assignPlayer}
            closeAuction={() => setActivePlayer(null)}
            updatingIds={updatingIds}
            roleCounts={roleCounts}
          />
        )}
      </main>
    </div>
  );
}

/* =========================================================
   SIDEBAR
========================================================= */

function Sidebar({
  page,
  setPage,
  budget,
  playerCount,
  roleCounts,
}: {
  page: Page;
  setPage: (page: Page) => void;
  budget: number;
  playerCount: number;
  roleCounts: RoleCounts;
}) {
  return (
    <aside>
      <div className="brand">
        <div className="brand-mark">⚽</div>
        <div>
          <b>Fanta</b>
          <span>Assistant</span>
        </div>
      </div>

      <div className="nav-section">
        <span className="nav-label">GESTIONE</span>

        <Nav
          title="Dashboard"
          icon={<BarChart3 size={19} />}
          active={page === "Dashboard"}
          onClick={() => setPage("Dashboard")}
        />

        <Nav
          title="Listone"
          icon={<Users size={19} />}
          active={page === "Listone"}
          onClick={() => setPage("Listone")}
        />

        <Nav
          title="Obiettivi"
          icon={<Target size={19} />}
          active={page === "Obiettivi"}
          onClick={() => setPage("Obiettivi")}
        />

        <Nav
          title="Asta Live"
          icon={<Hammer size={19} />}
          active={page === "Asta Live"}
          onClick={() => setPage("Asta Live")}
        />
      </div>

      <div className="sidebar-bottom">
        <div className="budget">
          <div className="budget-icon">
            <Wallet size={18} />
          </div>

          <div className="budget-content">
            <span>Budget disponibile</span>
            <b>{budget} cr</b>
          </div>
        </div>

        <RoleSlots roleCounts={roleCounts} />

        <div className="squad-mini">
          <div>
            <span>Rosa</span>
            <b>{playerCount}</b>
          </div>

          <div>
            <span>Stagione</span>
            <b>26/27</b>
          </div>
        </div>
      </div>
    </aside>
  );
}

function RoleSlots({ roleCounts }: { roleCounts: RoleCounts }) {
  const roles = ["P", "D", "C", "A"];

  return (
    <div className="role-slots">
      <span className="role-slots-label">ROSA PER RUOLO</span>

      <div className="role-slots-grid">
        {roles.map((role) => {
          const count = roleCounts[role] || 0;
          const limit = ROLE_SLOTS[role] || 0;
          const isFull = limit > 0 && count >= limit;
          const pct = limit > 0 ? Math.min(100, (count / limit) * 100) : 0;

          return (
            <div
              key={role}
              className={`role-slot ${isFull ? "full" : ""}`}
              title={ROLE_LABELS[role]}
            >
              <span className={`role-slot-badge r r${role}`}>{role}</span>

              <div className="role-slot-bar">
                <div
                  className="role-slot-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <span className="role-slot-count">
                {count}/{limit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Nav({
  title,
  icon,
  active,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav ${active ? "active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{title}</span>
    </button>
  );
}

/* =========================================================
   HEADER
========================================================= */

function Header({
  page,
  theme,
  setTheme,
  connection,
  onRefresh,
}: {
  page: Page;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  connection: ConnectionStatus;
  onRefresh: () => void;
}) {
  return (
    <header>
      <div>
        <small>ASTA 2026 / 27</small>
        <h1>{page}</h1>
      </div>

      <div className="header-actions">
        <ConnectionBadge status={connection} />

        <button
          className="icon-button"
          type="button"
          onClick={onRefresh}
          title="Aggiorna dati"
        >
          <RefreshCw size={18} />
        </button>

        <button
          className="theme-toggle"
          type="button"
          onClick={() =>
            setTheme(theme === "dark" ? "light" : "dark")
          }
          title="Cambia tema"
        >
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </div>
    </header>
  );
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status === "online") {
    return (
      <div className="connection online">
        <span />
        API online
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="connection connecting">
        <span />
        Connessione...
      </div>
    );
  }

  return (
    <div className="connection offline">
      <span />
      API offline
    </div>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  players,
  targets,
  favorites,
  myPlayers,
  onNavigate,
}: {
  players: Player[];
  targets: Player[];
  favorites: Player[];
  myPlayers: Player[];
  onNavigate: (page: Page) => void;
}) {
  const freePlayers = players.filter((p) => p.status === "Libero");

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">PANORAMICA ASTA</span>
          <h2>Pronto per costruire la tua rosa.</h2>
          <p>
            Tieni sotto controllo giocatori, obiettivi e budget durante
            tutta l&apos;asta.
          </p>
        </div>

        <button
          className="primary-action"
          type="button"
          onClick={() => onNavigate("Asta Live")}
        >
          <Hammer size={18} />
          Apri Asta Live
        </button>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Giocatori disponibili"
          value={freePlayers.length}
          icon={<Users size={20} />}
        />

        <StatCard
          label="Obiettivi"
          value={targets.length}
          icon={<Target size={20} />}
        />

        <StatCard
          label="Preferiti"
          value={favorites.length}
          icon={<Star size={20} />}
        />

        <StatCard
          label="Nella tua rosa"
          value={myPlayers.length}
          icon={<Check size={20} />}
        />
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">I TUOI OBIETTIVI</span>
              <h3>Da tenere d&apos;occhio</h3>
            </div>

            <button
              className="text-button"
              type="button"
              onClick={() => onNavigate("Obiettivi")}
            >
              Vedi tutti
            </button>
          </div>

          <div className="dashboard-player-list">
            {targets.slice(0, 5).map((player) => (
              <MiniPlayer key={player.id} player={player} />
            ))}

            {!targets.length && (
              <EmptyState
                icon={<Target size={22} />}
                title="Nessun obiettivo"
                text="Segna i giocatori che vuoi seguire durante l'asta."
              />
            )}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">FASCE TOP</span>
              <h3>Giocatori premium</h3>
            </div>

            <button
              className="text-button"
              type="button"
              onClick={() => onNavigate("Listone")}
            >
              Apri listone
            </button>
          </div>

          <div className="dashboard-player-list">
            {freePlayers
              .filter((p) => p.tier === "1. Top")
              .slice(0, 5)
              .map((player) => (
                <MiniPlayer key={player.id} player={player} />
              ))}

            {!freePlayers.filter((p) => p.tier === "1. Top").length && (
              <EmptyState
                icon={<Users size={22} />}
                title="Nessun giocatore"
                text="Non ci sono giocatori Top disponibili."
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function MiniPlayer({ player }: { player: Player }) {
  return (
    <div className="mini-player">
      <RoleBadge role={player.role} />

      <div className="mini-player-info">
        <b>{player.name}</b>
        <span>{player.team}</span>
      </div>

      <div className="mini-player-value">
        <span>FVM</span>
        <b>{player.fvm}</b>
      </div>
    </div>
  );
}

/* =========================================================
   LISTONE
========================================================= */

function Listone({
  page,
  players,
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  tierFilter,
  setTierFilter,
  onlyTargets,
  setOnlyTargets,
  onlyFavorites,
  setOnlyFavorites,
  editingMaxId,
  editingMaxValue,
  setEditingMaxValue,
  startEditingMax,
  saveMax,
  toggleFavorite,
  toggleTarget,
  updatingIds,
  clearFilters,
}: {
  page: Page;
  players: Player[];
  search: string;
  setSearch: (value: string) => void;
  roleFilter: string;
  setRoleFilter: (value: string) => void;
  tierFilter: string;
  setTierFilter: (value: string) => void;
  onlyTargets: boolean;
  setOnlyTargets: (value: boolean) => void;
  onlyFavorites: boolean;
  setOnlyFavorites: (value: boolean) => void;
  editingMaxId: number | null;
  editingMaxValue: string;
  setEditingMaxValue: (value: string) => void;
  startEditingMax: (player: Player) => void;
  saveMax: (player: Player) => void;
  toggleFavorite: (player: Player) => void;
  toggleTarget: (player: Player) => void;
  updatingIds: number[];
  clearFilters: () => void;
}) {
  const hasFilters =
    search ||
    roleFilter !== "Tutti" ||
    tierFilter !== "Tutte" ||
    onlyTargets ||
    onlyFavorites;

  return (
    <>
      <div className="toolbar">
        <div className="search-bar">
          <Search size={18} />
          <input
            placeholder="Cerca giocatore o squadra..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearch("")}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="select-wrapper">
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <ChevronDown size={16} />
        </div>

        <div className="select-wrapper">
          <select
            value={tierFilter}
            onChange={(event) => setTierFilter(event.target.value)}
          >
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
          <ChevronDown size={16} />
        </div>

        <button
          className={`btn-filter ${onlyFavorites ? "sel" : ""}`}
          type="button"
          onClick={() => setOnlyFavorites(!onlyFavorites)}
        >
          <Star size={16} fill={onlyFavorites ? "currentColor" : "none"} />
          Preferiti
        </button>

        <button
          className={`btn-filter ${onlyTargets ? "sel" : ""}`}
          type="button"
          onClick={() => setOnlyTargets(!onlyTargets)}
        >
          <Target size={16} />
          Obiettivi
        </button>

        {hasFilters && (
          <button
            className="clear-filters"
            type="button"
            onClick={clearFilters}
          >
            <X size={15} />
            Reset
          </button>
        )}
      </div>

      <div className="listone-meta">
        <div>
          <b>{page === "Obiettivi" ? "I tuoi obiettivi" : "Listone"}</b>
          <span>{players.length} giocatori disponibili</span>
        </div>

        {page === "Obiettivi" && (
          <div className="target-info">
            <Target size={15} />
            Mostrando solo i giocatori contrassegnati come obiettivo
          </div>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th className="actions-column"></th>
              <th>GIOCATORE</th>
              <th>FASCIA</th>
              <th>QUOT.</th>
              <th>FVM</th>
              <th>MIO MAX</th>
            </tr>
          </thead>

          <tbody>
            {players.map((player) => {
              const isUpdating = updatingIds.includes(player.id);
              const isEditing = editingMaxId === player.id;

              return (
                <tr
                  key={player.id}
                  className={isUpdating ? "row-updating" : ""}
                >
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className={`table-action ${
                          player.favorite ? "favorite-active" : ""
                        }`}
                        title="Preferito"
                        onClick={() => toggleFavorite(player)}
                      >
                        <Star
                          size={17}
                          fill={player.favorite ? "currentColor" : "none"}
                        />
                      </button>

                      <button
                        type="button"
                        className={`table-action ${
                          player.target ? "target-active" : ""
                        }`}
                        title="Obiettivo"
                        onClick={() => toggleTarget(player)}
                      >
                        <Target size={17} />
                      </button>
                    </div>
                  </td>

                  <td>
                    <div className="player-info">
                      <RoleBadge role={player.role} />

                      <div>
                        <b>{player.name}</b>
                        <span>{player.team}</span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className="tier-badge">{player.tier}</span>
                  </td>

                  <td>
                    <span className="quotation">
                      {player.quotation}
                    </span>
                  </td>

                  <td>
                    <span className="fvm-value">{player.fvm}</span>
                  </td>

                  <td>
                    {isEditing ? (
                      <div className="max-editor">
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          value={editingMaxValue}
                          onChange={(event) =>
                            setEditingMaxValue(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              saveMax(player);
                            }

                            if (event.key === "Escape") {
                              setEditingMaxValue("");
                            }
                          }}
                          onBlur={() => saveMax(player)}
                        />

                        <span>cr</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="max-value"
                        onClick={() => startEditingMax(player)}
                        title="Modifica il tuo budget massimo"
                      >
                        <span>{player.my_max || 0}</span>
                        <small>cr</small>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!players.length && (
          <EmptyState
            icon={<Search size={24} />}
            title="Nessun giocatore trovato"
            text="Prova a modificare la ricerca o a rimuovere qualche filtro."
          />
        )}
      </div>
    </>
  );
}

/* =========================================================
   ASTA LIVE
========================================================= */

function AuctionLive({
  players,
  search,
  setSearch,
  activePlayer,
  bidPrice,
  setBidPrice,
  openAuction,
  assignPlayer,
  closeAuction,
  updatingIds,
  roleCounts,
}: {
  players: Player[];
  search: string;
  setSearch: (value: string) => void;
  activePlayer: Player | null;
  bidPrice: number;
  setBidPrice: (value: number) => void;
  openAuction: (player: Player) => void;
  assignPlayer: () => void;
  closeAuction: () => void;
  updatingIds: number[];
  roleCounts: RoleCounts;
}) {
  const margin = activePlayer
    ? activePlayer.my_max - bidPrice
    : 0;

  const isOverMax =
    Boolean(activePlayer) &&
    activePlayer!.my_max > 0 &&
    bidPrice > activePlayer!.my_max;

  const isNearMax =
    Boolean(activePlayer) &&
    activePlayer!.my_max > 0 &&
    bidPrice > activePlayer!.my_max * 0.85 &&
    !isOverMax;

  // ---- Stato slot ruolo per il giocatore selezionato ----
  const roleLimit = activePlayer ? ROLE_SLOTS[activePlayer.role] ?? 0 : 0;
  const roleCount = activePlayer ? roleCounts[activePlayer.role] ?? 0 : 0;
  const isRoleFull = Boolean(activePlayer) && roleCount >= roleLimit;
  useEffect(() => {
    if (!activePlayer) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case "Enter":
          e.preventDefault();
          if (!isRoleFull && !updatingIds.includes(activePlayer.id)) assignPlayer();
          break;
        case "ArrowUp":
          e.preventDefault();
          setBidPrice(prev => prev + 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          setBidPrice(prev => Math.max(1, prev - 1));
          break;
        case "Escape":
          e.preventDefault();
          closeAuction();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePlayer, isRoleFull, updatingIds, assignPlayer, closeAuction, setBidPrice]);
  return (
    <div className="asta-layout">
      <div className="asta-search-panel">
        <div className="asta-panel-header">
          <div>
            <span className="eyebrow">ASTA LIVE</span>
            <h3>Giocatori disponibili</h3>
          </div>

          <span className="player-count">{players.length}</span>
        </div>

        <div className="asta-search">
          <Search size={17} />
          <input
            type="text"
            placeholder="Cerca nome o squadra..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="asta-list">
          {players.slice(0, 80).map((player) => (
            <button
              key={player.id}
              type="button"
              className={`asta-list-item ${
                activePlayer?.id === player.id ? "selected" : ""
              }`}
              onClick={() => openAuction(player)}
            >
              <RoleBadge role={player.role} />

              <div className="asta-list-player">
                <b>{player.name}</b>
                <span>{player.team}</span>
              </div>

              <div className="asta-list-fvm">
                <small>FVM</small>
                <b>{player.fvm}</b>
              </div>
            </button>
          ))}

          {!players.length && (
            <EmptyState
              icon={<Search size={22} />}
              title="Nessun risultato"
              text="Prova con un altro nome."
            />
          )}
        </div>
      </div>

      {activePlayer ? (
        <div className="asta-card active">
          <div className="auction-card-top">
            <span className="live-indicator">
              <span />
              LIVE
            </span>

            <button
              type="button"
              className="close-auction"
              onClick={closeAuction}
            >
              <X size={18} />
            </button>
          </div>

          <div className="auction-player">
            <RoleBadge role={activePlayer.role} large />

            <span className="auction-tier">
              {activePlayer.tier}
            </span>

            <h2>{activePlayer.name}</h2>
            <p>{activePlayer.team}</p>
          </div>

          <div className="asta-stats">
            <AuctionStat
              label="FVM"
              value={`${activePlayer.fvm}`}
            />

            <AuctionStat
              label="Tuo MAX"
              value={`${activePlayer.my_max || 0} cr`}
              highlight
            />

            <AuctionStat
              label="Quotazione"
              value={`${activePlayer.quotation}`}
            />

            <AuctionStat
              label="Slot Ruolo"
              value={`${roleCount}/${roleLimit}`}
              highlight={isRoleFull}
            />
          </div>

          {isRoleFull ? (
            <div className="bid-status danger">
              <AlertCircle size={18} />
              <div>
                <b>
                  Ruolo {ROLE_LABELS[activePlayer.role]} al completo
                </b>
                <span>
                  Hai già {roleLimit} giocatori in questo ruolo. Libera
                  uno slot prima di assegnarne un altro.
                </span>
              </div>
            </div>
          ) : (
            <div
              className={`bid-status ${
                isOverMax
                  ? "danger"
                  : isNearMax
                  ? "warning"
                  : "safe"
              }`}
            >
              {isOverMax ? (
                <>
                  <AlertCircle size={18} />
                  <div>
                    <b>Oltre il tuo MAX</b>
                    <span>
                      Hai superato il limite di{" "}
                      {Math.abs(margin)} crediti.
                    </span>
                  </div>
                </>
              ) : isNearMax ? (
                <>
                  <AlertCircle size={18} />
                  <div>
                    <b>Vicino al tuo limite</b>
                    <span>
                      Ti rimangono {margin} crediti di margine.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <div>
                    <b>Ancora conveniente</b>
                    <span>
                      Hai {margin} crediti di margine sul tuo MAX.
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="auction-price">
            <label>PREZZO DI ACQUISTO</label>

            <div className="price-input">
              <button
                type="button"
                onClick={() =>
                  setBidPrice(Math.max(1, bidPrice - 1))
                }
              >
                −
              </button>

              <input
                type="number"
                min="1"
                value={bidPrice}
                onChange={(event) =>
                  setBidPrice(
                    Math.max(1, Number(event.target.value) || 1)
                  )
                }
              />

              <span>CR</span>

              <button
                type="button"
                onClick={() =>
                  setBidPrice(bidPrice + 1)
                }
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn-assign"
            disabled={
              updatingIds.includes(activePlayer.id) || isRoleFull
            }
            onClick={assignPlayer}
          >
            <Check size={19} />
            {isRoleFull ? "Ruolo al completo" : "Assegna al Mio Team"}
          </button>

          <button
            type="button"
            className="btn-cancel"
            onClick={closeAuction}
          >
            Chiudi asta
          </button>
        </div>
      ) : (
        <div className="asta-card empty-auction">
          <div className="empty-auction-icon">
            <Hammer size={30} />
          </div>

          <h2>Pronto per l&apos;asta</h2>

          <p>
            Seleziona un giocatore dalla lista per aprire
            la sua scheda e registrare il prezzo di acquisto.
          </p>

          <div className="auction-tip">
            <span>💡</span>
            <div>
              <b>Consiglio</b>
              <p>
                Usa il tuo MAX per sapere subito quando
                stai andando oltre il budget che ti eri prefissato.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuctionStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="auction-stat">
      <span>{label}</span>
      <b className={highlight ? "highlight" : ""}>{value}</b>
    </div>
  );
}

/* =========================================================
   SHARED COMPONENTS
========================================================= */

function RoleBadge({
  role,
  large = false,
}: {
  role: string;
  large?: boolean;
}) {
  return (
    <span className={`r r${role} ${large ? "large" : ""}`}>
      {role}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
