import { logger } from '../config/logger';

// Asset normalization mapping
const ASSET_ALIASES: Record<string, string> = {
  // Bitcoin variations
  'bitcoin': 'BTC',
  'btc': 'BTC',
  'xbt': 'BTC',
  
  // Ethereum variations
  'ethereum': 'ETH',
  'eth': 'ETH',
  'ether': 'ETH',
  
  // Solana variations
  'solana': 'SOL',
  'sol': 'SOL',
  
  // USDT variations
  'usdt': 'USDT',
  'tether': 'USDT',
  'usd tethers': 'USDT',
  
  // Matic/Polygon variations
  'matic': 'MATIC',
  'polygon': 'MATIC',
  
  // LINK variations
  'link': 'LINK',
  'chainlink': 'LINK',
};

// Type normalization mapping
const TYPE_MAPPING: Record<string, string> = {
  // Standard types
  'BUY': 'BUY',
  'buy': 'BUY',
  'BOUGHT': 'BUY',
  
  'SELL': 'SELL',
  'sell': 'SELL',
  'SOLD': 'SELL',
  
  // Transfer handling - USER's TRANSFER_OUT = EXCHANGE's TRANSFER_IN
  'TRANSFER_IN': 'TRANSFER_IN',
  'TRANSFER_OUT': 'TRANSFER_IN', // User perspective maps to exchange perspective
  'transfer_in': 'TRANSFER_IN',
  'transfer_out': 'TRANSFER_IN',
  'DEPOSIT': 'TRANSFER_IN',
  'WITHDRAWAL': 'TRANSFER_IN',
};

// Transaction type categories for validation
const VALID_TYPES = ['BUY', 'SELL', 'TRANSFER_IN'];

export interface NormalizedTransaction {
  normalizedAsset: string;
  normalizedType: string;
  originalAsset: string;
  originalType: string;
  warnings: string[];
}

export class NormalizationService {
  
  /**
   * Normalize asset name to standard format
   */
  static normalizeAsset(asset: string): { normalized: string; warning?: string } {
    if (!asset) {
      return { normalized: 'UNKNOWN', warning: 'Empty asset name' };
    }

    const trimmedAsset = asset.trim().toLowerCase();
    const normalized = ASSET_ALIASES[trimmedAsset];
    
    if (normalized) {
      return { normalized };
    }
    
    // If not in mapping, try uppercase as fallback
    const upperAsset = asset.trim().toUpperCase();
    if (upperAsset.match(/^[A-Z]{2,5}$/)) {
      return { normalized: upperAsset, warning: `Unknown asset code: ${asset}` };
    }
    
    return { normalized: 'UNKNOWN', warning: `Unrecognized asset: ${asset}` };
  }

  /**
   * Normalize transaction type with perspective handling
   */
  static normalizeType(type: string, _: 'USER' | 'EXCHANGE'): { normalized: string; warning?: string } {
    if (!type) {
      return { normalized: 'UNKNOWN', warning: 'Empty transaction type' };
    }

    const trimmedType = type.trim().toUpperCase();
    let normalized = TYPE_MAPPING[trimmedType];
    
    if (!normalized) {
      return { normalized: 'UNKNOWN', warning: `Unrecognized transaction type: ${type}` };
    }
    
    // Validate type is in allowed list (after normalization)
    if (!VALID_TYPES.includes(normalized)) {
      return { normalized: 'UNKNOWN', warning: `Invalid transaction type after normalization: ${type} -> ${normalized}` };
    }
    
    return { normalized, warning: undefined };
  }

  /**
   * Full transaction normalization
   */
  static normalizeTransaction(
    transaction: any,
    source: 'USER' | 'EXCHANGE'
  ): NormalizedTransaction & { isValid: boolean } {
    const warnings: string[] = [];
    
    // Normalize asset
    const assetResult = this.normalizeAsset(transaction.asset);
    if (assetResult.warning) {
      warnings.push(assetResult.warning);
    }
    
    // Normalize type
    const typeResult = this.normalizeType(transaction.type, source);
    if (typeResult.warning) {
      warnings.push(typeResult.warning);
    }
    
    const isValid = assetResult.normalized !== 'UNKNOWN' && 
                    typeResult.normalized !== 'UNKNOWN';
    
    logger.debug(`Normalized transaction: ${transaction.asset}(${transaction.type}) -> ${assetResult.normalized}(${typeResult.normalized})`);
    
    return {
      normalizedAsset: assetResult.normalized,
      normalizedType: typeResult.normalized,
      originalAsset: transaction.asset,
      originalType: transaction.type,
      warnings,
      isValid
    };
  }

  /**
   * Check if two normalized transactions are compatible for matching
   */
  static areCompatible(
    userNormalized: { asset: string; type: string },
    exchangeNormalized: { asset: string; type: string }
  ): boolean {
    return userNormalized.asset === exchangeNormalized.asset &&
           userNormalized.type === exchangeNormalized.type;
  }

  /**
   * Get all possible asset variations for fuzzy matching
   */
  static getAssetVariations(asset: string): string[] {
    const normalized = this.normalizeAsset(asset).normalized;
    const variations = new Set<string>();
    
    // Add the normalized version
    variations.add(normalized);
    
    // Add all aliases that map to this normalized asset
    for (const [alias, target] of Object.entries(ASSET_ALIASES)) {
      if (target === normalized) {
        variations.add(alias.toUpperCase());
        variations.add(alias);
      }
    }
    
    return Array.from(variations);
  }
}