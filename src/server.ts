import { createApp } from './app';
import { connectDB, disconnectDB } from './config/database';
import { config } from './config/env';
import logger from './config/logger';

const app = createApp();
const PORT = config.port;
const HOST = config.host;

// Graceful shutdown handling
let server: any;

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDB();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    });
    
    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Start listening
    server = app.listen(PORT, () => {
      logger.info(`🚀 Server is running!`);
      logger.info(`   Environment: ${config.env}`);
      logger.info(`   URL: http://${HOST}:${PORT}`);
      logger.info(`   API: http://${HOST}:${PORT}${config.api.prefix}`);
      logger.info(`   Health: http://${HOST}:${PORT}/health`);
      logger.info(`📋 Press Ctrl+C to stop`);
    });
    
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
if (require.main === module) {
  startServer();
}

export { app, startServer };