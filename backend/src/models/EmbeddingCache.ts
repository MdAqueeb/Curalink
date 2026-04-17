import mongoose, { Schema, type Document } from "mongoose";

export interface EmbeddingCacheDoc extends Document {
  contentHash: string;
  modelName: string;
  vector: number[];
  expireAt: Date;
  createdAt: Date;
}

const embeddingCacheSchema = new Schema<EmbeddingCacheDoc>(
  {
    contentHash: { type: String, required: true, index: true },
    modelName: { type: String, required: true },
    vector: { type: [Number], required: true },
    expireAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

embeddingCacheSchema.index({ contentHash: 1, modelName: 1 }, { unique: true });

export const EmbeddingCache = mongoose.model<EmbeddingCacheDoc>(
  "EmbeddingCache",
  embeddingCacheSchema
);
