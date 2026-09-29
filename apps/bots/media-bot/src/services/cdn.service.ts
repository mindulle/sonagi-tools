import { minioClient } from '../clients/minio.client';

class CdnService {
  public async purge(target: string): Promise<boolean> {
    return minioClient.purgeCache(target);
  }

  public async getStats(): Promise<{ size: string; objects: number }> {
    return minioClient.getStats();
  }
}

export const cdnService = new CdnService();
