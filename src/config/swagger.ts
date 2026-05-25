import swaggerJsdoc from 'swagger-jsdoc';

const SERVER_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.API_URL ||
      'https://koinx-transaction-reconciliation-engine.onrender.com'
    : `http://localhost:${process.env.PORT || 3000}`;

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',

    info: {
      title: 'Transaction Reconciliation Engine API',

      version: '1.0.0',

      description:
        'API for reconciling crypto transactions between user and exchange data',

      contact: {
        name: 'API Support',
        email: 'support@reconciliation.com'
      }
    },

    servers: [
      {
        url: SERVER_URL,
        description:
          process.env.NODE_ENV === 'production'
            ? 'Production Server'
            : 'Development Server'
      }
    ],

    components: {
      schemas: {
        ReconciliationRun: {
          type: 'object',

          properties: {
            runId: {
              type: 'string',
              example: 'run_1734567890123_abc123'
            },

            status: {
              type: 'string',

              enum: [
                'PENDING',
                'RUNNING',
                'COMPLETED',
                'FAILED'
              ]
            },

            config: {
              type: 'object',

              properties: {
                timestampToleranceSeconds: {
                  type: 'number',
                  example: 300
                },

                quantityTolerancePct: {
                  type: 'number',
                  example: 0.01
                }
              }
            }
          }
        },

        Error: {
          type: 'object',

          properties: {
            status: {
              type: 'string'
            },

            message: {
              type: 'string'
            }
          }
        }
      }
    }
  },

  apis: ['./src/routes/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);