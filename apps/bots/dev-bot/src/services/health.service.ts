import { k3sClient } from '../clients/k3s.client';
import axios from 'axios';

export interface SystemHealth {
  minio: boolean;
  n8n: boolean;
  k3s: boolean;
  timestamp: Date;
}

export class HealthService {
  public async getSystemStatus(): Promise<SystemHealth> {
    const minioUrl = process.env.MINIO_ENDPOINT
      ? `https://${process.env.MINIO_ENDPOINT}/minio/health/live`
      : 'http://localhost:9000/minio/health/live';
    const n8nUrl = process.env.N8N_API_URL
      ? `${process.env.N8N_API_URL}/healthz`
      : 'http://localhost:5678/healthz';

    const [minio, n8n, k3s] = await Promise.all([
      axios
        .get(minioUrl, { timeout: 3000 })
        .then(() => true)
        .catch(() => false),
      axios
        .get(n8nUrl, { timeout: 3000 })
        .then(() => true)
        .catch(() => false),
      k3sClient.ping(),
    ]);

    return {
      minio,
      n8n,
      k3s,
      timestamp: new Date(),
    };
  }
}

export const healthService = new HealthService();
