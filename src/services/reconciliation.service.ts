import mongoose from 'mongoose';
import { Transaction, ITransaction } from '../models/Transaction.model';
import { ReconciliationRun } from '../models/ReconciliationRun.model';
import { ReconciliationResult } from '../models/ReconciliationResult.model';
import { MatchingEngine, MatchResult } from './matching.engine';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';

export interface ReconciliationConfig {
  timestampToleranceSeconds: number;
  quantityTolerancePct: number;
}

export class ReconciliationService {
  
  /**
   * Execute full reconciliation process
   */
  static async reconcile(
    runId: string,
    config: ReconciliationConfig
  ): Promise<mongoose.Types.ObjectId> {
    logger.info(`Starting reconciliation for run: ${runId}`);
    
    // Find the run
    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      throw new AppError(`Reconciliation run ${runId} not found`, 404);
    }
    
    // Update status to RUNNING
    run.status = 'RUNNING';
    await run.save();
    
    try {
      // Get all valid transactions for this run
      const userTransactions = await Transaction.find({
        runId: run._id,
        source: 'USER',
        isValid: true
      });
      
      const exchangeTransactions = await Transaction.find({
        runId: run._id,
        source: 'EXCHANGE',
        isValid: true
      });
      
      logger.info(`Retrieved ${userTransactions.length} user transactions and ${exchangeTransactions.length} exchange transactions`);
      
      // Run matching engine
      const matchingResults = await MatchingEngine.matchTransactions(
        userTransactions,
        exchangeTransactions,
        config.timestampToleranceSeconds,
        config.quantityTolerancePct
      );
      
      // Store results in database
      await this.storeResults(run._id, matchingResults);
      
      // Update run statistics
      await this.updateRunStats(run._id, matchingResults);
      
      // Mark run as completed
      run.status = 'COMPLETED';
      run.completedAt = new Date();
      run.stats = {
        ...run.stats,
        matched: matchingResults.matches.length,
        conflicting: matchingResults.conflicts.length,
        unmatchedUser: matchingResults.unmatchedUser.length,
        unmatchedExchange: matchingResults.unmatchedExchange.length
      };
      await run.save();
      
      logger.info(`Reconciliation completed for run: ${runId}`);
      
      return run._id;
    } catch (error) {
      logger.error(`Reconciliation failed for run ${runId}:`, error);
      run.status = 'FAILED';
      run.error = error instanceof Error ? error.message : 'Unknown error';
      await run.save();
      throw error;
    }
  }
  
  /**
   * Store reconciliation results in database
   */
  private static async storeResults(
    runObjectId: mongoose.Types.ObjectId,
    results: {
      matches: MatchResult[];
      conflicts: MatchResult[];
      unmatchedUser: ITransaction[];
      unmatchedExchange: ITransaction[];
    }
  ): Promise<void> {
    const resultsToInsert = [];
    
    // Store matches
    for (const match of results.matches) {
      resultsToInsert.push({
        runId: runObjectId,
        category: 'MATCHED',
        reason: match.reason,
        userTx: match.userTx._id,
        exchangeTx: match.exchangeTx._id,
        matchScore: match.score.score,
        differences: {
          timestampDiffSec: match.score.timestampDiffSec,
          quantityDiffPct: match.score.quantityDiffPct,
          assetMatch: true,
          typeMatch: true
        }
      });
    }
    
    // Store conflicts
    for (const conflict of results.conflicts) {
      resultsToInsert.push({
        runId: runObjectId,
        category: 'CONFLICTING',
        reason: conflict.reason,
        userTx: conflict.userTx._id,
        exchangeTx: conflict.exchangeTx._id,
        matchScore: conflict.score.score,
        differences: {
          timestampDiffSec: conflict.score.timestampDiffSec,
          quantityDiffPct: conflict.score.quantityDiffPct,
          assetMatch: true,
          typeMatch: true
        }
      });
    }
    
    // Store unmatched user transactions
    for (const userTx of results.unmatchedUser) {
      let reason = 'No matching transaction found in exchange data';
      
      // Check if there are any exchange transactions with same asset/type
      const potentialMatches = await Transaction.find({
        runId: runObjectId,
        source: 'EXCHANGE',
        normalizedAsset: userTx.normalizedAsset,
        normalizedType: userTx.normalizedType,
        isValid: true
      });
      
      if (potentialMatches.length > 0) {
        reason = `No matching transaction found. Found ${potentialMatches.length} potential ${userTx.normalizedAsset} ${userTx.normalizedType} transactions but none within tolerance`;
      }
      
      resultsToInsert.push({
        runId: runObjectId,
        category: 'UNMATCHED_USER',
        reason,
        userTx: userTx._id,
        exchangeTx: null
      });
    }
    
    // Store unmatched exchange transactions
    for (const exchangeTx of results.unmatchedExchange) {
      let reason = 'No matching transaction found in user data';
      
      // Check if there are any user transactions with same asset/type
      const potentialMatches = await Transaction.find({
        runId: runObjectId,
        source: 'USER',
        normalizedAsset: exchangeTx.normalizedAsset,
        normalizedType: exchangeTx.normalizedType,
        isValid: true
      });
      
      if (potentialMatches.length > 0) {
        reason = `No matching transaction found. Found ${potentialMatches.length} potential ${exchangeTx.normalizedAsset} ${exchangeTx.normalizedType} transactions but none within tolerance`;
      }
      
      resultsToInsert.push({
        runId: runObjectId,
        category: 'UNMATCHED_EXCHANGE',
        reason,
        userTx: null,
        exchangeTx: exchangeTx._id
      });
    }
    
    // Batch insert results
    if (resultsToInsert.length > 0) {
      await ReconciliationResult.insertMany(resultsToInsert);
      logger.info(`Stored ${resultsToInsert.length} reconciliation results`);
    }
  }
  
  /**
   * Update run statistics
   */
  private static async updateRunStats(
    runObjectId: mongoose.Types.ObjectId,
    results: {
      matches: MatchResult[];
      conflicts: MatchResult[];
      unmatchedUser: ITransaction[];
      unmatchedExchange: ITransaction[];
    }
  ): Promise<void> {
    await ReconciliationRun.findByIdAndUpdate(runObjectId, {
      $set: {
        'stats.matched': results.matches.length,
        'stats.conflicting': results.conflicts.length,
        'stats.unmatchedUser': results.unmatchedUser.length,
        'stats.unmatchedExchange': results.unmatchedExchange.length
      }
    });
  }
  
  /**
   * Get reconciliation summary
   */
  static async getSummary(runId: string) {
    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      throw new AppError(`Reconciliation run ${runId} not found`, 404);
    }
    
    const results = await ReconciliationResult.aggregate([
      { $match: { runId: run._id } },
      { $group: {
        _id: '$category',
        count: { $sum: 1 }
      }}
    ]);
    
    const summary = {
      matched: 0,
      conflicting: 0,
      unmatchedUser: 0,
      unmatchedExchange: 0
    };
    
    results.forEach(result => {
      if (result._id === 'MATCHED') summary.matched = result.count;
      if (result._id === 'CONFLICTING') summary.conflicting = result.count;
      if (result._id === 'UNMATCHED_USER') summary.unmatchedUser = result.count;
      if (result._id === 'UNMATCHED_EXCHANGE') summary.unmatchedExchange = result.count;
    });
    
    return {
      runId: run.runId,
      status: run.status,
      summary,
      config: run.config,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      totalUserTransactions: run.stats.totalUserTx,
      totalExchangeTransactions: run.stats.totalExchangeTx,
      validUserTransactions: run.stats.validUserTx,
      validExchangeTransactions: run.stats.validExchangeTx
    };
  }
  
  /**
   * Get full report
   */
  static async getReport(runId: string, category?: string) {
    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      throw new AppError(`Reconciliation run ${runId} not found`, 404);
    }
    
    const matchCondition: any = { runId: run._id };
    if (category) {
      matchCondition.category = category;
    }
    
    const results = await ReconciliationResult.find(matchCondition)
      .populate('userTx')
      .populate('exchangeTx')
      .sort({ createdAt: -1 });
    
    return results.map(result => this.formatResult(result));
  }
  
  /**
   * Format result for API response
   */
  private static formatResult(result: any) {
    const formatted: any = {
      id: result._id,
      category: result.category,
      reason: result.reason,
      matchScore: result.matchScore
    };
    
    if (result.userTx) {
      formatted.userTransaction = {
        id: result.userTx.sourceId,
        timestamp: result.userTx.timestamp,
        type: result.userTx.type,
        asset: result.userTx.asset,
        quantity: result.userTx.quantity,
        priceUsd: result.userTx.priceUsd,
        fee: result.userTx.fee,
        note: result.userTx.note,
        isValid: result.userTx.isValid,
        validationErrors: result.userTx.validationErrors
      };
    }
    
    if (result.exchangeTx) {
      formatted.exchangeTransaction = {
        id: result.exchangeTx.sourceId,
        timestamp: result.exchangeTx.timestamp,
        type: result.exchangeTx.type,
        asset: result.exchangeTx.asset,
        quantity: result.exchangeTx.quantity,
        priceUsd: result.exchangeTx.priceUsd,
        fee: result.exchangeTx.fee,
        note: result.exchangeTx.note,
        isValid: result.exchangeTx.isValid,
        validationErrors: result.exchangeTx.validationErrors
      };
    }
    
    if (result.differences) {
      formatted.differences = result.differences;
    }
    
    return formatted;
  }
}