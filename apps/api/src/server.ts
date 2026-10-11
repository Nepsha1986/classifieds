import { createApp } from './app.js';
import { config } from './config.js';
import { sweepUploads } from './services/upload-sweep.js';

const server = createApp().listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});

// Background clean-up of orphaned upload files; never blocks or crashes the server.
sweepUploads()
  .then(({ removedTemp, removedPhotos }) => {
    if (removedTemp + removedPhotos > 0) {
      console.log(`Upload sweep removed ${removedTemp} temp and ${removedPhotos} orphaned photo file(s)`);
    }
  })
  .catch((err: unknown) => console.error('Upload sweep failed', err));

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
