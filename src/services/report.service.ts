import { ReconciliationResult } from '../models/ReconciliationResult.model';
import { ReconciliationRun } from '../models/ReconciliationRun.model';
import { Transaction, ITransaction } from '../models/Transaction.model';
import { AppError } from '../utils/AppError';

export interface ReportFilters {
  category?: string;
  startDate?: Date;
  endDate?: Date;
  asset?: string;
  minMatchScore?: number;
  maxMatchScore?: number;
}

export interface ReportStatistics {
  total: number;
  byCategory: {
    matched: number;
    conflicting: number;
    unmatchedUser: number;
    unmatchedExchange: number;
  };
  byAsset: Record<string, number>;
  averageMatchScore: number;
  totalValueMatched: number;
  totalFees: {
    user: number;
    exchange: number;
    difference: number;
  };
}

// Interface for populated reconciliation result
interface PopulatedReconciliationResult {
  _id: any;
  category: string;
  reason: string;
  matchScore?: number;
  createdAt: Date;
  differences?: {
    timestampDiffSec: number;
    quantityDiffPct: number;
    priceDiffPct?: number;
    feeDiffPct?: number;
  };
  userTx: ITransaction | null;
  exchangeTx: ITransaction | null;
}

export class ReportService {
  
  /**
   * Get detailed report with filters
   */
  static async getDetailedReport(
    runId: string,
    filters: ReportFilters = {},
    page: number = 1,
    limit: number = 50
  ) {
    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      throw new AppError(`Reconciliation run ${runId} not found`, 404);
    }
    
    const matchCondition: any = { runId: run._id };
    
    // Apply filters
    if (filters.category) {
      matchCondition.category = filters.category;
    }
    
    if (filters.asset) {
      // Find transactions with this asset
      const transactions = await Transaction.find({
        runId: run._id,
        normalizedAsset: filters.asset.toUpperCase()
      }).select('_id');
      
      const txIds = transactions.map(t => t._id);
      matchCondition.$or = [
        { userTx: { $in: txIds } },
        { exchangeTx: { $in: txIds } }
      ];
    }
    
    if (filters.minMatchScore) {
      matchCondition.matchScore = { $gte: filters.minMatchScore };
    }
    
    if (filters.maxMatchScore) {
      matchCondition.matchScore = { 
        ...matchCondition.matchScore,
        $lte: filters.maxMatchScore 
      };
    }
    
    // Get paginated results
    const skip = (page - 1) * limit;
    
    const [results, total] = await Promise.all([
      ReconciliationResult.find(matchCondition)
        .populate('userTx')
        .populate('exchangeTx')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance and plain objects
      ReconciliationResult.countDocuments(matchCondition)
    ]);
    
    // Format results with type assertion
    const formattedResults = (results as any[]).map(result => 
      this.formatDetailedResult(result as PopulatedReconciliationResult)
    );
    
