/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin when it differs from the app's own (e.g. `http://localhost:4000`). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
