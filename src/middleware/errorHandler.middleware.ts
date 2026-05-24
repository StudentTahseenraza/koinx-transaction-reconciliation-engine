import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import logger from '../config/logger';
import { config } from '../config/env';

interface ErrorResponse {
  status: string;
  message: string;
  stack?: string;
  errors?: any[];
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _: NextFunction
) => {
  let error = err;

  // Log error
  logger.error({
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Handle known operational errors
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      status: error.status,
      message: error.message,
    };

    if (config.env === 'development' && error.stack) {
      response.stack = error.stack;
    }

    return res.status(error.statusCode).json(response);
  }

  // Handle Mongoose validation errors
  if (error.name === 'ValidationError') {
    const response: ErrorResponse = {
      status: 'fail',
      message: 'Validation Error',
      errors: Object.values((error as any).errors).map((e: any) => e.message),
    };
    return res.status(400).json(response);
  }

  // Handle Mongoose duplicate key errors
  if ((error as any).code === 11000) {
    const response: ErrorResponse = {
      status: 'fail',
      message: 'Duplicate field value entered',
    };
    return res.status(400).json(response);
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    const response: ErrorResponse = {
      status: 'fail',
      message: 'Invalid token. Please log in again.',
    };
    return res.status(401).json(response);
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    status: 'error',
    message: config.env === 'production' ? 'Something went wrong!' : error.message,
  };

  if (config.env === 'development' && error.stack) {
    response.stack = error.stack;
  }

  return res.status(500).json(response);
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, _: Response, next: NextFunction) => {
  const error = new AppError(`Cannot find ${req.originalUrl} on this server!`, 404);
  next(error);
};