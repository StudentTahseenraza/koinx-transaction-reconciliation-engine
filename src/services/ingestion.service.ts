import mongoose from 'mongoose';
import { Transaction, ITransaction } from '../models/Transaction.model';
import { ReconciliationRun } from '../models/ReconciliationRun.model';
import { CSVParserService } from './csvParser.service';
import { ValidationService, ValidationResult } from './validation.service';
import { logger } from '../config/logger';
// import { AppError } from '../utils/AppError';

import { ReconciliationService } from './reconciliation.service';


export interface IngestionResult {
  runId: mongoose.Types.ObjectId;
  userTransactions: ITransaction[];
  exchangeTransactions: ITransaction[];
  userInvalid: ValidationResult[];
  exchangeInvalid: ValidationResult[];
  stats: {
    userTotal: number;
    userValid: number;
    userInvalid: number;
    exchangeTotal: number;
    exchangeValid: number;
    exchangeInvalid: number;
  };
}

export class IngestionService {
  
  /**
   * Ingest both CSV files and store in database
   */
  static async ingestCSVs(
    userCsvBuffer: Buffer,
    exchangeCsvBuffer: Buffer,
    runId: mongoose.Types.ObjectId
  ): Promise<IngestionResult> {
    logger.info(`Starting CSV ingestion for run: ${runId}`);
    
    // Parse CSV files
    const [userParsed, exchangeParsed] = await Promise.all([
      CSVParserService.parseBuffer(userCsvBuffer),
      CSVParserService.parseBuffer(exchangeCsvBuffer)
    ]);
    
    logger.info(`Parsed user CSV: ${userParsed.rows.length} rows, ${userParsed.errors.length} errors`);
    logger.info(`Parsed exchange CSV: ${exchangeParsed.rows.length} rows, ${exchangeParsed.errors.length} errors`);
    
    // Log parsing errors
    if (userParsed.errors.length > 0) {
      logger.warn(`User CSV parsing errors: ${userParsed.errors.length}`);
      userParsed.errors.slice(0, 5).forEach(err => {
        logger.warn(`  Row ${err.rowNumber}: ${err.error}`);
      });
    }
    
    if (exchangeParsed.errors.length > 0) {
      logger.warn(`Exchange CSV parsing errors: ${exchangeParsed.errors.length}`);
      exchangeParsed.errors.slice(0, 5).forEach(err => {
        logger.warn(`  Row ${err.rowNumber}: ${err.error}`);
      });
    }
    
    // Validate transactions
    const userValidation = ValidationService.validateDataset(userParsed.rows, 'USER');
    const exchangeValidation = ValidationService.validateDataset(exchangeParsed.rows, 'EXCHANGE');
    
    // Store valid transactions in database
    const userTransactions = await this.storeTransactions(
      userValidation.validRows,
      'USER',
      runId
    );
    
    const exchangeTransactions = await this.storeTransactions(
      exchangeValidation.validRows,
      'EXCHANGE',
      runId
    );
    
    // Store invalid transactions as well (for reporting)
    await this.storeInvalidTransactions(
      userValidation.invalidRows,
      exchangeValidation.invalidRows,
      runId
    );
    
    const result: IngestionResult = {
      runId,
      userTransactions,
      exchangeTransactions,
      userInvalid: userValidation.invalidRows,
      exchangeInvalid: exchangeValidation.invalidRows,
      stats: {
        userTotal: userParsed.rows.length,
        userValid: userValidation.stats.valid,
        userInvalid: userValidation.stats.invalid,
        exchangeTotal: exchangeParsed.rows.length,
        exchangeValid: exchangeValidation.stats.valid,
        exchangeInvalid: exchangeValidation.stats.invalid
      }
    };
    
    // Update run with ingestion stats
    await ReconciliationRun.findByIdAndUpdate(runId, {
      $set: {
        'stats.totalUserTx': result.stats.userTotal,
        'stats.totalExchangeTx': result.stats.exchangeTotal,
        'stats.validUserTx': result.stats.userValid,
        'stats.validExchangeTx': result.stats.exchangeValid
      }
    });
    
    logger.info(`CSV ingestion completed: User valid=${userTransactions.length}, Exchange valid=${exchangeTransactions.length}`);
    
    return result;
  }
  
  /**
 * Store valid transactions in database
 */
private static async storeTransactions(
  validRows: ValidationResult[],
  source: 'USER' | 'EXCHANGE',
  runId: mongoose.Types.ObjectId
): Promise<ITransaction[]> {
  const transactions: ITransaction[] = [];
  
  for (const row of validRows) {
    const data = row.validatedData;
    
    const transaction = new Transaction({
      source,
      sourceId: data.transactionId,
      runId,
      timestamp: data.timestamp,
      rawTimestamp: data.rawTimestamp,
      type: data.type,
      asset: data.asset,
      quantity: data.quantity,
      priceUsd: data.priceUsd,
      fee: data.fee,
      note: data.note,
      normalizedAsset: data.normalizedAsset,
      normalizedType: data.normalizedType,
      isValid: true,
      validationErrors: [],
      rawData: {  // Add this to satisfy the schema
        transactionId: data.transactionId,
        timestamp: data.rawTimestamp,
        type: data.type,
        asset: data.asset,
        quantity: data.quantity,
        priceUsd: data.priceUsd,
        fee: data.fee,
        note: data.note
      }
    });
    
    try {
      const saved = await transaction.save();
      transactions.push(saved);
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate key error
        logger.warn(`Duplicate transaction: ${source} - ${data.transactionId}`);
        // Update existing transaction with new runId? Or skip?
        const existing = await Transaction.findOne({ source, sourceId: data.transactionId });
        if (existing) {
          existing.runId = runId;
          await existing.save();
          transactions.push(existing);
        }
      } else {
        logger.error(`Error saving transaction:`, error);
        throw error;
      }
    }
  }
  
  return transactions;
}

/**
 * Store invalid transactions for tracking
 */
private static async storeInvalidTransactions(
  userInvalid: ValidationResult[],
  exchangeInvalid: ValidationResult[],
  runId: mongoose.Types.ObjectId
): Promise<void> {
  const allInvalid = [
    ...userInvalid.map(r => ({ ...r, source: 'USER' as const })),
    ...exchangeInvalid.map(r => ({ ...r, source: 'EXCHANGE' as const }))
  ];
  
  for (const invalid of allInvalid) {
    const data = invalid.validatedData;
    
    const transaction = new Transaction({
      source: invalid.source,
      sourceId: data.transactionId,
      runId,
      timestamp: data.timestamp,
      rawTimestamp: data.rawTimestamp,
      type: data.type,
      asset: data.asset,
      quantity: data.quantity,
      priceUsd: data.priceUsd,
      fee: data.fee,
      note: data.note,
      normalizedAsset: data.normalizedAsset,
      normalizedType: data.normalizedType,
      isValid: false,
      validationErrors: invalid.errors,
      rawData: {  // Add this to satisfy the schema
        transactionId: data.transactionId,
        timestamp: data.rawTimestamp,
        type: data.type,
        asset: data.asset,
        quantity: data.quantity,
        priceUsd: data.priceUsd,
        fee: data.fee,
        note: data.note
      }
    });
    
    try {
      await transaction.save();
    } catch (error) {
      logger.error(`Error saving invalid transaction:`, error);
    }
  }
  
  logger.info(`Stored ${allInvalid.length} invalid transactions`);
}

// Add this method at the end of the IngestionService class
static async triggerReconciliation(runId: string, config: any) {
  logger.info(`Triggering reconciliation for run: ${runId}`);
  await ReconciliationService.reconcile(runId, config);
}

}

