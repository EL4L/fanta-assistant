# Fanta Assistant V1
Web app personale per Fantacalcio Classic: 8 partecipanti, 500 crediti, 3 P, 8 D, 8 C, 6 A.

## Avvio
Backend:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```
