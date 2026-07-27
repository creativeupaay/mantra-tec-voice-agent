import { config } from 'dotenv'

config()

interface EnvConfig {
  PORT: string
  MONGODB_URI: string
  JWT_SECRET: string
  CLIENT_URL: string
  /** Private GCS bucket for call recordings (ADC auth). */
  GCS_BUCKET_NAME: string
  /** Optional GCP project ID for the Storage client. */
  GCP_PROJECT_ID: string
}

const getEnvVar = (key: string, fallback?: string): string => {
  const value = process.env[key]
  if (!value && !fallback) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value || fallback!
}

export const env: EnvConfig = {
  PORT: getEnvVar('PORT', '5000'),
  MONGODB_URI: getEnvVar('MONGODB_URI'), // No fallback - required
  JWT_SECRET: getEnvVar('JWT_SECRET'), // No fallback - required
  CLIENT_URL: getEnvVar('CLIENT_URL'), // No fallback - required
  GCS_BUCKET_NAME: getEnvVar('GCS_BUCKET_NAME', ''),
  GCP_PROJECT_ID: getEnvVar('GCP_PROJECT_ID', ''),
}

export const validateEnv = (): void => {
  const requiredVars = ['JWT_SECRET', 'MONGODB_URI', 'CLIENT_URL']
  const missing: string[] = []

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}