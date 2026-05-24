import mongoose, { Schema, Document } from 'mongoose';

export interface IReconciliationResult extends Document {
  runId: mongoose.Types.ObjectId;
  category: 'MATCHED' | 'CONFLICTING' | 'UNMATCHED_USER' | 'UNMATCHED_EXCHANGE';
  reason: string;
  
  userTx?: mongoose.Types.ObjectId;
  exchangeTx?: mongoose.Types.ObjectId;
  
  matchScore?: number;
  differences?: {
    timestampDiffSec: number;
    quantityDiffPct: number;
    assetMatch: boolean;
    typeMatch: boolean;
    priceDiffPct?: number;
    feeDiffPct?: number;
  };
  
  createdAt: Date;
}

const ReconciliationResultSchema = new Schema<IReconciliationResult>(
  {
    runId: {
      type: Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['MATCHED', 'CONFLICTING', 'UNMATCHED_USER', 'UNMATCHED_EXCHANGE'],
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    userTx: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    exchangeTx: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    differences: {
      timestampDiffSec: Number,
      quantityDiffPct: Number,
      assetMatch: Boolean,
      typeMatch: Boolean,
      priceDiffPct: Number,
      feeDiffPct: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
ReconciliationResultSchema.index({ runId: 1, category: 1 });
ReconciliationResultSchema.index({ runId: 1, userTx: 1 });
ReconciliationResultSchema.index({ runId: 1, exchangeTx: 1 });

export const ReconciliationResult = mongoose.model<IReconciliationResult>(
  'ReconciliationResult',
  ReconciliationResultSchema
);