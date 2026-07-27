/**
 * Google Cloud Storage client using Application Default Credentials (ADC).
 *
 * Credential resolution order (handled by the GCS SDK):
 * 1. GOOGLE_APPLICATION_CREDENTIALS → service account JSON key file
 * 2. gcloud user credentials (`gcloud auth application-default login`)
 * 3. Attached service account on GCE / Cloud Run / GKE
 */
import { Storage, File } from '@google-cloud/storage'
import { env } from '../config/env.config.js'

let storageClient: Storage | null = null

function getStorage(): Storage {
  if (!storageClient) {
    storageClient = new Storage({
      ...(env.GCP_PROJECT_ID ? { projectId: env.GCP_PROJECT_ID } : {}),
    })
  }
  return storageClient
}

export function isGcsConfigured(): boolean {
  return Boolean(env.GCS_BUCKET_NAME)
}

/**
 * Resolve a blob file path from a call record.
 * Prefer `recording_path`; fall back to parsing a GCS HTTPS URL.
 */
export function resolveRecordingObjectPath(call: {
  recording_path?: string | null
  recording_url?: string | null
}): string | null {
  if (call.recording_path) {
    return call.recording_path.replace(/^\/+/, '')
  }

  if (!call.recording_url) return null

  try {
    const url = new URL(call.recording_url)
    const host = url.hostname

    // https://storage.googleapis.com/<bucket>/<object>
    if (host === 'storage.googleapis.com') {
      const parts = url.pathname.replace(/^\/+/, '').split('/')
      if (parts.length < 2) return null
      const [, ...objectParts] = parts
      return decodeURIComponent(objectParts.join('/'))
    }

    // https://storage.cloud.google.com/<bucket>/<object>
    if (host === 'storage.cloud.google.com') {
      const parts = url.pathname.replace(/^\/+/, '').split('/')
      if (parts.length < 2) return null
      const [, ...objectParts] = parts
      return decodeURIComponent(objectParts.join('/'))
    }
  } catch {
    // Not a valid URL — ignore
  }

  return null
}

export interface RecordingObject {
  file: File
  contentType: string
  size: number
}

/** Fetch recording metadata from the private bucket (ADC). */
export async function getRecordingObject(objectPath: string): Promise<RecordingObject | null> {
  if (!isGcsConfigured()) {
    throw new Error('GCS_BUCKET_NAME is not configured')
  }

  const bucket = getStorage().bucket(env.GCS_BUCKET_NAME)
  const file = bucket.file(objectPath)
  const [exists] = await file.exists()

  if (!exists) return null

  const [metadata] = await file.getMetadata()
  const contentType =
    (typeof metadata.contentType === 'string' && metadata.contentType) ||
    guessContentType(objectPath)
  const size = metadata.size != null ? Number(metadata.size) : 0

  return { file, contentType, size }
}

function guessContentType(objectPath: string): string {
  const lower = objectPath.toLowerCase()
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  if (lower.endsWith('.webm')) return 'audio/webm'
  if (lower.endsWith('.m4a')) return 'audio/mp4'
  return 'audio/mpeg'
}
