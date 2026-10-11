import os from 'node:os';
import path from 'node:path';

/** Uploaded test files go to a throwaway dir (emptied by the global setup), never to apps/api/uploads. */
export const TEST_UPLOAD_DIR = path.join(os.tmpdir(), 'classifieds-test-uploads');
