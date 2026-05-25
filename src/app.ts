import express, {
  Application,
  json,
  urlencoded
} from 'express';

import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import { config } from './config/env';

import { stream } from './config/logger';

import {
  errorHandler,
  notFoundHandler
} from './middleware/errorHandler.middleware';

import router from './routes';

import swaggerRoutes from './routes/swagger.routes';

const SERVER_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.API_URL ||
      'https://koinx-transaction-reconciliation-engine.onrender.com'
    : `http://localhost:${process.env.PORT || 3000}`;

export const createApp = (): Application => {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );

  app.use(
    cors({
      origin: '*',
      credentials: true
    })
  );

  app.use(
    json({
      limit: '10mb'
    })
  );

  app.use(
    urlencoded({
      extended: true,
      limit: '10mb'
    })
  );

  if (config.env !== 'test') {
    app.use(
      morgan('combined', {
        stream
      })
    );
  }

  app.use('/api-docs', swaggerRoutes);

  app.use(
    express.static(
      path.join(__dirname, 'public')
    )
  );

  app.use('/api', router);

  app.get('/health', (_, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  app.get('/', (_, res) => {
    res.json({
      name: 'Transaction Reconciliation Engine',

      version: '1.0.0',

      documentation:
        `${SERVER_URL}/api-docs`,

      endpoints: {
        health: '/health',

        apiDocs: '/api-docs',

        dashboard: '/api/dashboard',

        reconcile: '/api/reconcile',

        runs: '/api/reconcile/runs',

        report: '/api/report/:runId'
      }
    });
  });

  app.use(notFoundHandler);

  app.use(errorHandler);

  return app;
};