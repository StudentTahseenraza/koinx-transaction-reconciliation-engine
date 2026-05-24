import { ITransaction } from '../models/Transaction.model';
import { logger } from '../config/logger';
import { calculatePercentageDiff, calculateTimeDiffSeconds } from '../utils/helpers';

export interface MatchScore {
  score: number;
  timestampDiffSec: number;
  quantityDiffPct: number;
  timestampScore: number;
  quantityScore: number;
  isExactMatch: boolean;
}

export interface MatchResult {
  userTx: ITransaction;
  exchangeTx: ITransaction;
  score: MatchScore;
  isMatch: boolean;
  isConflict: boolean;
  reason: string;
}

export interface MatchingConfig {
  timestampToleranceSeconds: number;
  quantityTolerancePct: number;
  exactMatchThreshold: number; // Score above this is exact match (default: 95)
  conflictThreshold: number;    // Score below this is conflict (default: 70)
}

export class MatchingEngine {
  
  private static readonly DEFAULT_CONFIG: MatchingConfig = {
    timestampToleranceSeconds: 300,
    quantityTolerancePct: 0.01,
    exactMatchThreshold: 95,
    conflictThreshold: 70
  };

  /**
   * Main matching algorithm
   * Matches user transactions with exchange transactions using scoring system
   */
  static async matchTransactions(
    userTransactions: ITransaction[],
    exchangeTransactions: ITransaction[],
    timestampTolerance: number,
    quantityTolerance: number
  ): Promise<{
    matches: MatchResult[];
    conflicts: MatchResult[];
    unmatchedUser: ITransaction[];
    unmatchedExchange: ITransaction[];
  }> {
    const startTime = Date.now();
    logger.info(`Starting matching engine: ${userTransactions.length} user txs vs ${exchangeTransactions.length} exchange txs`);
    logger.info(`Tolerance: timestamp=${timestampTolerance}s, quantity=${quantityTolerance}%`);

    const config: MatchingConfig = {
      ...this.DEFAULT_CONFIG,
      timestampToleranceSeconds: timestampTolerance,
      quantityTolerancePct: quantityTolerance
    };

    const matches: MatchResult[] = [];
    const conflicts: MatchResult[] = [];
    const unmatchedUser: ITransaction[] = [];
    
    // Track matched exchange transactions to avoid double matching
    const matchedExchangeIds = new Set<string>();
    
    // Sort user transactions by timestamp for better matching
    const sortedUserTxs = [...userTransactions].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    // Group exchange transactions by asset and type for faster lookup
    const exchangeIndex = this.buildExchangeIndex(exchangeTransactions);
    
    // Match each user transaction
    for (const userTx of sortedUserTxs) {
      const candidates = this.findCandidates(userTx, exchangeIndex, config);
      
      if (candidates.length === 0) {
        // No candidates found
        unmatchedUser.push(userTx);
        continue;
      }
      
      // Calculate scores for all candidates
      const scoredCandidates = this.scoreCandidates(userTx, candidates, config);
      
      // Sort by score descending
      scoredCandidates.sort((a, b) => b.score.score - a.score.score);
      
      const bestCandidate = scoredCandidates[0];
      
      // Check if best candidate is already matched
      if (matchedExchangeIds.has(bestCandidate.exchangeTx._id.toString())) {
        // This exchange transaction is already matched, find next best
        let foundUnmatched = false;
        for (const candidate of scoredCandidates) {
          if (!matchedExchangeIds.has(candidate.exchangeTx._id.toString())) {
            bestCandidate.score = candidate.score;
            foundUnmatched = true;
            break;
          }
        }
        if (!foundUnmatched) {
          unmatchedUser.push(userTx);
          continue;
        }
      }
      
      // Categorize based on score
      if (bestCandidate.score.score >= config.exactMatchThreshold) {
        // Exact match
        matches.push(bestCandidate);
        matchedExchangeIds.add(bestCandidate.exchangeTx._id.toString());
        logger.debug(`Match found: ${userTx.sourceId} ↔ ${bestCandidate.exchangeTx.sourceId} (score: ${bestCandidate.score.score})`);
      } 
      else if (bestCandidate.score.score >= config.conflictThreshold) {
        // Conflict - close but not perfect
        bestCandidate.isConflict = true;
        conflicts.push(bestCandidate);
        matchedExchangeIds.add(bestCandidate.exchangeTx._id.toString());
        logger.debug(`Conflict detected: ${userTx.sourceId} ↔ ${bestCandidate.exchangeTx.sourceId} (score: ${bestCandidate.score.score})`);
      }
      else {
        // Score too low, treat as unmatched
        unmatchedUser.push(userTx);
      }
    }
    
    // Find unmatched exchange transactions
    const unmatchedExchange = exchangeTransactions.filter(
      tx => !matchedExchangeIds.has(tx._id.toString())
    );
    
    const duration = Date.now() - startTime;
    logger.info(`Matching completed in ${duration}ms: Matched=${matches.length}, Conflicts=${conflicts.length}, Unmatched User=${unmatchedUser.length}, Unmatched Exchange=${unmatchedExchange.length}`);
    
    return {
      matches,
      conflicts,
      unmatchedUser,
      unmatchedExchange
    };
  }

