import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Transaction Reconciliation Engine API',
      version: '1.0.0',
      description: 'API for reconciling crypto transactions between user and exchange data',
      contact: {
        name: 'API Support',
        email: 'support@reconciliation.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        ReconciliationRun: {
          type: 'object',
          properties: {
            runId: { type: 'string', example: 'run_1734567890123_abc123' },
            status: { type: 'string', enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] },
            config: {
              type: 'object',
              properties: {
                timestampToleranceSeconds: { type: 'number', example: 300 },
                quantityTolerancePct: { type: 'number', example: 0.01 }
              }
            },
            stats: {
              type: 'object',
              properties: {
                totalUserTx: { type: 'number' },
                totalExchangeTx: { type: 'number' },
                validUserTx: { type: 'number' },
                validExchangeTx: { type: 'number' },
                matched: { type: 'number' },
                conflicting: { type: 'number' },
                unmatchedUser: { type: 'number' },
                unmatchedExchange: { type: 'number' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);