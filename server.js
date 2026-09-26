const app = require('./backend/server');

app.start().catch(err => {
  console.error('PulsePoint startup failed:', err);
  process.exit(1);
});
