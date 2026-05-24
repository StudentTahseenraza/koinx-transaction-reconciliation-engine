import fs from 'fs';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { logger } from '../config/logger';
import { ValidationError } from '../utils/AppError';

export interface CSVRawRow {
  transaction_id: string;
  timestamp: string;
  type: string;
  asset: string;
  quantity: string;
  price_usd: string;
  fee: string;
  note: string;
}

export interface ParsedCSVResult {
  rows: CSVRawRow[];
  errors: Array<{ rowNumber: number; error: string; row: any }>;
  totalRows: number;
}

export class CSVParserService {
  private static readonly REQUIRED_COLUMNS = [
    'transaction_id',
    'timestamp',
    'type',
    'asset',
    'quantity'
  ];

  /**
   * Parse CSV file from disk
   */
  static async parseFile(filePath: string): Promise<ParsedCSVResult> {
    const results: CSVRawRow[] = [];
    const errors: Array<{ rowNumber: number; error: string; row: any }> = [];
    let rowNumber = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => {
          rowNumber++;
          try {
            // Validate required columns
            const missingColumns = this.validateColumns(data);
            if (missingColumns.length > 0) {
              errors.push({
                rowNumber,
                error: `Missing required columns: ${missingColumns.join(', ')}`,
                row: data
              });
              return;
            }

            // Transform and validate row
            const transformedRow = this.transformRow(data, rowNumber);
            if (transformedRow.errors.length > 0) {
              errors.push({
                rowNumber,
                error: transformedRow.errors.join('; '),
                row: data
              });
            } else {
              results.push(transformedRow.row);
            }
          } catch (error) {
            errors.push({
              rowNumber,
              error: error instanceof Error ? error.message : 'Unknown parsing error',
              row: data
            });
          }
        })
        .on('end', () => {
          logger.info(`CSV parsing completed: ${results.length} valid rows, ${errors.length} errors`);
          resolve({ rows: results, errors, totalRows: rowNumber });
        })
        .on('error', (error) => {
          logger.error('CSV parsing error:', error);
          reject(new ValidationError(`Failed to parse CSV: ${error.message}`));
        });
    });
  }

  /**
   * Parse CSV from buffer (uploaded file)
   */
  static async parseBuffer(buffer: Buffer): Promise<ParsedCSVResult> {
    const results: CSVRawRow[] = [];
    const errors: Array<{ rowNumber: number; error: string; row: any }> = [];
    let rowNumber = 0;

    return new Promise((resolve, reject) => {
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);

      readable
        .pipe(csv())
        .on('data', (data: any) => {
          rowNumber++;
          try {
            const missingColumns = this.validateColumns(data);
            if (missingColumns.length > 0) {
              errors.push({
                rowNumber,
                error: `Missing required columns: ${missingColumns.join(', ')}`,
                row: data
              });
              return;
            }

            const transformedRow = this.transformRow(data, rowNumber);
            if (transformedRow.errors.length > 0) {
              errors.push({
                rowNumber,
                error: transformedRow.errors.join('; '),
                row: data
              });
            } else {
              results.push(transformedRow.row);
            }
          } catch (error) {
            errors.push({
              rowNumber,
              error: error instanceof Error ? error.message : 'Unknown parsing error',
              row: data
            });
          }
        })
        .on('end', () => {
          logger.info(`Buffer CSV parsing completed: ${results.length} valid rows, ${errors.length} errors`);
          resolve({ rows: results, errors, totalRows: rowNumber });
        })
        .on('error', (error) => {
          logger.error('Buffer CSV parsing error:', error);
          reject(new ValidationError(`Failed to parse CSV: ${error.message}`));
        });
    });
  }

  /**
   * Validate that all required columns exist
   */
  private static validateColumns(data: any): string[] {
    const missingColumns: string[] = [];
    for (const col of this.REQUIRED_COLUMNS) {
      if (!(col in data) && !(col.toUpperCase() in data)) {
        missingColumns.push(col);
      }
    }
    return missingColumns;
  }

  /**
   * Transform and validate a single row
   */
  private static transformRow(data: any, _: number): { row: CSVRawRow; errors: string[] } {
    const errors: string[] = [];
    
    // Get values with case-insensitive column matching
    const transaction_id = this.getColumnValue(data, 'transaction_id');
    const timestamp = this.getColumnValue(data, 'timestamp');
    const type = this.getColumnValue(data, 'type');
    const asset = this.getColumnValue(data, 'asset');
    const quantity = this.getColumnValue(data, 'quantity');
    const price_usd = this.getColumnValue(data, 'price_usd');
    const fee = this.getColumnValue(data, 'fee');
    const note = this.getColumnValue(data, 'note');

    // Validate required fields
    if (!transaction_id) errors.push(`transaction_id is required`);
    if (!timestamp) errors.push(`timestamp is required`);
    if (!type) errors.push(`type is required`);
    if (!asset) errors.push(`asset is required`);
    if (!quantity) errors.push(`quantity is required`);

    // Validate quantity is a valid number
    if (quantity) {
      const qtyNum = parseFloat(quantity);
      if (isNaN(qtyNum)) {
        errors.push(`quantity must be a valid number, got: ${quantity}`);
      } else if (qtyNum < 0) {
        errors.push(`quantity cannot be negative, got: ${quantity}`);
      }
    }

    // Validate price_usd if present
    if (price_usd) {
      const priceNum = parseFloat(price_usd);
      if (isNaN(priceNum)) {
        errors.push(`price_usd must be a valid number, got: ${price_usd}`);
      }
    }

    // Validate fee if present
    if (fee) {
      const feeNum = parseFloat(fee);
      if (isNaN(feeNum)) {
        errors.push(`fee must be a valid number, got: ${fee}`);
      }
    }

    // Validate timestamp format
    if (timestamp) {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        errors.push(`timestamp is invalid: ${timestamp}`);
      }
    }

    const row: CSVRawRow = {
      transaction_id: transaction_id || '',
      timestamp: timestamp || '',
      type: type || '',
      asset: asset || '',
      quantity: quantity || '0',
      price_usd: price_usd || '',
      fee: fee || '0',
      note: note || ''
    };

    return { row, errors };
  }

  /**
   * Get column value with case-insensitive matching
   */
  private static getColumnValue(data: any, columnName: string): string {
    // Try exact match
    if (data[columnName] !== undefined) return data[columnName];
    
    // Try case-insensitive match
    const keys = Object.keys(data);
    const foundKey = keys.find(key => key.toLowerCase() === columnName.toLowerCase());
    
    return foundKey ? data[foundKey] : '';
  }
}