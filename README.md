# PulsePoint connected prototype

Start with **SETUP-BANGLA.md** for the complete GitHub Pages + Render setup.

Frontend: HTML/CSS/JavaScript, configured through config.js.
Backend: Node 24, Express, bcrypt password hashes, JWT authentication, atomic JSON disk persistence.

No production credentials are included. Set backend environment variables before starting.
Frontend API URL is intentionally blank for hosted deployments until your real backend URL is known.

This is a sample emergency-care directory and request-recording prototype. It does not dispatch ambulances, notify hospitals, or expose verified live stock.

API integration tests: `cd backend && npm ci && npm test`.
Only the frontend allowlist is published by `.github/workflows/pages.yml`.
