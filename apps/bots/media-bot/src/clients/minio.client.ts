import * as Minio from 'minio';
import { logger } from '@sonagi-bots/shared';

class MinioClientWrapper {
  private static instance: MinioClientWrapper;
  private client: Minio.Client | null = null;
  private defaultBucket: string;

  private constructor() {
    this.defaultBucket = process.env.MINIO_DEFAULT_BUCKET || 'sonagi-bucket';

    const endPoint = process.env.MINIO_ENDPOINT;
    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;

    if (endPoint && accessKey && secretKey) {
      const portEnv = process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : 443;
      const port = isNaN(portEnv) ? 443 : portEnv;

      this.client = new Minio.Client({
        endPoint,
        port,
        useSSL: process.env.MINIO_USE_SSL !== 'false',
        accessKey,
        secretKey,
      });
      logger.info(`MinIO Client initialized for ${endPoint}`);
    } else {
      logger.warn('MinIO configuration missing. Running in mock mode.');
    }
  }

  public static getInstance(): MinioClientWrapper {
    if (!MinioClientWrapper.instance) {
      MinioClientWrapper.instance = new MinioClientWrapper();
    }
    return MinioClientWrapper.instance;
  }

  public async ping(): Promise<boolean> {
    const client = this.client;
    if (!client) return false;

    try {
      await client.bucketExists(this.defaultBucket);
      return true;
    } catch (error) {
      logger.error('MinIO ping failed', error);
      return false;
    }
  }

  public async purgeCache(target: string): Promise<boolean> {
    const client = this.client;
    if (!client) {
      logger.info(`[MOCK] Purging MinIO target: ${target}`);
      return true;
    }

    try {
      await client.removeObject(this.defaultBucket, target);
      logger.info(`Purged MinIO object: ${target}`);
      return true;
    } catch (error) {
      logger.error(`MinIO purge failed for ${target}`, error);
      return false;
    }
  }

  public async getStats(): Promise<{ size: string; objects: number }> {
    const client = this.client;
    if (!client) {
      return { size: '150.2 GB (Mock)', objects: 45210 };
    }

    return new Promise((resolve) => {
      let totalSize = 0;
      let totalObjects = 0;

      const stream = client.listObjectsV2(this.defaultBucket, '', true);

      stream.on('data', (obj) => {
        totalObjects++;
        totalSize += obj.size || 0;
      });

      stream.on('end', () => {
        const sizeInGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
        resolve({ size: `${sizeInGB} GB`, objects: totalObjects });
      });

      stream.on('error', (err) => {
        logger.error('Error calculating MinIO stats', err);
        resolve({ size: 'Error', objects: 0 });
      });
    });
  }
}

export const minioClient = MinioClientWrapper.getInstance();
