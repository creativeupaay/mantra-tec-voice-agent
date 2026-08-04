/**
 * Google Cloud Storage client using Application Default Credentials (ADC)
 * with support for 30-day object lifecycle management and local file fallback.
 */
import { Storage, File } from '@google-cloud/storage'
import fs from 'fs'
import path from 'path'
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
 * Ensure GCS bucket has a lifecycle rule configured to delete objects older than specified days (default 30).
 */
export async function ensureBucketLifecycleRule(days: number = 30): Promise<void> {
  if (!isGcsConfigured()) return
  try {
    const bucket = getStorage().bucket(env.GCS_BUCKET_NAME)
    const [metadata] = await bucket.getMetadata()
    const lifecycle = metadata.lifecycle || {}
    const rules: Array<any> = lifecycle.rule || []

    const hasRule = rules.some(
      (r) => r.action?.type === 'Delete' && r.condition?.age === days
    )
    if (!hasRule) {
      await bucket.addLifecycleRule({
        action: 'Delete' as any,
        condition: { age: days },
      })
      console.log(`[GCS] Applied ${days}-day deletion lifecycle rule to bucket '${env.GCS_BUCKET_NAME}'`)
    }
  } catch (error: any) {
    console.warn(`[GCS] Could not set ${days}-day lifecycle rule on bucket '${env.GCS_BUCKET_NAME}':`, error.message || error)
  }
}

/**
 * Delete a recording file from GCS bucket.
 */
export async function deleteRecordingFromGcs(objectPath: string): Promise<boolean> {
  if (!isGcsConfigured() || !objectPath) return false
  try {
    const bucket = getStorage().bucket(env.GCS_BUCKET_NAME)
    const file = bucket.file(objectPath)
    const [exists] = await file.exists()
    if (exists) {
      await file.delete()
      console.log(`[GCS] Deleted recording ${objectPath} from bucket '${env.GCS_BUCKET_NAME}'`)
      return true
    }
  } catch (err: any) {
    console.warn(`[GCS] Failed to delete ${objectPath} from GCS:`, err.message || err)
  }
  return false
}

/**
 * Resolve a blob file path from a call record.
 * Prefer `recording_path`; fall back to parsing a GCS HTTPS URL or file URI.
 */
export function resolveRecordingObjectPath(call: {
  recording_path?: string | null
  recording_url?: string | null
}): string | null {
  if (call.recording_path) {
    return call.recording_path.replace(/^\/+/, '')
  }

  if (!call.recording_url) return null

  if (call.recording_url.startsWith('file://')) {
    return call.recording_url.replace(/^file:\/\//, '').replace(/^\/+/, '')
  }

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
    // If not a valid URL, treat as raw path string
    if (typeof call.recording_url === 'string') {
      return call.recording_url.replace(/^\/+/, '')
    }
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

/** Check if recording exists on local filesystem as fallback. */
export function getLocalRecordingPath(objectPath: string): string | null {
  if (!objectPath) return null
  const filename = path.basename(objectPath)
  const possiblePaths = [
    path.resolve(process.cwd(), objectPath),
    path.resolve(process.cwd(), 'recordings', filename),
    path.resolve(process.cwd(), '../python-server', objectPath),
    path.resolve(process.cwd(), '../python-server/recordings', filename),
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return p
    }
  }
  return null
}

export function guessContentType(objectPath: string): string {
  const lower = objectPath.toLowerCase()
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  if (lower.endsWith('.webm')) return 'audio/webm'
  if (lower.endsWith('.m4a')) return 'audio/mp4'
  return 'audio/mpeg'
}
