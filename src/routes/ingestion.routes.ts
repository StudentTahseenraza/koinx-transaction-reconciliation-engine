import { Router } from 'express';
import multer from 'multer';
import { IngestionController } from '../controllers/ingestion.controller';
import { reconciliationLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.use(reconciliationLimiter);

/**
 * @swagger
 * /api/ingestion/upload:
 *   post:
 *     summary: Upload CSV files for reconciliation
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
 *                 description: User transactions CSV file
 *               exchangeCsv:
 *                 type: string
 *                 format: binary
 *                 description: Exchange transactions CSV file
 *     responses:
 *       202:
 *         description: Files uploaded successfully
 *       400:
 *         description: Invalid files
 */
router.post(
  '/upload',
  upload.fields([
    { name: 'userCsv', maxCount: 1 },
    { name: 'exchangeCsv', maxCount: 1 }
  ]),
  IngestionController.uploadAndIngest
);

export default router;