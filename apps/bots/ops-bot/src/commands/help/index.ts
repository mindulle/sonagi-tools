import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors } from '@sonagi-bots/shared';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('도움말')
    .setDescription('Sonagi Ops 봇에서 사용할 수 있는 명령어 목록과 사용법을 보여줍니다.'),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('👔 Sonagi Ops 명령어 가이드')
      .setDescription('생산성, AI 협업, 워크플로우 관리를 지원하는 Ops 봇의 명령어 목록입니다.')
      .setThumbnail(interaction.client.user?.displayAvatarURL() || null)
      .addFields(
        {
          name: '🚀 생산성 & 일정',
          value:
            '`/일정` - 노션에 오늘 일정 조회 및 새로운 일정을 추가합니다.\n' +
            '`/지출` - 노션 가계부에 수입/지출 내역을 기록합니다.\n' +
            '`/할일` - MS To Do에 새로운 할 일을 등록하거나 조회합니다.',
        },
        {
          name: '🤖 AI 에이전트 (Paperclip)',
          value:
            '`/이슈` - AI 에이전트에게 할당할 이슈를 관리합니다.\n' +
            '`/결재` - 에이전트의 승인 요청을 확인하고 처리합니다.\n' +
            '`/에이전트` - 페이퍼클립 에이전트 목록과 상태를 봅니다.\n' +
            '`/계획` - AI가 제안한 이슈 처리 계획을 확인합니다.',
        },
        {
          name: '🔄 워크플로우 (n8n)',
          value: '`/n8n` - n8n 서버 헬스체크 및 워크플로우를 관리합니다.',
        }
      )
      .setFooter({
        text: 'Sonagi Ops Bot | 슬래시(/)를 입력해 자동완성을 확인해보세요!',
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
