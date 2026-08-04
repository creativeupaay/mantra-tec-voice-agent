/**
 * Automated 30-day recording cleanup service.
 * Deletes call recordings from GCS storage and local filesystem older than 30 days
 * and updates the database records accordingly.
 */
import fs from 'fs'
import { Call } from '../models/Call.js'
import {
  deleteRecordingFromGcs,
  getLocalRecordingPath,
  resolveRecordingObjectPath,
} from './gcs.service.js'

export async function cleanupExpiredRecordings(daysThreshold: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold)
    const cutoffIso = cutoffDate.toISOString()

    // Find all calls older than 30 days that still have recording reference
    const expiredCalls = await Call.find({
      $and: [
        {
          $or: [
            { timestamp: { $lt: cutoffIso } },
            { createdAt: { $lt: cutoffDate } },
          ],
        },
        {
          $or: [
            { recording_path: { $ne: null, $exists: true } },
            { recording_url: { $ne: null, $exists: true } },
          ],
        },
      ],
    }).lean()

    if (expiredCalls.length === 0) {
      console.log(`[Cleanup] No expired recordings (> ${daysThreshold} days) to clean up.`)
      return 0
    }

    console.log(`[Cleanup] Found ${expiredCalls.length} expired call recordings to purge (> ${daysThreshold} days old).`)
    let cleanedCount = 0

    for (const call of expiredCalls) {
      const objectPath = resolveRecordingObjectPath(call)

      if (objectPath) {
        // 1. Delete from GCS bucket
        await deleteRecordingFromGcs(objectPath)

        // 2. Delete from local disk if present
        const localPath = getLocalRecordingPath(objectPath)
        if (localPath && fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath)
            console.log(`[Cleanup] Deleted local file ${localPath}`)
          } catch (err: any) {
            console.warn(`[Cleanup] Failed to delete local file ${localPath}:`, err.message || err)
          }
        }
      }

      // 3. Clear database recording fields
      await Call.updateOne(
        { _id: call._id },
        {
          $unset: { recording_path: '', recording_url: '' },
          $set: { recording_deleted_at: new Date() },
        }
      )
      cleanedCount++
    }

    console.log(`[Cleanup] Successfully cleaned up ${cleanedCount} expired recordings.`)
    return cleanedCount
  } catch (error: any) {
    console.error('[Cleanup] Error during 30-day recording cleanup:', error.message || error)
    return 0
  }
}
