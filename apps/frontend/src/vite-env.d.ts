/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_ENABLE_DEMO_SIGNALS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
