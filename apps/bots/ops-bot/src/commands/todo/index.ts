import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { logger } from '@sonagi-bots/shared';
import { n8nClient } from '../../clients/n8n.client';

export const todoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('할일')
    .setDescription('MS To Do에 새로운 할 일을 추가합니다. (n8n 연동)')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('추가')
        .setDescription('MS To Do에 새로운 할 일을 추가합니다.')
        .addStringOption((option) =>
          option
            .setName('내용')
            .setDescription('할 일의 내용(제목)을 입력하세요.')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('우선순위')
            .setDescription('우선순위를 선택하세요.')
            .setRequired(false)
            .addChoices(
              { name: '높음 (High)', value: 'High' },
              { name: '보통 (Normal)', value: 'Normal' },
              { name: '낮음 (Low)', value: 'Low' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== '추가') {
      await interaction.reply({
        embeds: [createErrorEmbed('지원하지 않는 서브명령어입니다.')],
        ephemeral: true,
      });
      return;
    }

    const webhookUrl = process.env.N8N_WEBHOOK_TODO_ADD;
    if (!webhookUrl) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            '할 일 추가 Webhook URL이 설정되지 않았습니다. (.env의 N8N_WEBHOOK_TODO_ADD)'
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const title = interaction.options.getString('내용', true);
    const priority = interaction.options.getString('우선순위') || 'Normal';

    await interaction.deferReply();

    try {
      // n8n Webhook으로 데이터 전송
      await n8nClient.triggerWebhook(webhookUrl, {
        title,
        priority,
        source: 'Discord',
        user: interaction.user.tag,
      });

      const embed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('✅ MS To Do에 할 일이 추가되었습니다.')
        .addFields({ name: '내용', value: title, inline: true });

      if (priority !== 'Normal') {
        embed.addFields({ name: '우선순위', value: priority, inline: true });
      }

      embed.setFooter({ text: 'n8n ➡️ MS To Do 연동' }).setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in /할일 추가 command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('할 일을 추가하는 중 n8n 서버와 통신 오류가 발생했습니다.')],
      });
    }
  },
};
