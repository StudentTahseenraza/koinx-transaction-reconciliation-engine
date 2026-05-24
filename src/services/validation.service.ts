import { logger } from '../config/logger';
import { CSVRawRow } from './csvParser.service';
import { NormalizationService } from './normalization.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedData: {
    transactionId: string;
    timestamp: Date;
    rawTimestamp: string;
    type: string;
    asset: string;
    quantity: number;
    priceUsd: number | null;
    fee: number;
    note: string;
    normalizedAsset: string;
    normalizedType: string;
  };
}

export class ValidationService {
  
  /**
   * Validate and transform a single transaction row
   */
  static validateTransaction(
    row: CSVRawRow,
    source: 'USER' | 'EXCHANGE',
    rowNumber: number
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 1. Validate transaction_id
    const transactionId = row.transaction_id?.trim();
    if (!transactionId) {
      errors.push('transaction_id is required');
    }
    
    // 2. Validate and parse timestamp
    let timestamp: Date | null = null;
    const rawTimestamp = row.timestamp?.trim();
    if (!rawTimestamp) {
      errors.push('timestamp is required');
    } else {
      timestamp = this.parseTimestamp(rawTimestamp);
      if (!timestamp) {
        errors.push(`Invalid timestamp format: ${rawTimestamp}`);
      } else if (isNaN(timestamp.getTime())) {
        errors.push(`Timestamp is invalid: ${rawTimestamp}`);
      } else {
        // Check for future dates
        if (timestamp > new Date()) {
          warnings.push(`Timestamp is in the future: ${rawTimestamp}`);
        }
        // Check for very old dates (before 2020)
        if (timestamp < new Date('2020-01-01')) {
          warnings.push(`Timestamp is very old: ${rawTimestamp}`);
        }
      }
    }
    
    // 3. Validate type
    const type = row.type?.trim();
    if (!type) {
      errors.push('type is required');
    }
    
    // 4. Validate asset
    const asset = row.asset?.trim();
    if (!asset) {
      errors.push('asset is required');
    }
    
    // 5. Validate and parse quantity
    let quantity: number | null = null;
    const quantityStr = row.quantity?.toString().trim();
    if (!quantityStr) {
      errors.push('quantity is required');
    } else {
      quantity = parseFloat(quantityStr);
      if (isNaN(quantity)) {
        errors.push(`quantity must be a valid number, got: ${quantityStr}`);
      } else if (quantity < 0) {
        errors.push(`quantity cannot be negative, got: ${quantity}`);
      } else if (quantity === 0) {
        warnings.push(`quantity is zero, this may be a data entry error`);
      }
    }
    
    // 6. Validate price_usd (optional)
    let priceUsd: number | null = null;
    const priceUsdStr = row.price_usd?.toString().trim();
    if (priceUsdStr && priceUsdStr !== '') {
      priceUsd = parseFloat(priceUsdStr);
      if (isNaN(priceUsd)) {
        warnings.push(`price_usd is not a valid number: ${priceUsdStr}`);
      } else if (priceUsd < 0) {
        warnings.push(`price_usd is negative: ${priceUsd}`);
      }
    }
    
    // 7. Validate fee (optional)
    let fee: number = 0;
    const feeStr = row.fee?.toString().trim();
    if (feeStr && feeStr !== '') {
      fee = parseFloat(feeStr);
      if (isNaN(fee)) {
        warnings.push(`fee is not a valid number: ${feeStr}`);
        fee = 0;
      } else if (fee < 0) {
        warnings.push(`fee is negative: ${fee}`);
        fee = 0;
      }
    }
    
    // 8. Normalize asset and type if they exist
    let normalizedAsset = 'UNKNOWN';
    let normalizedType = 'UNKNOWN';
    
    if (asset && type) {
      const normalized = NormalizationService.normalizeTransaction(
        { asset, type },
        source
      );
      normalizedAsset = normalized.normalizedAsset;
      normalizedType = normalized.normalizedType;
      warnings.push(...normalized.warnings);
      
      // Add validation error if normalization failed
      if (!normalized.isValid) {
        errors.push(`Failed to normalize: asset=${asset}, type=${type}`);
      }
    }
    
    // Determine if transaction is valid
    const isValid = errors.length === 0 && 
                    timestamp !== null && 
                    quantity !== null &&
                    normalizedAsset !== 'UNKNOWN' &&
                    normalizedType !== 'UNKNOWN';
    
    return {
      isValid,
      errors,
      warnings,
      validatedData: {
        transactionId: transactionId || `unknown_${rowNumber}`,
        timestamp: timestamp || new Date(0),
        rawTimestamp: rawTimestamp || '',
        type: type || '',
        asset: asset || '',
        quantity: quantity || 0,
        priceUsd: priceUsd,
        fee: fee,
        note: row.note || '',
        normalizedAsset,
        normalizedType
      }
    };
  }
  
  /**
   * Parse timestamp with multiple format support
   */
  private static parseTimestamp(timestampStr: string): Date | null {
    // Try standard ISO format
    let date = new Date(timestampStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try with space instead of T
    date = new Date(timestampStr.replace(' ', 'T'));
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try parsing as Unix timestamp (seconds)
    const unixSeconds = parseInt(timestampStr);
    if (!isNaN(unixSeconds) && unixSeconds > 1000000000 && unixSeconds < 2000000000) {
      return new Date(unixSeconds * 1000);
    }
    
    // Try parsing as Unix timestamp (milliseconds)
    const unixMs = parseInt(timestampStr);
    if (!isNaN(unixMs) && unixMs > 1000000000000 && unixMs < 3000000000000) {
      return new Date(unixMs);
    }
    
    return null;
  }
  
  /**
   * Validate entire dataset and return statistics
   */
  static validateDataset(
    rows: CSVRawRow[],
    source: 'USER' | 'EXCHANGE'
  ): {
    validRows: ValidationResult[];
    invalidRows: ValidationResult[];
    stats: {
      total: number;
      valid: number;
      invalid: number;
      uniqueAssets: string[];
      uniqueTypes: string[];
    };
  } {
    const validRows: ValidationResult[] = [];
    const invalidRows: ValidationResult[] = [];
    const assetsSet = new Set<string>();
    const typesSet = new Set<string>();
    
    rows.forEach((row, index) => {
      const result = this.validateTransaction(row, source, index + 2); // +2 for header and 1-based
      
      // Collect assets and types from valid rows only
      if (result.isValid) {
        assetsSet.add(result.validatedData.normalizedAsset);
        typesSet.add(result.validatedData.normalizedType);
        validRows.push(result);
      } else {
        invalidRows.push(result);
      }
    });
    
    // Log validation summary
    logger.info(`Validation completed for ${source}: ${validRows.length} valid, ${invalidRows.length} invalid`);
    
    if (invalidRows.length > 0) {
      logger.warn(`Invalid rows count: ${invalidRows.length}`);
      invalidRows.slice(0, 5).forEach((row, i) => {
        logger.warn(`  Invalid row ${i + 1}: ${row.errors.join(', ')}`);
      });
    }
    
    return {
      validRows,
      invalidRows,
      stats: {
        total: rows.length,
        valid: validRows.length,
        invalid: invalidRows.length,
        uniqueAssets: Array.from(assetsSet),
        uniqueTypes: Array.from(typesSet)
      }
    };
  }
}