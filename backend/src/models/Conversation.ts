import mongoose, { Schema, type Document } from "mongoose";
import type { IntentObject, LLMResponse } from "../types/domain.js";

export interface ConversationTurn {
  turnIndex: number;
  userMessage: string;
  intentObject: IntentObject;
  retrievedSourceIds: string[];
  llmResponse: LLMResponse;
  timestamp: Date;
}

export interface ConversationDoc extends Document {
  sessionId: string;
  userId?: string;
  activeDisease?: string;
  activeConcepts: string[];
  turns: ConversationTurn[];
  createdAt: Date;
  updatedAt: Date;
}

const turnSchema = new Schema<ConversationTurn>(
  {
    turnIndex: { type: Number, required: true },
    userMessage: { type: String, required: true },
    intentObject: { type: Schema.Types.Mixed, required: true },
    retrievedSourceIds: { type: [String], default: [] },
    llmResponse: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const conversationSchema = new Schema<ConversationDoc>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    activeDisease: String,
    activeConcepts: { type: [String], default: [] },
    turns: { type: [turnSchema], default: [] },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model<ConversationDoc>("Conversation", conversationSchema);
