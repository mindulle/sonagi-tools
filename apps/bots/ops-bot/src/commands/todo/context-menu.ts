import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
} from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { logger } from '@sonagi-bots/shared';
import { n8nClient } from '../../clients/n8n.client';

export const addTodoContextMenu: Command = {
  data: new ContextMenuCommandBuilder()
    .setName('할 일(MS To Do)로 보내기')
    .setType(ApplicationCommandType.Message),

  async execute(interaction: MessageContextMenuCommandInteraction) {
    if (!interaction.isMessageContextMenuCommand()) return;

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

    const targetMessage = interaction.targetMessage;
    // 디스코드 메시지 길이는 길 수 있으므로 제목용으로 앞부분만 자르고, 나머지는 본문으로 쓰거나 생략할 수 있습니다.
    // 하지만 현재 n8n 워크플로우는 title 하나만 받습니다.
    let content = targetMessage.cleanContent;
    if (!content) {
      await interaction.reply({
        embeds: [createErrorEmbed('메시지에 텍스트 내용이 없습니다.')],
        ephemeral: true,
      });
      return;
    }

    // 너무 길면 자름 (MS To Do 제목 제한 감안)
    if (content.length > 200) {
      content = content.substring(0, 197) + '...';
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // n8n Webhook으로 데이터 전송
      await n8nClient.triggerWebhook(webhookUrl, {
        title: content,
        priority: 'Normal',
        source: 'Discord Context Menu',
        user: interaction.user.tag,
        url: targetMessage.url, // 원래 메시지 링크
      });

      const embed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('✅ MS To Do에 할 일이 추가되었습니다.')
        .setDescription(`[원본 메시지 보러가기](${targetMessage.url})`)
        .addFields({ name: '내용', value: content })
        .setFooter({ text: 'n8n ➡️ MS To Do 연동' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in Add Todo Context Menu command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('할 일을 추가하는 중 n8n 서버와 통신 오류가 발생했습니다.')],
      });
    }
  },
};
