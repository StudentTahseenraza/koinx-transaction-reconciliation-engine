import mongoose from 'mongoose';
import { config } from '../config/env';
import { Transaction } from '../models/Transaction.model';
import { ReconciliationRun } from '../models/ReconciliationRun.model';
import { logger } from '../config/logger';

const sampleUserTransactions = [
  {
    source: 'USER',
    sourceId: 'USR-001',
    timestamp: new Date('2024-03-01T09:00:00Z'),
    rawTimestamp: '2024-03-01T09:00:00Z',
    type: 'BUY',
    asset: 'BTC',
    quantity: 0.5,
    priceUsd: 62000,
    fee: 0.0005,
    note: 'Monthly DCA',
    normalizedAsset: 'BTC',
    normalizedType: 'BUY',
    isValid: true,
    validationErrors: [],
    rawData: {}
  },
  {
    source: 'USER',
    sourceId: 'USR-002',
    timestamp: new Date('2024-03-01T11:30:00Z'),
    rawTimestamp: '2024-03-01T11:30:00Z',
    type: 'BUY',
    asset: 'ETH',
    quantity: 2.0,
    priceUsd: 3400,
    fee: 0.002,
    note: '',
    normalizedAsset: 'ETH',
    normalizedType: 'BUY',
    isValid: true,
    validationErrors: [],
    rawData: {}
  }
];

const sampleExchangeTransactions = [
  {
    source: 'EXCHANGE',
    sourceId: 'EXC-1001',
    timestamp: new Date('2024-03-01T09:00:32Z'),
    rawTimestamp: '2024-03-01T09:00:32Z',
    type: 'BUY',
    asset: 'BTC',
    quantity: 0.5,
    priceUsd: 62000,
    fee: 0.0005,
    note: '',
    normalizedAsset: 'BTC',
    normalizedType: 'BUY',
    isValid: true,
    validationErrors: [],
    rawData: {}
  },
  {
    source: 'EXCHANGE',
    sourceId: 'EXC-1002',
    timestamp: new Date('2024-03-01T11:30:00Z'),
    rawTimestamp: '2024-03-01T11:30:00Z',
    type: 'BUY',
    asset: 'ETH',
    quantity: 2.0,
    priceUsd: 3400,
    fee: 0.002,
    note: '',
    normalizedAsset: 'ETH',
    normalizedType: 'BUY',
    isValid: true,
    validationErrors: [],
    rawData: {}
  }
];

export async function seedDatabase() {
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('Connected to MongoDB for seeding');
    
    // Clear existing data
    await Transaction.deleteMany({});
    await ReconciliationRun.deleteMany({});
    
    // Create a test run
    const run = new ReconciliationRun({
      runId: 'test_run_001',
      status: 'COMPLETED',
      config: {
        timestampToleranceSeconds: 300,
        quantityTolerancePct: 0.01
      },
      stats: {
        totalUserTx: 2,
        totalExchangeTx: 2,
        validUserTx: 2,
        validExchangeTx: 2,
        matched: 2,
        conflicting: 0,
        unmatchedUser: 0,
        unmatchedExchange: 0
      },
      startedAt: new Date(),
      completedAt: new Date()
    });
    
    await run.save();
    
    // Add transactions with runId
    const userTxs = sampleUserTransactions.map(tx => ({ ...tx, runId: run._id }));
    const exchangeTxs = sampleExchangeTransactions.map(tx => ({ ...tx, runId: run._id }));
    
    await Transaction.insertMany([...userTxs, ...exchangeTxs]);
    
    logger.info('Database seeded successfully');
    await mongoose.disconnect();
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run seed if called directly
if (require.main === module) {
  seedDatabase();
}