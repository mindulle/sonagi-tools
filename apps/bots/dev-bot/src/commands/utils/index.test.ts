/* eslint-disable */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { utilsCommand } from './index';
import type { ChatInputCommandInteraction } from 'discord.js';

// Mock axios completely
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('utilsCommand', () => {
  let mockInteraction: any;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup a fake ChatInputCommandInteraction
    mockInteraction = {
      options: {
        getSubcommand: vi.fn(),
        getString: vi.fn(),
      },
      deferReply: vi.fn().mockResolvedValue(true),
      editReply: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    };
  });

  describe('food subcommand', () => {
    it('should fetch an image and return a success embed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getSubcommand.mockReturnValue('food');
      mockedAxios.get.mockResolvedValueOnce({ data: { image: 'https://fake-food.jpg' } });

      await utilsCommand.execute(mockInteraction as unknown as ChatInputCommandInteraction);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://foodish-api.com/api/',
        expect.any(Object)
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.editReply).toHaveBeenCalled();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const editReplyArg = mockInteraction.editReply.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(editReplyArg.embeds[0].data.image.url).toBe('https://fake-food.jpg');
    });

    it('should handle API errors gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getSubcommand.mockReturnValue('food');
      mockedAxios.get.mockRejectedValueOnce(new Error('API Timeout'));

      await utilsCommand.execute(mockInteraction as unknown as ChatInputCommandInteraction);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.editReply).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const editReplyArg = mockInteraction.editReply.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(editReplyArg.embeds[0].data.description).toContain('오류가 발생했습니다');
    });
  });

  describe('photo subcommand', () => {
    it('should return a random photo url', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getSubcommand.mockReturnValue('photo');

      await utilsCommand.execute(mockInteraction as unknown as ChatInputCommandInteraction);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.editReply).toHaveBeenCalled();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const editReplyArg = mockInteraction.editReply.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(editReplyArg.embeds[0].data.image.url).toContain('source.unsplash.com');
    });
  });

  describe('dog subcommand', () => {
    it('should fetch an image and return a dog embed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getSubcommand.mockReturnValue('dog');
      mockedAxios.get.mockResolvedValueOnce({
        data: { url: 'https://fake-dog.jpg' },
      });

      await utilsCommand.execute(mockInteraction as unknown as ChatInputCommandInteraction);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://random.dog/woof.json?filter=mp4,webm,gif',
        expect.any(Object)
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const editReplyArg = mockInteraction.editReply.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(editReplyArg.embeds[0].data.image.url).toBe('https://fake-dog.jpg');
    });
  });

  describe('cat subcommand', () => {
    it('should fetch an image and return a cat embed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getSubcommand.mockReturnValue('cat');
      mockedAxios.get.mockResolvedValueOnce({ data: [{ url: 'https://fake-cat.jpg' }] });

      await utilsCommand.execute(mockInteraction as unknown as ChatInputCommandInteraction);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.thecatapi.com/v1/images/search',
        expect.any(Object)
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const editReplyArg = mockInteraction.editReply.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(editReplyArg.embeds[0].data.image.url).toBe('https://fake-cat.jpg');
    });
  });

  describe('pokemon subcommand', () => {
    it('should fetch pokemon data and return embed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getSubcommand.mockReturnValue('pokemon');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getString.mockReturnValue('pikachu');

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 25,
          name: 'pikachu',
          height: 4,
          weight: 60,
          types: [{ type: { name: 'electric' } }],
          sprites: { other: { 'official-artwork': { front_default: 'https://fake-pikachu.jpg' } } },
        },
      });

      await utilsCommand.execute(mockInteraction as unknown as ChatInputCommandInteraction);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://pokeapi.co/api/v2/pokemon/pikachu',
        expect.any(Object)
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const editReplyArg = mockInteraction.editReply.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(editReplyArg.embeds[0].data.title).toContain('PIKACHU');
    });

    it('should handle 404 errors gracefully when pokemon is not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getSubcommand.mockReturnValue('pokemon');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getString.mockReturnValue('unknown-pokemon-name');

      const notFoundError: any = new Error('Not Found');
      notFoundError.isAxiosError = true;
      notFoundError.response = { status: 404 };
      mockedAxios.get.mockRejectedValueOnce(notFoundError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await utilsCommand.execute(mockInteraction as unknown as ChatInputCommandInteraction);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.editReply).toHaveBeenCalled();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const editReplyArg = mockInteraction.editReply.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(editReplyArg.embeds[0].data.description).toContain('찾을 수 없습니다');
    });
  });

  describe('wiki subcommand', () => {
    it('should fetch wiki summary and return embed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getSubcommand.mockReturnValue('wiki');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getString.mockReturnValue('디자인');

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          query: {
            search: [{ title: '디자인', snippet: '디자인은 <b>목적</b>을 가진 기획...' }],
          },
        },
      });

      await utilsCommand.execute(mockInteraction as unknown as ChatInputCommandInteraction);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://ko.wikipedia.org/w/api.php',
        expect.objectContaining({
          headers: expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            'User-Agent': expect.any(String),
          }),
        })
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockInteraction.editReply).toHaveBeenCalled();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const editReplyArg = mockInteraction.editReply.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(editReplyArg.embeds[0].data.title).toContain('디자인');
      // Should strip HTML tags
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(editReplyArg.embeds[0].data.description).toContain('디자인은 목적을 가진 기획...');
    });

    it('should handle empty search results', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getSubcommand.mockReturnValue('wiki');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockInteraction.options.getString.mockReturnValue('아무도검색안할단어');

      mockedAxios.get.mockResolvedValueOnce({
        data: { query: { search: [] } },
      });

      await utilsCommand.execute(mockInteraction as unknown as ChatInputCommandInteraction);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const editReplyArg = mockInteraction.editReply.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(editReplyArg.embeds[0].data.description).toContain('결과가 없습니다');
    });
  });
});
