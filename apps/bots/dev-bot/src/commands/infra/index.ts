/* eslint-disable */
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { healthService } from '../../services/health.service';
import { DashboardService } from '../../services/dashboard.service';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import axios from 'axios';

const N8N_ANKI_SYNC_WEBHOOK =
  process.env.N8N_ANKI_SYNC_WEBHOOK || 'https://n8n.sonagi.space/webhook/anki-sync';

export const infraCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('infra')
    .setDescription('Sonagi 인프라 상태 및 관리 커맨드')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('K3s, MinIO, n8n 등 주요 인프라의 헬스체크 결과를 조회합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('anki-sync')
        .setDescription('llm-wiki 마크다운을 Anki에 수동 동기화합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('대시보드')
        .setDescription('라이브 대시보드를 즉시 새로고침하거나 현재 채널에 새로 띄웁니다.')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'status': {
        await interaction.deferReply();

        const status = await healthService.getSystemStatus();
        const isAllHealthy = status.k3s && status.minio && status.n8n;

        const embed = new EmbedBuilder()
          .setColor(isAllHealthy ? Colors.SUCCESS : Colors.ERROR)
          .setTitle('🖥️ Sonagi Infrastructure Status')
          .setDescription(
            isAllHealthy
              ? '모든 시스템이 정상적으로 가동 중입니다.'
              : '일부 시스템에 장애가 감지되었습니다.'
          )
          .addFields(
            { name: 'K3s Cluster', value: status.k3s ? '🟢 Online' : '🔴 Offline', inline: true },
            {
              name: 'MinIO Storage',
              value: status.minio ? '🟢 Online' : '🔴 Offline',
              inline: true,
            },
            { name: 'n8n Workflows', value: status.n8n ? '🟢 Online' : '🔴 Offline', inline: true }
          )
          .setTimestamp(status.timestamp);

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'anki-sync': {
        await interaction.deferReply();

        try {
          await axios.post(N8N_ANKI_SYNC_WEBHOOK, { source: 'spells-bot' }, { timeout: 5000 });

          const embed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle('📚 Anki Sync 시작됨')
            .setDescription(
              'llm-wiki → Anki 동기화가 백그라운드에서 시작됐습니다.\n완료까지 약 1~2분 소요됩니다.'
            )
            .addFields({ name: 'Trigger', value: 'Manual (spells-bot)', inline: true })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          await interaction.editReply({
            embeds: [createErrorEmbed('Anki Sync 트리거에 실패했습니다. n8n 상태를 확인해주세요.')],
          });
        }
        break;
      }

      case '대시보드': {
        await interaction.deferReply({ ephemeral: true });

        // Trigger dashboard update for the current channel
        await DashboardService.updateDashboard(interaction.client, interaction.channelId);

        await interaction.editReply({ content: '✅ 라이브 대시보드가 갱신되었습니다.' });
        break;
      }

      default:
        await interaction.reply({
          embeds: [createErrorEmbed('알 수 없는 서브커맨드입니다.')],
          ephemeral: true,
        });
    }
  },
};
