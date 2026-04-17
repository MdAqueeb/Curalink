import mongoose, { Schema, type Document } from "mongoose";
import type { QueryType } from "../types/domain.js";

export interface QueryHistoryItem {
  disease: string;
  concept: string;
  queryType: QueryType;
  timestamp: Date;
}

export interface UserProfileDoc extends Document {
  userId: string;
  queryHistory: QueryHistoryItem[];
  preferredDiseases: string[];
  preferredQueryTypes: QueryType[];
  responseDepth: "brief" | "standard" | "deep";
  createdAt: Date;
  updatedAt: Date;
}

const userProfileSchema = new Schema<UserProfileDoc>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    queryHistory: {
      type: [
        new Schema<QueryHistoryItem>(
          {
            disease: String,
            concept: String,
            queryType: String,
            timestamp: { type: Date, default: () => new Date() },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    preferredDiseases: { type: [String], default: [] },
    preferredQueryTypes: { type: [String], default: [] },
    responseDepth: { type: String, enum: ["brief", "standard", "deep"], default: "standard" },
  },
  { timestamps: true }
);

export const UserProfile = mongoose.model<UserProfileDoc>("UserProfile", userProfileSchema);
