import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { Notification } from '../src/models/Notification.js'
import { User } from '../src/models/User.js'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI!

const seedNotifications = async () => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)

    const admin = await User.findOne({ role: 'admin' })
    const superAdmin = await User.findOne({ role: 'super_admin' })

    const notifications = [
      {
        userId: admin?._id || superAdmin?._id,
        title: 'Red Flag Alert Detected',
        message: 'Caller inquired about restricted API keys during call with +919876543210.',
        category: 'call',
        severity: 'error',
        read: false,
        link: '/calls',
        createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
      },
      {
        userId: admin?._id || superAdmin?._id,
        title: 'Call Escalated to Support',
        message: 'High priority issue reported by Rajesh Kumar requires human agent review.',
        category: 'call',
        severity: 'warning',
        read: false,
        link: '/analytics',
        createdAt: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      },
      {
        userId: admin?._id || superAdmin?._id,
        title: 'Credit Balance Low Warning',
        message: 'Your remaining account credits are below 100 units. Please recharge to avoid service interruption.',
        category: 'credit',
        severity: 'warning',
        read: false,
        link: '/usage',
        createdAt: new Date(Date.now() - 1000 * 60 * 360), // 6 hours ago
      },
      {
        title: 'System Maintenance Scheduled',
        message: 'Voice Agent pipeline v2.4 upgrade is scheduled for Sunday at 02:00 UTC.',
        category: 'system',
        severity: 'info',
        read: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      },
      {
        userId: admin?._id || superAdmin?._id,
        title: 'Zoho Ticket #4892 Created',
        message: 'Auto-created support ticket for BioNIC Xtreme FX terminal demo request.',
        category: 'ticket',
        severity: 'success',
        read: true,
        link: '/calls',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36), // 1.5 days ago
      },
    ]

    await Notification.deleteMany({})
    await Notification.insertMany(notifications)

    console.log(`✅ Successfully seeded ${notifications.length} generic notifications.`)
  } catch (error) {
    console.error('Seeding error:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected.')
  }
}

seedNotifications()
