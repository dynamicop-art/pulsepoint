# PulsePoint Emergency Care Web App

A production-ready, standalone emergency hospital, bed, blood, and organ locator application built in a high-contrast **Red, Green, and White** medical design system.

## Features
- **Real Google Maps Integration**: Direct turn-by-turn navigation via Google Maps deep links.
- **Instant Browser Geolocation**: Calculates real-time distance and estimated route time to each medical center using the Haversine formula.
- **Zero-Popup Architecture**: All features (facility inspector, urgent blood requisition form, doctor rosters, telemetry manager) are embedded into one unified, scrollable page.
- **Live ICU & Ventilator Telemetry**: Tracks real-time open beds across hospitals in the Kolaghat/NH-6 trauma corridor.
- **Blood Bank & NOTTO Organ Registry**: Complete matrix across all 8 blood groups and organ donor lists with an urgent requisition broadcast form.
- **Emergency Sensory Dispatch**: Includes an emergency audio siren synthesizer (Web Audio API) and strobe beacon alert for critical roadside triage.
- **Dual Authentication**: Instant 1-click test credentials for Citizens and Hospital Desk/EMT staff to update bed and blood inventory live.

## How to Run Locally
1. Download or clone this repository.
2. Open `index.html` directly in any web browser (Chrome, Safari, Edge, Firefox).
3. No server or build setup is required (pure vanilla HTML5, CSS3, and JavaScript).

## How to Deploy on GitHub Pages
1. Create a new repository on GitHub (e.g., `pulsepoint-emergency`).
2. Push or upload `index.html`, `style.css`, and `script.js` to the `main` branch.
3. In GitHub, navigate to **Settings** > **Pages**.
4. Under **Branch**, select `main` and root `/`, then click **Save**.
5. Your live app will be accessible at `https://<your-username>.github.io/pulsepoint-emergency/`.
