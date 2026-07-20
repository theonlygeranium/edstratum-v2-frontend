/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRATUM_API_URL?: string
  readonly VITE_MOCK_ESCALATION_FAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
