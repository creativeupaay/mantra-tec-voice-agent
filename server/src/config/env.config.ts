import { config } from 'dotenv'

config()

interface EnvConfig {
  PORT: string
  MONGODB_URI: string
  JWT_SECRET: string
  CLIENT_URL: string
  DASHBOARD_URL: string
  /** Private GCS bucket for call recordings. */
  GCS_BUCKET_NAME: string
  /** Optional GCP project ID for the Storage client. */
  GCP_PROJECT_ID: string
  /** Path to GCP service account JSON key file. */
  GOOGLE_APPLICATION_CREDENTIALS?: string
  /** Inlined GCP service account JSON string. */
  GOOGLE_SERVICE_ACCOUNT_JSON?: string
  RESEND_API_KEY?: string
  FROM_EMAIL?: string
}

const getEnvVar = (key: string, fallback?: string): string => {
  const value = process.env[key]
  if (!value && fallback === undefined) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value || fallback!
}

const dashboardUrl = (process.env.DASHBOARD_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')

export const env: EnvConfig = {
  PORT: getEnvVar('PORT', '5000'),
  MONGODB_URI: getEnvVar('MONGODB_URI'),
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  CLIENT_URL: dashboardUrl,
  DASHBOARD_URL: dashboardUrl,
  GCS_BUCKET_NAME: getEnvVar('GCS_BUCKET_NAME', 'mantra-tec'),
  GCP_PROJECT_ID: getEnvVar('GCP_PROJECT_ID', 'mantra-tec'),
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@creativeupaay.in',
}

export const validateEnv = (): void => {
  const requiredVars = ['JWT_SECRET', 'MONGODB_URI']
  const missing: string[] = []

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  if (!process.env.CLIENT_URL && !process.env.DASHBOARD_URL) {
    missing.push('CLIENT_URL (or DASHBOARD_URL)')
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}