from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3, json
from pathlib import Path
import openpyxl

DB = Path("fanta.db")
app = FastAPI(title="Fanta Assistant API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SCHEMA = """CREATE TABLE IF NOT EXISTS players(
id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,team TEXT,role TEXT,
quotation INTEGER DEFAULT 0,fvm INTEGER DEFAULT 0,tier TEXT DEFAULT '4. Quarta',
tier_source TEXT DEFAULT 'algorithm',fantasy_score REAL DEFAULT 0,
auction_price REAL,favorite INTEGER DEFAULT 0,target INTEGER DEFAULT 0,
my_max INTEGER DEFAULT 0,notes TEXT DEFAULT '',status TEXT DEFAULT 'Libero',
purchase_price INTEGER DEFAULT 0);"""

def conn():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; c.execute(SCHEMA); c.commit(); return c

@app.get("/api/health")
def health(): conn().close(); return {"ok": True}

@app.get("/api/players")
def players():
    c = conn(); x = [dict(r) for r in c.execute("select * from players order by role,name")]; c.close(); return x

@app.post("/api/demo")
def demo():
    c = conn(); c.execute("delete from players")
    demo = [
      ("Svilar","ROM","P",19,60,"1. Top",91,55),
      ("Dimarco","INT","D",32,265,"1. Top",94,75),
      ("Wesley","ROM","D",30,180,"2. Semi-Top",87,38),
      ("Nico Paz","COM","C",30,250,"1. Top",93,82),
      ("Calhanoglu","INT","C",28,230,"1. Top",92,76),
      ("Pulisic","MIL","C",24,190,"1. Top",90,57),
      ("Lautaro","INT","A",53,370,"1. Top",96,150),
      ("Malen","ROM","A",61,365,"1. Top",93,140)]
    for name,team,role,q,fvm,tier,score,auction in demo:
        c.execute("""insert into players
        (name,team,role,quotation,fvm,tier,fantasy_score,auction_price,my_max)
        values(?,?,?,?,?,?,?,?,?)""",(name,team,role,q,fvm,tier,score,auction,round(auction*1.08)))
    c.commit(); c.close(); return {"ok":True,"count":len(demo)}

@app.patch("/api/players/{pid}")
def update(pid:int, body:dict):
    allowed={"favorite","target","my_max","notes","tier"}
    vals={k:v for k,v in body.items() if k in allowed}
    if "tier" in vals: vals["tier_source"]="manual"
    c=conn()
    if not vals: r=c.execute("select * from players where id=?",(pid,)).fetchone()
    else:
        sets=",".join(f"{k}=?" for k in vals)
        c.execute(f"update players set {sets} where id=?",(*vals.values(),pid)); c.commit()
        r=c.execute("select * from players where id=?",(pid,)).fetchone()
    c.close(); return dict(r) if r else {"error":"not found"}

def assign_tier(pct: float) -> str:
    if pct >= 0.90: return "1. Top"
    if pct >= 0.75: return "2. Semi-Top"
    if pct >= 0.50: return "3. Terza"
    if pct >= 0.25: return "4. Quarta"
    if pct >= 0.10: return "5. Scommesse"
    return "6. Riserve"

@app.get("/api/import")
def import_excel(path: str = "Quotazioni_Fantacalcio_Stagione_2026_27.xlsx"):
    fp = Path(path)
    if not fp.exists():
        return {"error": f"file non trovato: {fp}"}

    wb = openpyxl.load_workbook(fp, data_only=True)
    ws = wb["Tutti"]  # 533 giocatori attivi, esclude "Ceduti"

    by_role = {}
    for row in ws.iter_rows(min_row=3, values_only=True):
        _id, role, rm, nome, squadra, qta, qti, diff, qtam, qtim, diffm, fvm, fvmm = row
        if not nome:
            continue
        by_role.setdefault(role, []).append((nome, squadra, qta, fvm))

    records = []
    for role, players_list in by_role.items():
        players_list.sort(key=lambda p: p[3] or 0, reverse=True)  # ordina per FVM decrescente
        n = len(players_list)
        for i, (nome, squadra, qta, fvm) in enumerate(players_list):
            pct = 1 - i / n
            records.append((nome, squadra, role, qta or 0, fvm or 0, assign_tier(pct)))

    c = conn()
    c.execute("delete from players")
    c.executemany(
        """insert into players (name, team, role, quotation, fvm, tier, tier_source)
           values (?, ?, ?, ?, ?, ?, 'algorithm')""",
        records
    )
    c.commit()
    total = c.execute("select count(*) from players").fetchone()[0]
    c.close()
    return {"ok": True, "imported": total, "by_role": {r: len(p) for r, p in by_role.items()}}