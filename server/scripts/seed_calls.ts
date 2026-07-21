import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { Call } from '../src/models/Call.js'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mantra_voice_agent'

const INTENTS = ['product_inquiry', 'support', 'booking', 'pricing', 'complaint', 'general_query']
const OUTCOMES = ['ticket_created', 'booking_made', 'info_provided', 'escalated_to_human', 'callback_scheduled']
const STATUSES: Array<'resolved' | 'escalated' | 'missed'> = ['resolved', 'resolved', 'resolved', 'escalated', 'missed']
const NAMES = ['Rajesh Kumar', 'Anita Sharma', 'Priya Mehta', 'Suresh Gupta', 'Kavita Patel', 'Amit Singh', 'Deepa Nair', 'Vikram Joshi']

const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const getRandomDate = (daysBack: number) => {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack))
  d.setHours(Math.floor(Math.random() * 12) + 8) // 8am–8pm
  d.setMinutes(Math.floor(Math.random() * 60))
  return d
}

const SUMMARIES = [
  'Caller inquired about fingerprint scanner availability for their office.',
  'Customer wanted to understand pricing for the MACS attendance system.',
  'Caller requested a demo of the BioNIC Xtreme FX terminal.',
  'Customer had a complaint about delayed delivery of MELO30 readers.',
  'Inquiry about Aadhaar enrollment kit for a government project.',
  'Caller asked about RFID asset tracking integration options.',
  'Support request for MBAS50 face recognition configuration.',
  'Booking request for a product demonstration at their facility.',
]

const seedCalls = async () => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('Connected.')

    await Call.deleteMany({})
    console.log('Cleared existing calls.')

    const calls = []
    const total = 180

    for (let i = 0; i < total; i++) {
      const status = randomFrom(STATUSES)
      const isRedFlag = status === 'escalated' && Math.random() < 0.35

      calls.push({
        call_id: `CALL-${Date.now()}-${i}`,
        caller_name: Math.random() > 0.3 ? randomFrom(NAMES) : undefined,
        phone_number: `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`,
        timestamp: getRandomDate(30),
        duration: status === 'missed' ? undefined : Math.floor(30 + Math.random() * 300),
        status,
        is_red_flag: isRedFlag,
        detected_intent: Math.random() > 0.15 ? randomFrom(INTENTS) : undefined,
        call_outcome: status === 'resolved' ? randomFrom(OUTCOMES) : undefined,
        call_summary: Math.random() > 0.2 ? randomFrom(SUMMARIES) : undefined,
      })
    }

    await Call.insertMany(calls)

    const flagCount = calls.filter(c => c.is_red_flag).length
    const resolvedCount = calls.filter(c => c.status === 'resolved').length
    console.log(`✅ Seeded ${total} calls. Resolved: ${resolvedCount}, Red Flags: ${flagCount}`)

  } catch (err) {
    console.error('Seeding error:', err)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected.')
  }
}

seedCalls()
