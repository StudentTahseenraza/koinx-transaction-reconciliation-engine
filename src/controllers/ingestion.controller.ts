import { Request, Response } from 'express';
import multer from 'multer';
import { IngestionService } from '../services/ingestion.service';
import { ReconciliationService } from '../services/reconciliation.service';
import { ReconciliationRun } from '../models/ReconciliationRun.model';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { generateRunId } from '../utils/helpers';
import { logger } from '../config/logger';
import { config } from '../config/env';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSizeMB * 1024 * 1024,
  },
  fileFilter: (_, file, cb) => {
    const allowedTypes: readonly string[] =
      config.upload.allowedTypes;

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          'Invalid file type. Only CSV files are allowed.',
          400
        )
      );
    }
  },
});

export const uploadMiddleware = upload.fields([
  { name: 'userCsv', maxCount: 1 },
  { name: 'exchangeCsv', maxCount: 1 },
]);

export class IngestionController {

  static uploadAndIngest = catchAsync(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.userCsv || !files.exchangeCsv) {
      throw new AppError('Both userCsv and exchangeCsv files are required', 400);
    }

    const userCsvBuffer = files.userCsv[0].buffer;
    const exchangeCsvBuffer = files.exchangeCsv[0].buffer;

    const runId_str = generateRunId();
    const reconciliationRun = new ReconciliationRun({
      runId: runId_str,
      status: 'PENDING',
      config: {
        timestampToleranceSeconds: req.body.timestampToleranceSeconds || config.reconciliation.timestampToleranceSeconds,
        quantityTolerancePct: req.body.quantityTolerancePct || config.reconciliation.quantityTolerancePct,
      },
      startedAt: new Date(),
    });

    await reconciliationRun.save();

    logger.info(`Starting ingestion for run: ${runId_str}`);

    await ReconciliationRun.findByIdAndUpdate(reconciliationRun._id, {
      status: 'INGESTING'
    });

    try {
      const ingestionResult = await IngestionService.ingestCSVs(
        userCsvBuffer,
        exchangeCsvBuffer,
        reconciliationRun._id
      );

      await ReconciliationRun.findByIdAndUpdate(reconciliationRun._id, {
        'stats.totalUserTx': ingestionResult.stats.userTotal,
        'stats.totalExchangeTx': ingestionResult.stats.exchangeTotal,
        'stats.validUserTx': ingestionResult.stats.userValid,
        'stats.validExchangeTx': ingestionResult.stats.exchangeValid,
      });

      logger.info(`Ingestion completed for run: ${runId_str}`);

      // IMPORTANT: Send response first, then trigger reconciliation
      res.status(202).json({
        status: 'success',
        message: 'CSV files uploaded and ingestion completed',
        data: {
          runId: runId_str,
          status: 'RECONCILING',
          ingestionStats: ingestionResult.stats,
        },
      });

      // Trigger reconciliation asynchronously
      logger.info(`Triggering reconciliation for run: ${runId_str}`);

      // Update status to reconciling
      await ReconciliationRun.findByIdAndUpdate(reconciliationRun._id, {
        status: 'RECONCILING'
      });

      // Run reconciliation
      await ReconciliationService.reconcile(runId_str, {
        timestampToleranceSeconds: reconciliationRun.config.timestampToleranceSeconds,
        quantityTolerancePct: reconciliationRun.config.quantityTolerancePct
      });

      logger.info(`Reconciliation completed for run: ${runId_str}`);

    } catch (error) {
      logger.error(`Ingestion/reconciliation failed for run ${runId_str}:`, error);
      await ReconciliationRun.findByIdAndUpdate(reconciliationRun._id, {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      if (!res.headersSent) {
        throw error;
      }
    }
  });

  static getIngestionStatus = catchAsync(async (req: Request, res: Response) => {
    const { runId } = req.params;

    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      throw new AppError(`Reconciliation run ${runId} not found`, 404);
    }

    res.status(200).json({
      status: 'success',
      data: {
        runId: run.runId,
        status: run.status,
        stats: run.stats,
        config: run.config,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        error: run.error,
      },
    });
  });
}