    return {
      runId: run.runId,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      results: formattedResults
    };
  }
  
  /**
   * Get comprehensive statistics
   */
  static async getStatistics(runId: string): Promise<ReportStatistics> {
    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      throw new AppError(`Reconciliation run ${runId} not found`, 404);
    }
    
    // Get all results with populated fields
    const results = await ReconciliationResult.find({ runId: run._id })
      .populate('userTx')
      .populate('exchangeTx')
      .lean();
    
    // Calculate statistics
    const byCategory = {
      matched: 0,
      conflicting: 0,
      unmatchedUser: 0,
      unmatchedExchange: 0
    };
    
    const byAsset: Record<string, number> = {};
    let totalMatchScore = 0;
    let matchScoreCount = 0;
    let totalValueMatched = 0;
    let totalUserFees = 0;
    let totalExchangeFees = 0;
    
    for (const result of results as any[]) {
      // Count by category
      const categoryKey = result.category.toLowerCase();
      if (categoryKey === 'matched') byCategory.matched++;
      else if (categoryKey === 'conflicting') byCategory.conflicting++;
      else if (categoryKey === 'unmatched_user') byCategory.unmatchedUser++;
      else if (categoryKey === 'unmatched_exchange') byCategory.unmatchedExchange++;
      
      // Track assets
      let asset = 'UNKNOWN';
      if (result.userTx && result.userTx.normalizedAsset) {
        asset = result.userTx.normalizedAsset;
      } else if (result.exchangeTx && result.exchangeTx.normalizedAsset) {
        asset = result.exchangeTx.normalizedAsset;
      }
      byAsset[asset] = (byAsset[asset] || 0) + 1;
      
      // Track match scores
      if (result.matchScore) {
        totalMatchScore += result.matchScore;
        matchScoreCount++;
      }
      
      // Track value for matched transactions
      if (result.category === 'MATCHED' && result.userTx && result.exchangeTx) {
        const value = (result.userTx.quantity || 0) * (result.userTx.priceUsd || 0);
        totalValueMatched += value;
      }
      
      // Track fees
      if (result.userTx && result.userTx.fee) {
        totalUserFees += result.userTx.fee;
      }
      if (result.exchangeTx && result.exchangeTx.fee) {
        totalExchangeFees += result.exchangeTx.fee;
      }
    }
    
    return {
      total: results.length,
      byCategory,
      byAsset,
      averageMatchScore: matchScoreCount > 0 ? totalMatchScore / matchScoreCount : 0,
      totalValueMatched,
      totalFees: {
        user: totalUserFees,
        exchange: totalExchangeFees,
        difference: Math.abs(totalUserFees - totalExchangeFees)
      }
    };
  }
  
  /**
   * Generate audit trail for a transaction
   */
  static async getAuditTrail(runId: string, transactionId: string) {
    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      throw new AppError(`Reconciliation run ${runId} not found`, 404);
    }
    
    // Find transaction in both sources
    const userTx = await Transaction.findOne({
      runId: run._id,
      source: 'USER',
      sourceId: transactionId
    }).lean();
    
    const exchangeTx = await Transaction.findOne({
      runId: run._id,
      source: 'EXCHANGE',
      sourceId: transactionId
    }).lean();
    
    if (!userTx && !exchangeTx) {
      throw new AppError(`Transaction ${transactionId} not found in this run`, 404);
    }
    
    // Find reconciliation result
    let result = null;
    if (userTx) {
      result = await ReconciliationResult.findOne({ runId: run._id, userTx: userTx._id })
        .populate('userTx')
        .populate('exchangeTx')
        .lean();
    } else if (exchangeTx) {
      result = await ReconciliationResult.findOne({ runId: run._id, exchangeTx: exchangeTx._id })
        .populate('userTx')
        .populate('exchangeTx')
        .lean();
    }
    
    // Build audit trail
    const auditTrail = {
      transactionId,
      runId: run.runId,
      reconciliationDate: run.completedAt,
      status: result?.category || 'NOT_PROCESSED',
      reason: result?.reason || 'Transaction not processed in this run',
      userData: userTx ? {
        id: userTx.sourceId,
        timestamp: userTx.timestamp,
        type: userTx.type,
        asset: userTx.asset,
        quantity: userTx.quantity,
        priceUsd: userTx.priceUsd,
        fee: userTx.fee,
        isValid: userTx.isValid,
        validationErrors: userTx.validationErrors
      } : null,
      exchangeData: exchangeTx ? {
        id: exchangeTx.sourceId,
        timestamp: exchangeTx.timestamp,
        type: exchangeTx.type,
        asset: exchangeTx.asset,
        quantity: exchangeTx.quantity,
        priceUsd: exchangeTx.priceUsd,
        fee: exchangeTx.fee,
        isValid: exchangeTx.isValid,
        validationErrors: exchangeTx.validationErrors
      } : null,
      matchDetails: result?.differences ? {
        score: result.matchScore,
        timestampDifference: (result.differences as any).timestampDiffSec,
        quantityDifference: (result.differences as any).quantityDiffPct,
        priceDifference: (result.differences as any).priceDiffPct,
        feeDifference: (result.differences as any).feeDiffPct
      } : null
    };
    
    return auditTrail;
  }
  
  /**
   * Generate comparison report between two runs
   */
  static async compareRuns(runId1: string, runId2: string) {
    const [run1, run2] = await Promise.all([
      ReconciliationRun.findOne({ runId: runId1 }),
      ReconciliationRun.findOne({ runId: runId2 })
    ]);
    
    if (!run1 || !run2) {
      throw new AppError('One or both runs not found', 404);
    }
    
    const stats1 = await this.getStatistics(runId1);
    const stats2 = await this.getStatistics(runId2);
    
    // Avoid division by zero
    const total1 = stats1.total || 1;
    const total2 = stats2.total || 1;
    
    return {
      run1: {
        runId: runId1,
        completedAt: run1.completedAt,
        config: run1.config,
        statistics: stats1
      },
      run2: {
        runId: runId2,
        completedAt: run2.completedAt,
        config: run2.config,
        statistics: stats2
      },
      comparison: {
        matchRateChange: ((stats2.byCategory.matched / total2) * 100) - ((stats1.byCategory.matched / total1) * 100),
        conflictRateChange: ((stats2.byCategory.conflicting / total2) * 100) - ((stats1.byCategory.conflicting / total1) * 100),
        unmatchedUserChange: stats2.byCategory.unmatchedUser - stats1.byCategory.unmatchedUser,
        unmatchedExchangeChange: stats2.byCategory.unmatchedExchange - stats1.byCategory.unmatchedExchange,
        averageScoreChange: stats2.averageMatchScore - stats1.averageMatchScore
      }
    };
  }
  
  /**
   * Format result for detailed response
   */
  private static formatDetailedResult(result: PopulatedReconciliationResult) {
    const formatted: any = {
      id: result._id,
      category: result.category,
      reason: result.reason,
      matchScore: result.matchScore,
      createdAt: result.createdAt
    };
    
    if (result.userTx) {
      formatted.userTransaction = {
        id: result.userTx.sourceId,
        timestamp: result.userTx.timestamp,
        type: result.userTx.type,
        normalizedType: result.userTx.normalizedType,
        asset: result.userTx.asset,
        normalizedAsset: result.userTx.normalizedAsset,
        quantity: result.userTx.quantity,
        priceUsd: result.userTx.priceUsd,
        fee: result.userTx.fee,
        totalValue: (result.userTx.quantity || 0) * (result.userTx.priceUsd || 0),
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
        normalizedType: result.exchangeTx.normalizedType,
        asset: result.exchangeTx.asset,
        normalizedAsset: result.exchangeTx.normalizedAsset,
        quantity: result.exchangeTx.quantity,
        priceUsd: result.exchangeTx.priceUsd,
        fee: result.exchangeTx.fee,
        totalValue: (result.exchangeTx.quantity || 0) * (result.exchangeTx.priceUsd || 0),
        note: result.exchangeTx.note,
        isValid: result.exchangeTx.isValid,
        validationErrors: result.exchangeTx.validationErrors
      };
    }
    
    if (result.differences) {
      formatted.differences = {
        timestampDifference: {
          seconds: result.differences.timestampDiffSec,
          tolerance: result.differences.timestampDiffSec <= 300 ? 'Within tolerance' : 'Exceeds tolerance'
        },
        quantityDifference: {
          percentage: result.differences.quantityDiffPct,
          tolerance: result.differences.quantityDiffPct <= 0.01 ? 'Within tolerance' : 'Exceeds tolerance'
        },
        priceDifference: result.differences.priceDiffPct,
        feeDifference: result.differences.feeDiffPct
      };
    }
    
    return formatted;
  }
}