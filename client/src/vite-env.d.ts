/// <reference types="vite/client" />

declare module '*.tsx' {
  const value: React.ReactElement
  export default value
}

declare module '*.ts' {
  const value: unknown
  export default value
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}