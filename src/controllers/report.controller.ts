import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { ReportService } from '../services/report.service';
import { ReconciliationService } from '../services/reconciliation.service';
import { ReconciliationRun } from '../models/ReconciliationRun.model'; // Add missing import
import json2csv from 'json2csv';

export class ReportController {
  
  /**
   * Get detailed report with filters
   * GET /api/report/:runId/detailed
   */
  static getDetailedReport = catchAsync(async (req: Request, res: Response) => {
    const { runId } = req.params;
    const {
      category,
      startDate,
      endDate,
      asset,
      minMatchScore,
      maxMatchScore,
      page = 1,
      limit = 50
    } = req.query;
    
    const filters = {
      category: category as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      asset: asset as string,
      minMatchScore: minMatchScore ? Number(minMatchScore) : undefined,
      maxMatchScore: maxMatchScore ? Number(maxMatchScore) : undefined
    };
    
    const report = await ReportService.getDetailedReport(
      runId,
      filters,
      Number(page),
      Number(limit)
    );
    
    res.status(200).json({
      status: 'success',
      data: report
    });
  });
  
  /**
   * Get statistics
   * GET /api/report/:runId/statistics
   */
  static getStatistics = catchAsync(async (req: Request, res: Response) => {
    const { runId } = req.params;
    
    const statistics = await ReportService.getStatistics(runId);
    
    res.status(200).json({
      status: 'success',
      data: statistics
    });
  });
  
  /**
   * Get audit trail for a transaction
   * GET /api/report/:runId/audit/:transactionId
   */
  static getAuditTrail = catchAsync(async (req: Request, res: Response) => {
    const { runId, transactionId } = req.params;
    
    const auditTrail = await ReportService.getAuditTrail(runId, transactionId);
    
    res.status(200).json({
      status: 'success',
      data: auditTrail
    });
  });
  
  /**
   * Compare two reconciliation runs
   * GET /api/report/compare/:runId1/:runId2
   */
  static compareRuns = catchAsync(async (req: Request, res: Response) => {
    const { runId1, runId2 } = req.params;
    
    const comparison = await ReportService.compareRuns(runId1, runId2);
    
    res.status(200).json({
      status: 'success',
      data: comparison
    });
  });
  
  /**
   * Export report in multiple formats
   * GET /api/report/:runId/export/:format
   */
  static exportReport = catchAsync(async (req: Request, res: Response) => {
    const { runId, format } = req.params;
    const { category } = req.query;
    
    const report = await ReconciliationService.getReport(runId, category as string);
    
    if (format === 'json') {
      return res.status(200).json({
        status: 'success',
        data: report
      });
    } else if (format === 'csv') {
      const csvFields = [
        'category',
        'reason',
        'userTransaction.id',
        'userTransaction.timestamp',
        'userTransaction.asset',
        'userTransaction.type',
        'userTransaction.quantity',
        'userTransaction.priceUsd',
        'userTransaction.totalValue',
        'exchangeTransaction.id',
        'exchangeTransaction.timestamp',
        'exchangeTransaction.asset',
        'exchangeTransaction.type',
        'exchangeTransaction.quantity',
        'exchangeTransaction.priceUsd',
        'exchangeTransaction.totalValue',
        'matchScore',
        'differences.timestampDifference.seconds',
        'differences.quantityDifference.percentage'
      ];
      
      const parser = new json2csv.Parser({ fields: csvFields, defaultValue: 'N/A' });
      const csv = parser.parse(report);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=report_${runId}.${format}`);
      return res.status(200).send(csv);
    } else {
      throw new AppError('Format not supported. Use json or csv', 400);
    }
  });
  
  /**
   * Get dashboard data
   * GET /api/dashboard
   */
  static getDashboard = catchAsync(async (_req: Request, res: Response) => {
    // Get latest run
    const latestRun = await ReconciliationRun.findOne()
      .sort({ startedAt: -1 })
      .limit(1);
    
    if (!latestRun) {
      return res.status(200).json({
        status: 'success',
        data: {
          message: 'No reconciliation runs found'
        }
      });
    }
    
    // Get statistics for latest run
    const statistics = await ReportService.getStatistics(latestRun.runId);
    
    // Get recent runs
    const recentRuns = await ReconciliationRun.find()
      .sort({ startedAt: -1 })
      .limit(10)
      .select('runId status stats config startedAt completedAt');
    
    // Get top discrepancies
    const topDiscrepancies = await ReconciliationService.getReport(latestRun.runId, 'CONFLICTING');
    const topConflicts = topDiscrepancies.slice(0, 5);
    
    return res.status(200).json({
      status: 'success',
      data: {
        latestRun: {
          runId: latestRun.runId,
          status: latestRun.status,
          completedAt: latestRun.completedAt,
          statistics
        },
        recentRuns,
        topConflicts: topConflicts.map((conflict: any) => ({
          userTransactionId: conflict.userTransaction?.id,
          exchangeTransactionId: conflict.exchangeTransaction?.id,
          reason: conflict.reason,
          matchScore: conflict.matchScore
        }))
      }
    });
  });
}