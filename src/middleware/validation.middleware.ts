import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validate = (schema: AnyZodObject) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          status: 'fail',
          message: 'Validation failed',
          errors,
        });

        return;
      }

      next(error);
    }
  };
};

// Validation schema for reconciliation request
export const reconcileRequestSchema = {
  body: {
    timestampToleranceSeconds: (value: number) => {
      if (value && (value < 0 || value > 3600)) {
        throw new Error('Timestamp tolerance must be between 0 and 3600 seconds');
      }
      return true;
    },
    quantityTolerancePct: (value: number) => {
      if (value && (value < 0 || value > 100)) {
        throw new Error('Quantity tolerance must be between 0 and 100 percent');
      }
      return true;
    },
  },
};