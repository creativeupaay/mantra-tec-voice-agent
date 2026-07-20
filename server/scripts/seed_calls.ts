import mongoose from 'mongoose'
import { config } from 'dotenv'
import { resolve } from 'path'
import { Call } from '../src/models/Call'

// Load env
config({ path: resolve(__dirname, '../.env') })

const MOCK_CALLS = [
  {
    call_id: 'call_7f3a2b1c',
    caller_name: 'Arjun Mehta',
    phone_number: '+91 98765 43210',
    duration: undefined,
    status: 'live',
    is_red_flag: false,
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    detected_intent: 'Billing Inquiry',
    call_summary: 'Customer is currently on call inquiring about their latest invoice.',
    transcript: 'Agent: Hello, thank you for calling. How can I help you today?\nCustomer: Hi, I wanted to ask about my recent invoice...',
  },
  {
    call_id: 'call_9d4e5f6a',
    caller_name: 'Priya Sharma',
    phone_number: '+91 87654 32109',
    duration: 342,
    status: 'escalated',
    is_red_flag: true,
    timestamp: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    detected_intent: 'Product Complaint',
    call_summary: 'Customer reported a critical issue with their account being charged twice. Expressed frustration and requested immediate resolution. Escalated to billing team after agent was unable to process refund.',
    call_outcome: 'escalated_to_human',
    transcript: "Agent: Good afternoon! How may I assist you?\nCustomer: I have been charged twice this month and nobody is helping me!\nAgent: I understand your frustration. Let me pull up your account...\nCustomer: This is unacceptable. I want to speak to a manager.\nAgent: Of course, I'm escalating this right now.",
  },
  {
    call_id: 'call_2c8b9e0d',
    caller_name: 'Rohan Verma',
    phone_number: '+91 76543 21098',
    duration: 127,
    status: 'resolved',
    is_red_flag: false,
    timestamp: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
    detected_intent: 'Technical Support',
    call_summary: 'Customer had trouble logging into the portal. Agent guided them through a password reset successfully. Issue resolved in under 3 minutes.',
    call_outcome: 'issue_resolved',
    transcript: "Agent: Hi there! What can I help you with?\nCustomer: I can't seem to log in to my account.\nAgent: No worries! Let me walk you through the reset process...\nCustomer: Got it, that worked! Thank you.",
  },
  {
    call_id: 'call_1a5c7d3e',
    caller_name: 'Sneha Patel',
    phone_number: '+91 65432 10987',
    duration: 89,
    status: 'missed',
    is_red_flag: true,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    detected_intent: 'Cancellation Request',
    call_summary: 'Customer called regarding subscription cancellation. Call dropped before agent could resolve the issue. Follow-up required.',
    call_outcome: 'callback_required',
    transcript: 'Agent: Hello, thank you for calling support.\nCustomer: I want to cancel my subscription—\n[Call dropped]',
  },
  {
    call_id: 'call_6e2f8g4h',
    caller_name: 'Vikram Singh',
    phone_number: '+91 54321 09876',
    duration: 521,
    status: 'resolved',
    is_red_flag: false,
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    detected_intent: 'Account Upgrade',
    call_summary: 'Customer inquired about upgrading their plan from Basic to Pro. Agent explained all features and pricing. Customer agreed to upgrade. Account updated successfully.',
    call_outcome: 'upsell_completed',
    transcript: "Agent: Thank you for calling! How can I assist?\nCustomer: I'd like to know more about your Pro plan.\nAgent: Absolutely! The Pro plan includes...\nCustomer: That sounds great. Can we switch now?\nAgent: Of course, I'll process that for you right away.",
  },
  {
    call_id: 'call_3h7i9j5k',
    caller_name: 'Ananya Gupta',
    phone_number: '+91 43210 98765',
    duration: 203,
    status: 'escalated',
    is_red_flag: false,
    timestamp: new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString(),
    detected_intent: 'Refund Request',
    call_summary: 'Customer requested a refund for a service that was not delivered as promised. Agent escalated to finance team for approval. Customer was informed of 3-5 business day timeline.',
    call_outcome: 'escalated_to_human',
    transcript: "Customer: I never received the service I paid for.\nAgent: I sincerely apologize for this. Let me look into your order.\nAgent: I can see the issue here. I'll need to escalate this to our finance team...",
  },
  {
    call_id: 'call_0k4l6m2n',
    caller_name: 'Kiran Nair',
    phone_number: '+91 32109 87654',
    duration: 68,
    status: 'missed',
    is_red_flag: false,
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    detected_intent: 'General Inquiry',
    call_summary: 'Short call for general business hours inquiry. Customer requested callback during morning hours.',
    call_outcome: 'callback_required',
    transcript: "Customer: What are your business hours?\nAgent: We're available from 9 AM to 6 PM, Monday through Saturday.\nCustomer: Okay, I'll call back in the morning.",
  },
  {
    call_id: 'call_5n8o1p7q',
    caller_name: 'Deepak Joshi',
    phone_number: '+91 21098 76543',
    duration: 418,
    status: 'resolved',
    is_red_flag: true,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    detected_intent: 'Data Privacy Concern',
    call_summary: 'Customer raised serious concerns about data privacy and how their information is being used. Agent explained the privacy policy in detail. Customer was not fully satisfied and requested written confirmation — flagged for follow-up.',
    call_outcome: 'pending_followup',
    transcript: "Customer: I want to know exactly what data you're storing about me.\nAgent: I understand your concern. According to our privacy policy...\nCustomer: That's not good enough. I want this in writing.\nAgent: Of course, I'll have our privacy team send you a detailed breakdown.",
  },
]

const seedDB = async () => {
  try {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('MONGODB_URI not found')

    console.log('Connecting to MongoDB...')
    await mongoose.connect(uri)
    console.log('Connected.')

    console.log('Clearing existing calls...')
    await Call.deleteMany({})

    console.log('Inserting mock calls...')
    await Call.insertMany(MOCK_CALLS)
    console.log('Inserted successfully.')

    process.exit(0)
  } catch (error) {
    console.error('Error seeding data:', error)
    process.exit(1)
  }
}

seedDB()
