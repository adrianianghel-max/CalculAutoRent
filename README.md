# CalculAutoRent

Aplicatie web pentru calcul rent auto RCA:
- frontend React (`/frontend`)
- backend FastAPI (`/backend`)

## Rulare locala

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
cp .env.example .env
yarn install
yarn start
```

Frontend local: `http://localhost:3000`  
Backend local: `http://localhost:8000`

## Deploy cu link public (recomandat: Render)

Acest repo include `render.yaml` pentru deploy automat backend + frontend.

### 1) Publica proiectul pe GitHub
Repo-ul trebuie sa fie disponibil pe GitHub.

### 2) Creeaza serviciile pe Render
1. Intra pe Render -> **New** -> **Blueprint**.
2. Conecteaza acest repository.
3. Render citeste `render.yaml` si propune:
   - `calculautorent-backend` (FastAPI)
   - `calculautorent-frontend` (static site)

### 3) Configureaza variabilele de mediu
- La **backend** (`calculautorent-backend`):
  - `CORS_ORIGINS=https://<frontend-url-render>,http://localhost:3000`
- La **frontend** (`calculautorent-frontend`):
  - `REACT_APP_BACKEND_URL=https://<backend-url-render>` (**obligatoriu la build time**)

Nota: pentru frontend static (CRA), `REACT_APP_BACKEND_URL` este incorporat in bundle in timpul `yarn build`.  
Daca schimbi valoarea variabilei, trebuie redeploy/rebuild ca sa intre in aplicatie.

### 4) Activeaza auto-deploy
Este deja setat in `render.yaml` (`autoDeploy: true`).  
Orice commit nou pe branch-ul conectat declanseaza deploy.

### 5) Foloseste linkul public
Vei primi URL-uri publice de forma:
- frontend: `https://calculautorent-frontend.onrender.com`
- backend: `https://calculautorent-backend.onrender.com`

Aplicatia o deschizi de oriunde prin linkul de frontend.

## Uptime (sa ramana activa)

- Planurile gratuite pot pune aplicatia in sleep dupa inactivitate.
- Pentru uptime constant, foloseste:
  - plan platit pe platforma de hosting, sau
  - VPS (control complet, fara sleep implicit).

## Alternative rapide

- Frontend pe **Vercel/Netlify** + backend pe **Render/Railway/Fly.io**.
- Daca separi platformele, pastreaza `REACT_APP_BACKEND_URL` catre URL-ul real al backend-ului.
