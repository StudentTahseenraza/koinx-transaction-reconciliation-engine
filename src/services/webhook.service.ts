import axios from 'axios';
import { logger } from '../config/logger';

export interface WebhookPayload {
  event: 'reconciliation.started' | 'reconciliation.completed' | 'reconciliation.failed';
  runId: string;
  timestamp: Date;
  data?: any;
}

export class WebhookService {
  
  /**
   * Send webhook notification
   */
  static async sendWebhook(payload: WebhookPayload, webhookUrl: string) {
    if (!webhookUrl) return;
    
    try {
      await axios.post(webhookUrl, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Reconciliation-Engine/1.0'
        }
      });
      logger.info(`Webhook sent successfully for ${payload.event}`);
    } catch (error) {
      logger.error(`Failed to send webhook for ${payload.event}:`, error);
      // Don't throw error - webhook failures shouldn't break reconciliation
    }
  }
  
  /**
   * Send reconciliation completed notification
   */
  static async notifyCompletion(runId: string, summary: any, webhookUrl?: string) {
    if (!webhookUrl) return;
    
    await this.sendWebhook({
      event: 'reconciliation.completed',
      runId,
      timestamp: new Date(),
      data: summary
    }, webhookUrl);
  }
}