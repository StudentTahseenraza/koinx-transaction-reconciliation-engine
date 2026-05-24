import { Router } from 'express';
import { ReconciliationController } from '../controllers/reconciliation.controller';
import { ReportController } from '../controllers/report.controller';
import { reconciliationLimiter } from '../middleware/rateLimiter.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

/**
 * @swagger
 * /api/reconcile:
 *   post:
 *     summary: Trigger a new reconciliation run
 *     tags: [Reconciliation]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timestampToleranceSeconds:
 *                 type: integer
 *                 default: 300
 *                 minimum: 0
 *                 maximum: 3600
 *               quantityTolerancePct:
 *                 type: number
 *                 default: 0.01
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       202:
 *         description: Reconciliation started
 *       400:
 *         description: Invalid parameters
 */
const reconcileSchema = z.object({
  body: z.object({
    timestampToleranceSeconds: z.number().min(0).max(3600).optional(),
    quantityTolerancePct: z.number().min(0).max(100).optional(),
    userCsvPath: z.string().optional(),
    exchangeCsvPath: z.string().optional()
  })
});

router.use(reconciliationLimiter);

router.post('/', validate(reconcileSchema), ReconciliationController.triggerReconciliation);

/**
 * @swagger
 * /api/reconcile/runs:
 *   get:
 *     summary: Get all reconciliation runs
 *     tags: [Reconciliation]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of runs
 */
router.get('/runs', ReconciliationController.getAllRuns);

/**
 * @swagger
 * /api/report/{runId}/summary:
 *   get:
 *     summary: Get reconciliation summary
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Summary retrieved
 *       404:
 *         description: Run not found
 */
router.get('/report/:runId/summary', ReconciliationController.getSummary);

/**
 * @swagger
 * /api/report/{runId}:
 *   get:
 *     summary: Get full reconciliation report
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [MATCHED, CONFLICTING, UNMATCHED_USER, UNMATCHED_EXCHANGE]
 *     responses:
 *       200:
 *         description: Report retrieved
 */
router.get('/report/:runId', ReconciliationController.getReport);

/**
 * @swagger
 * /api/report/{runId}/statistics:
 *   get:
 *     summary: Get comprehensive statistics
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statistics retrieved
 */
router.get('/report/:runId/statistics', ReportController.getStatistics);

/**
 * @swagger
 * /api/report/{runId}/unmatched:
 *   get:
 *     summary: Get unmatched transactions
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Unmatched transactions retrieved
 */
router.get('/report/:runId/unmatched', ReconciliationController.getUnmatched);

/**
 * @swagger
 * /api/report/{runId}/export/{format}:
 *   get:
 *     summary: Export report
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *     responses:
 *       200:
 *         description: Report exported
 */
router.get('/report/:runId/export/:format', ReconciliationController.exportReport);

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Get dashboard data
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard data retrieved
 */
router.get('/dashboard', ReportController.getDashboard);

/**
 * @swagger
 * /api/ingestion/upload:
 *   post:
 *     summary: Upload CSV files
 *     tags: [Ingestion]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               userCsv:
 *                 type: string
 *                 format: binary
 *               exchangeCsv:
 *                 type: string
 *                 format: binary
 *     responses:
 *       202:
 *         description: Files uploaded
 *       400:
 *         description: Invalid files
 */
router.post('/ingestion/upload', ReconciliationController.triggerReconciliation); // Adjust as needed

export default router;