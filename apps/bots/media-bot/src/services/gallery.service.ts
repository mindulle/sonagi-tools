import { eagleClient, EagleImage } from '../clients/eagle.client';

class GalleryService {
  public async searchReferences(query: string): Promise<EagleImage[]> {
    return eagleClient.searchImages(query);
  }
}

export const galleryService = new GalleryService();
