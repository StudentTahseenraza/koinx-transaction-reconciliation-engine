import mongoose, { Schema, Document } from 'mongoose';

export interface IReconciliationRun extends Document {
  runId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  config: {
    timestampToleranceSeconds: number;
    quantityTolerancePct: number;
  };
  stats: {
    totalUserTx: number;
    totalExchangeTx: number;
    validUserTx: number;
    validExchangeTx: number;
    matched: number;
    conflicting: number;
    unmatchedUser: number;
    unmatchedExchange: number;
  };
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

const ReconciliationRunSchema = new Schema<IReconciliationRun>(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
    config: {
      timestampToleranceSeconds: {
        type: Number,
        required: true,
        default: 300,
      },
      quantityTolerancePct: {
        type: Number,
        required: true,
        default: 0.01,
      },
    },
    stats: {
      totalUserTx: {
        type: Number,
        default: 0,
      },
      totalExchangeTx: {
        type: Number,
        default: 0,
      },
      validUserTx: {
        type: Number,
        default: 0,
      },
      validExchangeTx: {
        type: Number,
        default: 0,
      },
      matched: {
        type: Number,
        default: 0,
      },
      conflicting: {
        type: Number,
        default: 0,
      },
      unmatchedUser: {
        type: Number,
        default: 0,
      },
      unmatchedExchange: {
        type: Number,
        default: 0,
      },
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for querying runs
ReconciliationRunSchema.index({ status: 1, startedAt: -1 });
ReconciliationRunSchema.index({ completedAt: 1 });

export const ReconciliationRun = mongoose.model<IReconciliationRun>(
  'ReconciliationRun',
  ReconciliationRunSchema
);