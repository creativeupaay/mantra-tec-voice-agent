import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { User } from '../src/models/User.js'
import { CreditUsage } from '../src/models/CreditUsage.js'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mantra_voice_agent'

const SERVICES = ['plivo', 'deepgram', 'elevenlabs', 'cartesia', 'openrouter', 'gemini'] as const
const DESCRIPTIONS: Record<string, string[]> = {
  plivo: ['Inbound voice call', 'Outbound voice call', 'Call forwarding'],
  deepgram: ['Speech-to-text transcription', 'Live streaming STT'],
  elevenlabs: ['Premium TTS synthesis (Flash v2.5)', 'Voice cloning synthesis'],
  cartesia: ['Ultra-low latency TTS', 'Sonic-3.5 speech'],
  openrouter: ['Claude 3.5 Sonnet agent response', 'GPT-4o fallback generation'],
  gemini: ['Gemini Live bidirectional stream', 'Product tool extraction']
}

// Generate random date within the last 30 days
const getRandomDate = () => {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * 30))
  // Randomize time too
  date.setHours(Math.floor(Math.random() * 24))
  date.setMinutes(Math.floor(Math.random() * 60))
  return date
}

const seedUsage = async () => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('Connected successfully.')

    // Get an admin user to attach usage to
    const adminUser = await User.findOne({ role: 'super_admin' })
    if (!adminUser) {
      throw new Error('No super_admin user found. Please run seed_admin.ts first.')
    }

    console.log('Clearing existing credit usage records...')
    await CreditUsage.deleteMany({})

    const usageRecords = []
    let totalSpent = 0

    // Add initial platform credit purchase
    usageRecords.push({
      userId: adminUser._id,
      amount: 500,
      description: 'Monthly platform top-up',
      type: 'purchase',
      createdAt: new Date(new Date().setDate(new Date().getDate() - 30)) // 30 days ago
    })

    // Generate ~200 random usage events over the last month
    for (let i = 0; i < 200; i++) {
      const service = SERVICES[Math.floor(Math.random() * SERVICES.length)]
      const descList = DESCRIPTIONS[service]
      const description = descList[Math.floor(Math.random() * descList.length)]
      
      // Calculate a random cost based on the service
      let amount = 0
      const metadata: any = {}
      
      if (service === 'elevenlabs' || service === 'cartesia') {
        amount = Number((Math.random() * 0.5 + 0.1).toFixed(3)) // 0.1 - 0.6
      } else if (service === 'openrouter' || service === 'gemini') {
        amount = Number((Math.random() * 0.2 + 0.05).toFixed(3)) // 0.05 - 0.25
        metadata.tokens_prompt = Math.floor(Math.random() * 1500) + 200
        metadata.tokens_completion = Math.floor(Math.random() * 300) + 50
      } else if (service === 'deepgram') {
        amount = Number((Math.random() * 0.1 + 0.01).toFixed(3)) // 0.01 - 0.11
        metadata.duration_seconds = Math.floor(Math.random() * 120) + 15
      } else if (service === 'plivo') {
        amount = Number((Math.random() * 0.05 + 0.01).toFixed(3)) // 0.01 - 0.06
        metadata.duration_seconds = Math.floor(Math.random() * 120) + 15
      }
      
      totalSpent += amount

      usageRecords.push({
        userId: adminUser._id,
        amount,
        description,
        type: 'usage',
        service,
        metadata,
        createdAt: getRandomDate()
      })
    }

    // Sort by date ascending to ensure logical flow
    usageRecords.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    console.log(`Inserting ${usageRecords.length} records...`)
    await CreditUsage.insertMany(usageRecords)
    
    // Update admin's credit balance
    const remainingBalance = 500 - totalSpent
    adminUser.creditBalance = Number(remainingBalance.toFixed(2))
    await adminUser.save()

    console.log(`✅ Seeding complete. Generated ${usageRecords.length} usage records.`)
    console.log(`✅ Admin remaining balance: $${adminUser.creditBalance}`)
    
  } catch (error) {
    console.error('Error seeding data:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB.')
  }
}

seedUsage()
