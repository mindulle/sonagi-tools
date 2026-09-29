/* eslint-disable */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { n8nClient } from './n8n.client';
import { logger } from '@sonagi-bots/shared';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

vi.mock('@sonagi-bots/shared', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('N8nClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.N8N_API_URL = 'http://test-n8n.local';
    process.env.N8N_API_KEY = 'test-api-key';
  });

  describe('triggerWebhook', () => {
    it('should successfully trigger a webhook and return data', async () => {
      const mockResponse = { data: { success: true } };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await n8nClient.triggerWebhook('http://webhook.url', { key: 'value' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://webhook.url',
        { key: 'value' },
        { timeout: 10000 }
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw an error and log if webhook fails', async () => {
      const mockError = new Error('Network Error');
      mockedAxios.post.mockRejectedValueOnce(mockError);

      await expect(n8nClient.triggerWebhook('http://webhook.url', {})).rejects.toThrow(
        'Network Error'
      );
      expect(logger.error).toHaveBeenCalledWith('n8n webhook trigger failed', mockError);
    });
  });

  describe('getRecentExecutions', () => {
    it('should fetch recent executions successfully', async () => {
      // Temporarily set private fields
      (n8nClient as any).apiUrl = 'http://test-n8n.local';
      (n8nClient as any).apiKey = 'test-api-key';

      const mockExecutions = [
        { id: '1', status: 'success' },
        { id: '2', status: 'error' },
      ];
      mockedAxios.get.mockResolvedValueOnce({ data: { data: mockExecutions } });

      const result = await n8nClient.getRecentExecutions(2);

      expect(mockedAxios.get).toHaveBeenCalledWith('http://test-n8n.local/api/v1/executions', {
        headers: { 'X-N8N-API-KEY': 'test-api-key' },
        params: { limit: 2 },
        timeout: 10000,
      });
      expect(result).toEqual(mockExecutions);
    });

    it('should throw an error if API env vars are missing', async () => {
      // Need to re-instantiate or just rely on the getter if it checks env vars on the fly.
      // Actually N8nClient is a singleton that reads env vars in its constructor.
      // So modifying process.env here might not affect the existing instance.
      // Let's use any to temporarily wipe it out for testing.
      const originalUrl = (n8nClient as any).apiUrl;
      (n8nClient as any).apiUrl = undefined;

      await expect(n8nClient.getRecentExecutions()).rejects.toThrow(
        'N8N_API_URL or N8N_API_KEY is not configured.'
      );

      (n8nClient as any).apiUrl = originalUrl;
    });
  });
});
