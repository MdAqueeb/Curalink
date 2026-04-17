import mongoose, { Schema, type Document } from "mongoose";

export interface ResearchCacheDoc extends Document {
  queryHash: string;
  source: string;
  results: unknown;
  expireAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const researchCacheSchema = new Schema<ResearchCacheDoc>(
  {
    queryHash: { type: String, required: true, index: true },
    source: { type: String, required: true },
    results: { type: Schema.Types.Mixed, required: true },
    expireAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

researchCacheSchema.index({ queryHash: 1, source: 1 }, { unique: true });

export const ResearchCache = mongoose.model<ResearchCacheDoc>(
  "ResearchCache",
  researchCacheSchema
);
