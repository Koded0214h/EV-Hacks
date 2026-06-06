# EV Hacks — Frontend

React 19 + Vite 8 PWA. Two views: Investor Dashboard and Driver Map.

## Stack

- **React 19** — UI
- **Vite 8** — build tool
- **Tailwind CSS** — utility styles
- **Mapbox GL JS** — interactive maps (demand zones, station pins, routing)
- **Framer Motion** — animations
- **jsPDF** — client-side PDF export (AI brief)
- **Lucide React** — icons

## Structure

```
src/
├── api.js              API client + data mappers + auth helpers
├── main.jsx            Entry point, hash-based routing
├── App.jsx             Route switcher (/, #/driver)
├── pages/
│   ├── Landing.jsx     Landing page (two CTAs)
│   ├── Dashboard.jsx   Investor dashboard + auth
│   └── DriverView.jsx  Driver map + auth
└── components/
    └── Beams.jsx       Landing page background effect
```

## Commands

```bash
npm install       # install dependencies
npm run dev       # dev server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview production build locally
npm run lint      # ESLint
```

## Environment variables

Copy `.env.example` → `.env` and fill in:

```env
VITE_MAPBOX_TOKEN=pk.eyJ1...
VITE_API_BASE=http://localhost:8000/api/v1
VITE_INGEST_URL=http://localhost:8000/ingest
```

Production env is in `.env.production` (committed, no secrets):

```env
VITE_API_BASE=http://34.251.241.87/api/v1
VITE_INGEST_URL=http://34.251.241.87/ingest
```

## Auth

JWT-based via `djangorestframework-simplejwt`. Tokens stored in `localStorage` under `evhacks_token`. On page load, `api.auth.me()` validates the token and restores the session.

## Notes

- `vite.config.js` includes `define: { global: 'globalThis' }` — required for packages that reference Node's `global`
- Mapbox token is public-safe (domain-restricted in Mapbox dashboard for production)
- PDF export uses dynamic `import('jspdf')` to keep initial bundle size down
