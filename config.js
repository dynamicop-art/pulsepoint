// Set this after deploying your Render backend. No secrets belong here.
window.PULSEPOINT_CONFIG = {
  API_BASE_URL: ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:5000/api'
    : '', // Example: https://YOUR-SERVICE.onrender.com/api
};
