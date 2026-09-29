import axios from 'axios';
import { logger } from '@sonagi-bots/shared';

export interface EagleImage {
  id: string;
  name: string;
  url: string;
  tags: string[];
}

interface AssetHubItem {
  id: string;
  name: string;
  ext?: string;
  tags?: string[];
  has_thumbnail?: boolean;
}

interface AssetHubApiResponse {
  total: number;
  items: AssetHubItem[];
}

class EagleClient {
  private static instance: EagleClient;
  private apiUrl: string;

  private constructor() {
    // Sonagi Asset Hub (Eagle Gallery compatible) API URL
    this.apiUrl = process.env.EAGLE_API_URL || 'http://localhost:34920';
  }

  public static getInstance(): EagleClient {
    if (!EagleClient.instance) {
      EagleClient.instance = new EagleClient();
    }
    return EagleClient.instance;
  }

  public async searchImages(query: string): Promise<EagleImage[]> {
    try {
      // Calling Sonagi Asset Hub API (/api/items)
      const response = await axios.get<AssetHubApiResponse>(`${this.apiUrl}/api/items`, {
        params: { search: query, limit: 10 },
      });

      if (response.data && response.data.items) {
        const items = response.data.items;

        if (!items || items.length === 0) {
          return [];
        }

        return items.map((item) => ({
          id: item.id,
          name: item.name,
          // Asset Hub serves thumbnails via this endpoint
          url: `${this.apiUrl}/api/image/${item.id}/thumbnail`,
          tags: item.tags || [],
        }));
      }

      return [];
    } catch (error) {
      logger.error(`Eagle search failed for query: ${query}`, error);

      // Fallback to mock data to prevent bot crash during dev or API outage
      return [
        {
          id: 'mock-1',
          name: `Reference for ${query} (Mock/Offline)`,
          url: 'https://via.placeholder.com/600x400.png?text=Eagle+Offline',
          tags: [query, 'UI', 'Offline-Mock'],
        },
      ];
    }
  }
}

export const eagleClient = EagleClient.getInstance();
