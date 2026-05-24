import express, { Application, json, urlencoded } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './config/env';
import { stream } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import router from './routes';
import swaggerRoutes from './routes/swagger.routes';

export const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  app.use(cors({
    origin: config.env === 'production' ? process.env.CORS_ORIGIN : '*',
    credentials: true,
  }));
  
  // Body parsing middleware
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  
  // Logging middleware
  if (config.env !== 'test') {
    app.use(morgan('combined', { stream }));
  }
  
  // Swagger UI - Add this line
  app.use('/api-docs', swaggerRoutes);
  
  // Serve static files
  app.use(express.static(path.join(__dirname, 'public')));
  
  // API routes
  app.use('/api', router);
  
  // Health check endpoint
  app.get('/health', (_, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });
  
  // Root endpoint
  app.get('/', (_, res) => {
    res.json({
      name: 'Transaction Reconciliation Engine',
      version: '1.0.0',
      documentation: 'http://localhost:3000/api-docs',
      endpoints: {
        health: 'GET /health',
        apiDocs: 'GET /api-docs',
        dashboard: 'GET /api/dashboard',
        reconcile: 'POST /api/reconcile',
        runs: 'GET /api/reconcile/runs',
        report: 'GET /api/report/:runId'
      }
    });
  });
  
  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);
  
  return app;
};