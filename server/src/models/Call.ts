import mongoose, { Schema, model } from "mongoose";

export type CallStatus = "live" | "resolved" | "escalated" | "missed" | "callback_required";

export type CallCategory =
  | "support"
  | "sales"
  | "booking"
  | "inquiry"
  | "feedback"
  | "complaint"
  | "technical"
  | "billing";

// Call record schema for voice agent calls — keep in sync with python-server Call model
const callSchema = new Schema(
  {
    call_id: { type: String, required: true, unique: true }, // Plivo call UUID
    caller_name: { type: String }, // Resolved from CRM / phone lookup
    phone_number: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    duration: { type: Number }, // seconds; null/absent = in progress
    status: {
      type: String,
      enum: ["live", "resolved", "escalated", "missed", "callback_required"],
      default: "live",
    },
    is_red_flag: { type: Boolean, default: false },
    transcript: { type: String },
    call_summary: { type: String },
    detected_intent: { type: String }, // e.g. "support", "booking", "query"
    call_category: {
      type: String,
      enum: [
        "support",
        "sales",
        "booking",
        "inquiry",
        "feedback",
        "complaint",
        "technical",
        "billing",
      ],
      default: "inquiry",
    },
    call_outcome: { type: String }, // e.g. "ticket_created", "booking_made"
    recording_url: { type: String }, // URL to the recording (presigned or public)
    recording_path: { type: String }, // Storage path/key
    // Red flag fields
    is_red_flagged: { type: Boolean, default: false },
    red_flag_reason: { type: String },
    guardrail_triggered: { type: String },
  },
  { timestamps: true },
);

export interface ICall {
  _id: mongoose.Types.ObjectId | string;
  call_id: string;
  caller_name?: string;
  phone_number: string;
  timestamp: Date;
  duration?: number;
  status: CallStatus;
  is_red_flag: boolean;
  transcript?: string;
  call_summary?: string;
  detected_intent?: string;
  call_category?: CallCategory;
  call_outcome?: string;
  recording_url?: string;
  recording_path?: string;
  is_red_flagged?: boolean;
  red_flag_reason?: string;
  guardrail_triggered?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Call = model("Call", callSchema);
