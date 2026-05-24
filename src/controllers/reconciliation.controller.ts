import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { ReconciliationService } from '../services/reconciliation.service';
import { ReconciliationRun } from '../models/ReconciliationRun.model';
import { config } from '../config/env';
import { generateRunId } from '../utils/helpers';
import { logger } from '../config/logger';

export class ReconciliationController {
  
  /**
   * Trigger reconciliation run
   * POST /api/reconcile
   */
  static triggerReconciliation = catchAsync(async (req: Request, res: Response) => {
    const {
      timestampToleranceSeconds,
      quantityTolerancePct
    } = req.body;
    
    // Validate tolerance values
    const toleranceTimestamp = timestampToleranceSeconds || config.reconciliation.timestampToleranceSeconds;
    const toleranceQuantity = quantityTolerancePct || config.reconciliation.quantityTolerancePct;
    
    if (toleranceTimestamp < 0 || toleranceTimestamp > 3600) {
      throw new AppError('Timestamp tolerance must be between 0 and 3600 seconds', 400);
    }
    
    if (toleranceQuantity < 0 || toleranceQuantity > 100) {
      throw new AppError('Quantity tolerance must be between 0 and 100 percent', 400);
    }
    
    // Create new reconciliation run
    const runId = generateRunId();
    const reconciliationRun = new ReconciliationRun({
      runId,
      status: 'PENDING',
      config: {
        timestampToleranceSeconds: toleranceTimestamp,
        quantityTolerancePct: toleranceQuantity
      },
      startedAt: new Date()
    });
    
    await reconciliationRun.save();
    
    // Start reconciliation asynchronously
    // Note: In production, this should be a background job
    this.processReconciliationAsync(runId, {
      timestampToleranceSeconds: toleranceTimestamp,
      quantityTolerancePct: toleranceQuantity
    }).catch(error => {
      logger.error(`Async reconciliation failed for ${runId}:`, error);
    });
    
    res.status(202).json({
      status: 'success',
      message: 'Reconciliation started',
      data: {
        runId,
        status: 'PENDING',
        config: reconciliationRun.config
      }
    });
  });
  
  /**
   * Process reconciliation asynchronously
   */
  private static async processReconciliationAsync(
    runId: string,
    config: { timestampToleranceSeconds: number; quantityTolerancePct: number }
  ) {
    logger.info(`Processing reconciliation ${runId} asynchronously`);
    
    try {
      // Find the run
      const run = await ReconciliationRun.findOne({ runId });
      if (!run) {
        throw new Error(`Run ${runId} not found`);
      }
      
      // Execute reconciliation
      await ReconciliationService.reconcile(runId, config);
      
      logger.info(`Reconciliation ${runId} completed successfully`);
    } catch (error) {
      logger.error(`Reconciliation ${runId} failed:`, error);
      
      // Update run status to failed
      await ReconciliationRun.findOneAndUpdate(
        { runId },
        {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date()
        }
      );
    }
  }
  
  /**
   * Get reconciliation report
   * GET /api/report/:runId
   */
  static getReport = catchAsync(async (req: Request, res: Response) => {
    const { runId } = req.params;
    const { category } = req.query;
    
    const report = await ReconciliationService.getReport(runId, category as string);
    
    res.status(200).json({
      status: 'success',
      data: {
        runId,
        totalResults: report.length,
        results: report
      }
    });
  });
  
  /**
   * Get reconciliation summary
   * GET /api/report/:runId/summary
   */
  static getSummary = catchAsync(async (req: Request, res: Response) => {
    const { runId } = req.params;
    
    const summary = await ReconciliationService.getSummary(runId);
    
    res.status(200).json({
      status: 'success',
      data: summary
    });
  });
  
  /**
   * Get unmatched transactions only
   * GET /api/report/:runId/unmatched
   */
  static getUnmatched = catchAsync(async (req: Request, res: Response) => {
    const { runId } = req.params;
    
    const unmatchedUser = await ReconciliationService.getReport(runId, 'UNMATCHED_USER');
    const unmatchedExchange = await ReconciliationService.getReport(runId, 'UNMATCHED_EXCHANGE');
    
    res.status(200).json({
      status: 'success',
      data: {
        runId,
        unmatchedUser: {
          count: unmatchedUser.length,
          transactions: unmatchedUser
        },
        unmatchedExchange: {
          count: unmatchedExchange.length,
          transactions: unmatchedExchange
        }
      }
    });
  });
  
  /**
   * Export report as CSV
   * GET /api/report/:runId/export
   */
  static exportReport = catchAsync(async (req: Request, res: Response) => {
    const { runId } = req.params;
    
    const report = await ReconciliationService.getReport(runId);
    
    // Generate CSV
    const csvRows = [
      ['Category', 'Reason', 'User Transaction ID', 'User Timestamp', 'User Asset', 'User Type', 'User Quantity', 'Exchange Transaction ID', 'Exchange Timestamp', 'Exchange Asset', 'Exchange Type', 'Exchange Quantity', 'Match Score', 'Timestamp Diff (s)', 'Quantity Diff (%)']
    ];
    
    for (const result of report) {
      csvRows.push([
        result.category,
        result.reason,
        result.userTransaction?.id || 'N/A',
        result.userTransaction?.timestamp || 'N/A',
        result.userTransaction?.asset || 'N/A',
        result.userTransaction?.type || 'N/A',
        result.userTransaction?.quantity?.toString() || 'N/A',
        result.exchangeTransaction?.id || 'N/A',
        result.exchangeTransaction?.timestamp || 'N/A',
        result.exchangeTransaction?.asset || 'N/A',
        result.exchangeTransaction?.type || 'N/A',
        result.exchangeTransaction?.quantity?.toString() || 'N/A',
        result.matchScore?.toString() || 'N/A',
        result.differences?.timestampDiffSec?.toFixed(2) || 'N/A',
        result.differences?.quantityDiffPct?.toFixed(4) || 'N/A'
      ]);
    }
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=reconciliation_report_${runId}.csv`);
    res.status(200).send(csvContent);
  });
  
  /**
   * Get all reconciliation runs
   * GET /api/runs
   */
  static getAllRuns = catchAsync(async (req: Request, res: Response) => {
    const { limit = 50, offset = 0 } = req.query;
    
    const runs = await ReconciliationRun.find()
      .sort({ startedAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .select('runId status stats config startedAt completedAt error');
    
    const total = await ReconciliationRun.countDocuments();
    
    res.status(200).json({
      status: 'success',
      data: {
        runs,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset)
        }
      }
    });
  });
}