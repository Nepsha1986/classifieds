import { createApp } from './app.js';
import { config } from './config.js';

const server = createApp().listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