  /**
   * Build index for fast candidate lookup
   */
  private static buildExchangeIndex(
    exchangeTransactions: ITransaction[]
  ): Map<string, ITransaction[]> {
    const index = new Map<string, ITransaction[]>();
    
    for (const tx of exchangeTransactions) {
      const key = `${tx.normalizedAsset}_${tx.normalizedType}`;
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key)!.push(tx);
    }
    
    return index;
  }

  /**
   * Find candidate exchange transactions for a user transaction
   */
  private static findCandidates(
    userTx: ITransaction,
    exchangeIndex: Map<string, ITransaction[]>,
    config: MatchingConfig
  ): ITransaction[] {
    const key = `${userTx.normalizedAsset}_${userTx.normalizedType}`;
    const candidates = exchangeIndex.get(key) || [];
    
    // Filter by timestamp tolerance
    const userTimestamp = userTx.timestamp.getTime();
    const toleranceMs = config.timestampToleranceSeconds * 1000;
    
    return candidates.filter(candidate => {
      const candidateTimestamp = candidate.timestamp.getTime();
      const timeDiff = Math.abs(userTimestamp - candidateTimestamp);
      return timeDiff <= toleranceMs;
    });
  }

  /**
   * Score candidates based on multiple factors
   */
  private static scoreCandidates(
    userTx: ITransaction,
    candidates: ITransaction[],
    config: MatchingConfig
  ): MatchResult[] {
    const results: MatchResult[] = [];
    
    for (const exchangeTx of candidates) {
      const score = this.calculateMatchScore(userTx, exchangeTx, config);
      
      const isMatch = score.score >= config.exactMatchThreshold;
      const isConflict = score.score >= config.conflictThreshold && score.score < config.exactMatchThreshold;
      
      let reason = '';
      if (isMatch) {
        reason = this.generateMatchReason(score);
      } else if (isConflict) {
        reason = this.generateConflictReason(score, config);
      } else {
        reason = this.generateLowScoreReason(score, config);
      }
      
      results.push({
        userTx,
        exchangeTx,
        score,
        isMatch,
        isConflict,
        reason
      });
    }
    
    return results;
  }

  /**
   * Calculate detailed match score between two transactions
   */
  private static calculateMatchScore(
    userTx: ITransaction,
    exchangeTx: ITransaction,
    config: MatchingConfig
  ): MatchScore {
    // Calculate timestamp difference
    const timestampDiffSec = calculateTimeDiffSeconds(userTx.timestamp, exchangeTx.timestamp);
    const timestampScore = this.calculateTimestampScore(timestampDiffSec, config.timestampToleranceSeconds);
    
    // Calculate quantity difference
    const quantityDiffPct = calculatePercentageDiff(userTx.quantity, exchangeTx.quantity);
    const quantityScore = this.calculateQuantityScore(quantityDiffPct, config.quantityTolerancePct);
    
    // Calculate price difference if both have prices
    let priceScore = 100;
    if (userTx.priceUsd && exchangeTx.priceUsd && userTx.priceUsd > 0 && exchangeTx.priceUsd > 0) {
      const priceDiffPct = calculatePercentageDiff(userTx.priceUsd, exchangeTx.priceUsd);
      priceScore = Math.max(0, 100 - (priceDiffPct * 2));
    }
    
    // Calculate fee difference if both have fees
    let feeScore = 100;
    if (userTx.fee && exchangeTx.fee && (userTx.fee > 0 || exchangeTx.fee > 0)) {
      const feeDiffPct = calculatePercentageDiff(userTx.fee, exchangeTx.fee);
      feeScore = Math.max(0, 100 - (feeDiffPct * 1.5));
    }
    
    // Weighted scoring
    // Timestamp: 40%, Quantity: 40%, Price: 10%, Fee: 10%
    const totalScore = (timestampScore * 0.4) + 
                       (quantityScore * 0.4) + 
                       (priceScore * 0.1) + 
                       (feeScore * 0.1);
    
    // Check if it's an exact match (within tolerance)
    const isExactMatch = timestampDiffSec <= config.timestampToleranceSeconds * 0.1 && 
                         quantityDiffPct <= config.quantityTolerancePct * 0.5;
    
    return {
      score: Math.round(totalScore * 100) / 100,
      timestampDiffSec,
      quantityDiffPct,
      timestampScore,
      quantityScore,
      isExactMatch
    };
  }

  /**
   * Calculate timestamp score (0-100)
   */
  private static calculateTimestampScore(diffSeconds: number, toleranceSeconds: number): number {
    if (diffSeconds <= 0) return 100;
    if (diffSeconds >= toleranceSeconds) return 0;
    
    // Exponential decay: score decreases faster as difference increases
    const ratio = diffSeconds / toleranceSeconds;
    const score = 100 * Math.exp(-ratio * 3);
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate quantity score (0-100)
   */
  private static calculateQuantityScore(diffPct: number, tolerancePct: number): number {
    if (diffPct <= 0) return 100;
    if (diffPct >= tolerancePct * 2) return 0;
    
    // Linear decay with tolerance as threshold
    const ratio = diffPct / tolerancePct;
    const score = 100 * Math.max(0, 1 - ratio);
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate human-readable reason for match
   */
  private static generateMatchReason(score: MatchScore): string {
    const reasons = [];
    
    if (score.timestampDiffSec === 0) {
      reasons.push(`Perfect timestamp match`);
    } else if (score.timestampDiffSec <= 5) {
      reasons.push(`Timestamp difference: ${score.timestampDiffSec.toFixed(1)}s (within 5s)`);
    } else {
      reasons.push(`Timestamp difference: ${score.timestampDiffSec.toFixed(1)}s`);
    }
    
    if (score.quantityDiffPct === 0) {
      reasons.push(`Perfect quantity match`);
    } else if (score.quantityDiffPct <= 0.001) {
      reasons.push(`Quantity difference: ${score.quantityDiffPct.toFixed(4)}% (negligible)`);
    } else {
      reasons.push(`Quantity difference: ${score.quantityDiffPct.toFixed(3)}%`);
    }
    
    if (score.score >= 99) {
      reasons.unshift(`Excellent match (score: ${score.score})`);
    } else {
      reasons.unshift(`Good match (score: ${score.score})`);
    }
    
    return reasons.join('. ');
  }

  /**
   * Generate reason for conflict
   */
  private static generateConflictReason(score: MatchScore, config: MatchingConfig): string {
    const issues = [];
    
    if (score.timestampDiffSec > config.timestampToleranceSeconds * 0.8) {
      issues.push(`Timestamp difference (${score.timestampDiffSec.toFixed(1)}s) exceeds recommended tolerance`);
    }
    
    if (score.quantityDiffPct > config.quantityTolerancePct * 0.8) {
      issues.push(`Quantity difference (${score.quantityDiffPct.toFixed(3)}%) exceeds recommended tolerance`);
    }
    
    if (issues.length === 0) {
      issues.push(`Minor discrepancies detected`);
    }
    
    return `CONFLICT: ${issues.join(', ')} (score: ${score.score})`;
  }

  /**
   * Generate reason for low score
   */
  private static generateLowScoreReason(score: MatchScore, config: MatchingConfig): string {
    const reasons = [];
    
    if (score.timestampDiffSec > config.timestampToleranceSeconds) {
      reasons.push(`Timestamp difference (${score.timestampDiffSec.toFixed(1)}s) exceeds tolerance (${config.timestampToleranceSeconds}s)`);
    }
    
    if (score.quantityDiffPct > config.quantityTolerancePct) {
      reasons.push(`Quantity difference (${score.quantityDiffPct.toFixed(3)}%) exceeds tolerance (${config.quantityTolerancePct}%)`);
    }
    
    if (reasons.length === 0) {
      reasons.push(`Overall match score (${score.score}) below threshold (${config.exactMatchThreshold})`);
    }
    
    return `LOW SCORE: ${reasons.join(', ')}`;
  }

  /**
   * Fuzzy matching for transactions with slight asset name variations
   */
  static fuzzyMatchByAsset(
    userTx: ITransaction,
    exchangeTxs: ITransaction[]
  ): ITransaction | null {
    const userAsset = userTx.normalizedAsset;
    
    // First try exact match
    let exactMatch = exchangeTxs.find(tx => tx.normalizedAsset === userAsset);
    if (exactMatch) return exactMatch;
    
    // Try fuzzy matching for similar assets
    const fuzzyMatches = exchangeTxs.filter(tx => {
      const exchangeAsset = tx.normalizedAsset;
      // Check if assets are in the same category (e.g., BTC and WBTC)
      if (userAsset.includes('BTC') && exchangeAsset.includes('BTC')) return true;
      if (userAsset.includes('ETH') && exchangeAsset.includes('ETH')) return true;
      if (userAsset.includes('SOL') && exchangeAsset.includes('SOL')) return true;
      return false;
    });
    
    if (fuzzyMatches.length === 1) {
      logger.debug(`Fuzzy matched asset: ${userAsset} -> ${fuzzyMatches[0].normalizedAsset}`);
      return fuzzyMatches[0];
    }
    
    return null;
  }
}