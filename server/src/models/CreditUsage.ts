import mongoose, { Schema, model } from "mongoose";

const creditUsageSchema = new Schema(
  {
    call_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Call",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["usage", "purchase", "refund"],
      required: true,
    },
    service: {
      type: String,
      enum: [
        "plivo",
        "deepgram",
        "elevenlabs",
        "cartesia",
        "openrouter",
        "gemini",
        "platform",
      ],
      required: function (this: any) {
        return this.type === "usage";
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

export interface ICreditUsage {
  _id: mongoose.Types.ObjectId;
  call_id: mongoose.Types.ObjectId;
  amount: number;
  description: string;
  type: "usage" | "purchase" | "refund";
  service?:
    | "plivo"
    | "deepgram"
    | "elevenlabs"
    | "cartesia"
    | "openrouter"
    | "gemini"
    | "platform";
  metadata?: {
    duration_seconds?: number;
    duration_minutes?: number;
    tokens_prompt?: number;
    tokens_completion?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    characters?: number;
    estimated_usd?: number;
    billing_unit?: string;
    calculation?: string;
    api?: string;
    rates?: Record<string, number>;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Explicit collection name so Node + Python share the same Mongo collection.
export const CreditUsage = model("CreditUsage", creditUsageSchema, "credit_usage");
