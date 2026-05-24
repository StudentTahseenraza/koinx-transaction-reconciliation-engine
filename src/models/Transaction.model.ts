import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  source: 'USER' | 'EXCHANGE';
  sourceId: string;
  runId?: mongoose.Types.ObjectId;
  
  // Original data
  timestamp: Date;
  rawTimestamp: string;
  type: string;
  asset: string;
  quantity: number;
  priceUsd?: number;
  fee?: number;
  note?: string;
  
  // Normalized data (for matching)
  normalizedAsset: string;
  normalizedType: string;
  
  // Validation
  isValid: boolean;
  validationErrors: string[];
  
  // Raw data storage
  rawData?: Record<string, any>; // Make this optional
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    source: {
      type: String,
      required: true,
      enum: ['USER', 'EXCHANGE'],
    },
    sourceId: {
      type: String,
      required: true,
      index: true,
    },
    runId: {
      type: Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      index: true,
    },
    
    // Original data
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    rawTimestamp: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    asset: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    priceUsd: {
      type: Number,
      required: false,
    },
    fee: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      required: false,
    },
    
    // Normalized data
    normalizedAsset: {
      type: String,
      required: true,
      index: true,
    },
    normalizedType: {
      type: String,
      required: true,
      index: true,
    },
    
    // Validation
    isValid: {
      type: Boolean,
      default: true,
      index: true,
    },
    validationErrors: [{
      type: String,
    }],
    
    // Raw data - make it optional with default
    rawData: {
      type: Schema.Types.Mixed,
      required: false,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
TransactionSchema.index({ source: 1, sourceId: 1 }, { unique: true });
TransactionSchema.index({ runId: 1, isValid: 1 });
TransactionSchema.index({ normalizedAsset: 1, normalizedType: 1, timestamp: 1 });
TransactionSchema.index({ runId: 1, source: 1, isValid: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);