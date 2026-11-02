import { k3sClient } from '../clients/k3s.client';
import axios from 'axios';

export interface SystemHealth {
  minio: boolean;
  n8n: boolean;
  runtime: boolean;
  timestamp: Date;
}

export class HealthService {
  public async getSystemStatus(): Promise<SystemHealth> {
    const minioEndpoint = process.env.MINIO_ENDPOINT || '100.82.121.40';
    const minioPort = process.env.MINIO_PORT || '9000';
    const minioProtocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const minioUrl = minioEndpoint.includes(':')
      ? `${minioProtocol}://${minioEndpoint}/minio/health/live`
      : `${minioProtocol}://${minioEndpoint}:${minioPort}/minio/health/live`;

    const n8nUrl = process.env.N8N_API_URL
      ? `${process.env.N8N_API_URL}/healthz`
      : 'http://localhost:5678/healthz';

    const [minio, n8n, runtime] = await Promise.all([
      axios
        .get(minioUrl, { timeout: 3000 })
        .then(() => true)
        .catch(() =>
          axios
            .get('http://127.0.0.1:9000/minio/health/live', { timeout: 2000 })
            .then(() => true)
            .catch(() => false)
        ),
      axios
        .get(n8nUrl, { timeout: 3000 })
        .then(() => true)
        .catch(() => false),
      k3sClient
        .ping()
        .then((k3sOk) => {
          if (k3sOk) return true;
          return axios
            .get('http://127.0.0.1:9100/metrics', { timeout: 2000 })
            .then(() => true)
            .catch(() => false);
        })
        .catch(() =>
          axios
            .get('http://127.0.0.1:9100/metrics', { timeout: 2000 })
            .then(() => true)
            .catch(() => false)
        ),
    ]);

    return {
      minio,
      n8n,
      runtime,
      timestamp: new Date(),
    };
  }
}

export const healthService = new HealthService();
