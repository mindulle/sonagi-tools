/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi, beforeAll, afterAll, Mock } from 'vitest';
import { playCommand } from './index';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

describe.runIf(process.env.CI || process.env.RUN_INTEGRATION_TESTS)(
  'Piston Engine Integration Test',
  () => {
    let originalPistonApiUrl: string | undefined;

    beforeAll(() => {
      originalPistonApiUrl = process.env.PISTON_API_URL;
      process.env.PISTON_API_URL = 'http://localhost:2000';
    });

    afterAll(() => {
      process.env.PISTON_API_URL = originalPistonApiUrl;
    });

    it('should execute python code using the real Piston API', async () => {
      // Mock Interaction
      const mockInteraction = {
        options: {
          getSubcommand: () => 'run',
          getString: (name: string) => {
            if (name === 'language') return 'python';
            if (name === 'code') return 'print("Integration Test Pass!")';
            return null;
          },
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined),
      } as unknown as ChatInputCommandInteraction;

      // Execute the command
      await playCommand.execute(mockInteraction);

      // Verify interaction.deferReply was called
      const deferMock = mockInteraction.deferReply as unknown as Mock;
      expect(deferMock).toHaveBeenCalled();

      // Verify interaction.editReply was called with Embed containing the result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editMock = mockInteraction.editReply as unknown as Mock<
        any,
        [{ embeds: EmbedBuilder[] }]
      >;
      expect(editMock).toHaveBeenCalled();

      const editReplyCall = editMock.mock.calls[0][0];

      expect(editReplyCall.embeds).toBeDefined();
      expect(editReplyCall.embeds.length).toBe(1);

      const embed = editReplyCall.embeds[0];
      expect(embed.data.title).toContain('python');
      expect(embed.data.description).toContain('Integration Test Pass!');
    }, 15000); // 15 seconds timeout in case Piston API takes time
  }
);
