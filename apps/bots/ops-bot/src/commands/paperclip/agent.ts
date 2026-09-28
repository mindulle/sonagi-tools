import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { logger } from '@sonagi-bots/shared';
import { PaperclipService } from '../../services/paperclip';

const AGENTS = {
  '4ec5a12a-49bf-4047-8207-96a4a0723423': 'Nuri (CTO)',
  '416efb4b-c17d-4397-8367-8c21681df4ce': 'Money (PM)',
  'fe04b047-99f7-46cd-af74-94000c5ebe3f': 'Jenny (Designer)',
  '9b25dc6d-a677-449d-8420-6c07476d7bb8': 'Maru (Librarian)',
  'cc885508-8981-4930-9b70-4f2e1ffb1e6b': 'CEO',
} as const;

export const paperclipAgentCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('에이전트')
    .setDescription('페이퍼클립(Paperclip) 플랫폼의 에이전트를 관리합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('깨우기')
        .setDescription(
          '잠들어 있는 에이전트를 즉시 강제로 깨워(Heartbeat) 작업을 확인하도록 합니다.'
        )
        .addStringOption((option) =>
          option
            .setName('대상')
            .setDescription('호출할 에이전트를 선택하세요.')
            .setRequired(true)
            .addChoices(...Object.entries(AGENTS).map(([value, name]) => ({ name, value })))
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === '깨우기') {
      const agentId = interaction.options.getString('대상', true);

      if (!process.env.PAPERCLIP_API_TOKEN) {
        await interaction.reply({
          embeds: [createErrorEmbed('현재 페이퍼클립 연동이 비활성화되어 있습니다.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        await PaperclipService.invokeAgentHeartbeat(agentId);

        const displayAgentName = AGENTS[agentId as keyof typeof AGENTS] || agentId;

        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle(`⏰ 에이전트를 강제로 깨웠습니다!`)
          .setDescription(
            `**${displayAgentName}** 에이전트에게 즉시 작업을 확인하라는 신호(Heartbeat)를 보냈습니다. 에이전트가 곧 응답할 것입니다.`
          )
          .setFooter({ text: 'Paperclip 연동' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /에이전트 깨우기 command:', error);
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              '에이전트를 깨우는 중 오류가 발생했습니다. 해당 에이전트가 존재하지 않거나 서버 문제일 수 있습니다.'
            ),
          ],
        });
      }
    }
  },
};
