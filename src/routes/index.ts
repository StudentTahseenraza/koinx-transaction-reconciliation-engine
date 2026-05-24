import { Router } from 'express';
import { limiter } from '../middleware/rateLimiter.middleware';
import ingestionRoutes from './ingestion.routes';
// import reconciliationRoutes from './reconciliation.routes';
import { ReportController } from '../controllers/report.controller';
import { ReconciliationController } from '../controllers/reconciliation.controller';

const router = Router();

// Health check endpoint
router.get('/health', (_, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Root endpoint
router.get('/', (_, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Transaction Reconciliation Engine API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      dashboard: 'GET /api/dashboard',
      reconcile: 'POST /api/reconcile',
      runs: 'GET /api/reconcile/runs',
      report: 'GET /api/report/:runId',
      reportSummary: 'GET /api/report/:runId/summary',
      reportStatistics: 'GET /api/report/:runId/statistics',
      reportUnmatched: 'GET /api/report/:runId/unmatched',
      reportExport: 'GET /api/report/:runId/export/:format'
    }
  });
});

// Dashboard route
router.get('/dashboard', ReportController.getDashboard);

// Reconciliation routes
router.post('/reconcile', ReconciliationController.triggerReconciliation);
router.get('/reconcile/runs', ReconciliationController.getAllRuns);

// Report routes - Note: These must be BEFORE the generic routes
router.get('/report/:runId/summary', ReconciliationController.getSummary);
router.get('/report/:runId/statistics', ReportController.getStatistics);
router.get('/report/:runId/unmatched', ReconciliationController.getUnmatched);
router.get('/report/:runId/export/:format', ReconciliationController.exportReport);
router.get('/report/:runId', ReconciliationController.getReport);
router.get('/report/:runId/detailed', ReportController.getDetailedReport);
router.get('/report/:runId/audit/:transactionId', ReportController.getAuditTrail);
router.get('/report/compare/:runId1/:runId2', ReportController.compareRuns);

// Ingestion routes
router.use('/ingestion', ingestionRoutes);

// Apply rate limiting
router.use(limiter);

export default router;