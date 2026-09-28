import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { logger } from '@sonagi-bots/shared';

export class EagleService {
  /**
   * Eagle 라이브러리 구조에 맞게 이미지를 저장하고 metadata.json을 생성합니다.
   * @param imageUrl 원본 이미지 URL
   * @param annotation 출처 텍스트나 메모 (메타데이터에 저장)
   */
  static async saveImageToEagle(imageUrl: string, annotation: string): Promise<boolean> {
    try {
      const eagleLibraryPath = process.env.EAGLE_LIBRARY_PATH || '/data/eagle.library/images';

      // UUID 생성 (Eagle 에셋 ID)
      const assetId = crypto.randomUUID().replace(/-/g, '').toUpperCase();
      const folderPath = path.join(eagleLibraryPath, `${assetId}.info`);

      // 이미지 다운로드
      const response = await axios.get<ArrayBuffer>(imageUrl, { responseType: 'arraybuffer' });

      // 확장자 추론 (Content-Type 우선, 실패시 URL 기반)
      const rawContentType = response.headers['content-type'];
      const contentType = typeof rawContentType === 'string' ? rawContentType : '';

      let ext = 'png';
      if (contentType) {
        if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
        else if (contentType.includes('gif')) ext = 'gif';
        else if (contentType.includes('webp')) ext = 'webp';
      } else {
        const urlMatch = imageUrl.match(/\.(png|jpe?g|gif|webp)(?:[?#]|$)/i);
        if (urlMatch) ext = urlMatch[1].toLowerCase();
      }

      // 폴더 생성
      await fs.mkdir(folderPath, { recursive: true });

      // 이미지 파일 저장
      const imagePath = path.join(folderPath, `${assetId}.${ext}`);
      // Cast response.data properly to ArrayBuffer/Buffer
      await fs.writeFile(imagePath, Buffer.from(response.data));

      // metadata.json 생성 (Eagle 구조)
      const metadata = {
        id: assetId,
        name: assetId,
        ext: ext,
        tags: ['deploy', 'design'],
        annotation: annotation || '',
      };

      const metaPath = path.join(folderPath, 'metadata.json');
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

      logger.info(`Successfully saved asset to Eagle: ${assetId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save image to Eagle: ${imageUrl}`, error);
      return false;
    }
  }
}
