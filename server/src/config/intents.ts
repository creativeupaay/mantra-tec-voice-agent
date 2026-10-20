export interface IIntentCategory {
  id: string
  label: string
  count?: number
}

export const STANDARDIZED_INTENTS: IIntentCategory[] = [
  { id: 'Sales & Purchase', label: 'Sales & Purchase' },
  { id: 'Technical Support', label: 'Technical Support' },
  { id: 'Repair & RMA', label: 'Repair & RMA' },
  { id: 'RD Service & Recharge', label: 'RD Service & Recharge' },
  { id: 'Order & Delivery', label: 'Order & Delivery' },
  { id: 'Customer Care & Escalation', label: 'Customer Care & Escalation' },
  { id: 'General Inquiry', label: 'General Inquiry' },
  { id: 'Misdirected / Wrong Number', label: 'Misdirected / Wrong Number' },
  { id: 'Incomplete / Dropped Call', label: 'Incomplete / Dropped Call' },
]
