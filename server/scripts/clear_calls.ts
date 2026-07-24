import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI!

async function run() {
  // The URI now includes /mantra_voice_agent — correct database
  console.log('Connecting to:', MONGODB_URI.replace(/:[^:@]+@/, ':***@'))
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  const result = await db.collection('calls').deleteMany({})
  console.log(`✅ Deleted ${result.deletedCount} calls from mantra_voice_agent`)
  await mongoose.disconnect()
}

run().catch(console.error)
