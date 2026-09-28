import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { cdnService } from '../../services/cdn.service';
import { Colors, createErrorEmbed, createSuccessEmbed } from '@sonagi-bots/shared';

export const cdnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cdn')
    .setDescription('MinIO 스토리지 및 로컬 CDN 제어 커맨드')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('purge')
        .setDescription('특정 경로의 캐시나 파일을 퍼지합니다.')
        .addStringOption((option) =>
          option
            .setName('target')
            .setDescription('퍼지할 경로 (예: /images/banner.png 또는 all)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stats')
        .setDescription('MinIO 스토리지의 전체 용량 및 파일 통계를 확인합니다.')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'purge': {
        const target = interaction.options.getString('target', true);

        // Basic Path Traversal Validation
        if (target !== 'all' && (target.includes('../') || target.includes('..\\'))) {
          await interaction.reply({
            embeds: [createErrorEmbed('잘못된 경로입니다 (Path traversal attempt detected).')],
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply();

        const success = await cdnService.purge(target);
        if (success) {
          await interaction.editReply({
            embeds: [
              createSuccessEmbed(`성공적으로 퍼지 명령을 수행했습니다.\n\`Target: ${target}\``),
            ],
          });
        } else {
          await interaction.editReply({
            embeds: [createErrorEmbed(`퍼지 실패. 로그를 확인하세요.\n\`Target: ${target}\``)],
          });
        }
        break;
      }

      case 'stats': {
        await interaction.deferReply();
        const stats = await cdnService.getStats();

        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle('📊 MinIO Storage Statistics')
          .addFields(
            { name: 'Total Size', value: stats.size, inline: true },
            { name: 'Object Count', value: stats.objects.toLocaleString(), inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
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
