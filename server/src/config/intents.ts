export interface IIntentCategory {
  id: string
  label: string
  count?: number
  regexPattern?: string
}

export const STANDARDIZED_INTENTS: IIntentCategory[] = [
  {
    id: 'Sales & Purchase',
    label: 'Sales & Purchase',
    regexPattern: '(sales|purchase|buy|kharidna|procure|order\\s*(placement|device|unit|new)|bulk|wholesale|quotation|quote|pricing|rate|rfq|attendance|aebas|mbas|face|dealer|distributor)',
  },
  {
    id: 'Technical Support',
    label: 'Technical Support',
    regexPattern: '(technical|tech|support\\s*for\\s*device|not\\s*working|malfunction|chal\\s*nahi|kaam\\s*nahi|defective|hardware|light\\s*not|light\\s*nahi|scan|fingerprint|error|troubleshoot|driver|install|setup|connect|connectivity|usb|\\bport\\b|otg|detect|offline|lock|unlock)',
  },
  {
    id: 'Repair & RMA',
    label: 'Repair & RMA',
    regexPattern: '(repair|rma|service\\s*center|service\\s*ticket|challan|marammat|replacement|return|warranty)',
  },
  {
    id: 'RD Service & Recharge',
    label: 'RD Service & Recharge',
    regexPattern: '(rd\\s*service|renew|subscription|plan\\s*renewal|recharge|payment\\s*deducted|validity|white\\s*list)',
  },
  {
    id: 'Order & Delivery',
    label: 'Order & Delivery',
    regexPattern: '(delivery|dispatch|courier|tracking|order\\s*status|awb|shipment|shipped|consignment|delay|late|parcel)',
  },
  {
    id: 'Customer Care & Escalation',
    label: 'Customer Care & Escalation',
    regexPattern: '(helpline|customer\\s*care|executive|agent\\s*number|callback|call\\s*back|complaint|escalat|grievance|unresolved|billing)',
  },
  {
    id: 'General Inquiry',
    label: 'General Inquiry',
    regexPattern: '(inquiry|enquiry|information|general|contact|unknown|other|none|^$)',
  },
  {
    id: 'Misdirected / Wrong Number',
    label: 'Misdirected / Wrong Number',
    regexPattern: '(myntra|clothes|dress|fashion|e-commerce|shopping|kurti|shoes|wrong\\s*number|misdial|wrong\\s*call|galti\\s*se)',
  },
  {
    id: 'Incomplete / Dropped Call',
    label: 'Incomplete / Dropped Call',
    regexPattern: '(incomplete|dropped|disconnected|hung\\s*up|cut\\s*call|abandoned|silent|blank|no\\s*voice|no\\s*audio|silence|ivr|robocall)',
  },
]
