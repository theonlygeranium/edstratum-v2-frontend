/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRATUM_API_URL?: string
  readonly VITE_STRATUM_QA?: string
  readonly VITE_ANALYTICS_ENDPOINT?: string
  readonly VITE_MOCK_BACKEND_ERROR?: string
  readonly VITE_MOCK_ESCALATION_FAIL?: string
  readonly VITE_SENTIMENT_TEST_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
