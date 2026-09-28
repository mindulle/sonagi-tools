/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import axios from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import { logger } from '@sonagi-bots/shared';

class K3sClient {
  private static instance: K3sClient;
  private apiUrl: string;
  private httpsAgent: https.Agent | undefined;
  private token: string | undefined;

  private constructor() {
    this.apiUrl = process.env.K3S_API_URL || 'https://kubernetes.default.svc';
    const rejectUnauthorized = process.env.K3S_REJECT_UNAUTHORIZED !== 'false';
    if (!rejectUnauthorized) {
      logger.warn('K3sClient: Strict SSL verification is disabled.');
    }
    this.httpsAgent = new https.Agent({ rejectUnauthorized });

    try {
      this.token = fs
        .readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf-8')
        .trim();
    } catch (e) {
      logger.warn('Could not read K8s service account token.');
    }
  }

  public static getInstance(): K3sClient {
    if (!K3sClient.instance) {
      K3sClient.instance = new K3sClient();
    }
    return K3sClient.instance;
  }

  public async ping(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      const response = await axios.get(`${this.apiUrl}/livez`, {
        httpsAgent: this.httpsAgent,
        headers,
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      logger.error('K3s ping failed', error);
      return false;
    }
  }
}

export const k3sClient = K3sClient.getInstance();
