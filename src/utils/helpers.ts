import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique run ID
 */
export const generateRunId = (): string => {
  const timestamp = Date.now();
  const shortUuid = uuidv4().split('-')[0];
  return `run_${timestamp}_${shortUuid}`;
};

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Format date to ISO string
 */
export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toISOString();
};

/**
 * Calculate percentage difference between two numbers
 */
export const calculatePercentageDiff = (value1: number, value2: number): number => {
  if (value1 === 0 && value2 === 0) return 0;
  if (value1 === 0) return 100;
  return Math.abs((value2 - value1) / value1) * 100;
};

/**
 * Calculate absolute difference in seconds between two dates
 */
export const calculateTimeDiffSeconds = (date1: Date, date2: Date): number => {
  return Math.abs(date1.getTime() - date2.getTime()) / 1000;
};

/**
 * Deep clone object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if value is within tolerance (percentage)
 */
export const isWithinTolerance = (value1: number, value2: number, tolerancePct: number): boolean => {
  const diffPct = calculatePercentageDiff(value1, value2);
  return diffPct <= tolerancePct;
};

/**
 * Truncate string to specified length
 */
export const truncate = (str: string, length: number): string => {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

/**
 * Safe JSON parse
 */
export const safeJsonParse = <T>(json: string, defaultValue: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
};