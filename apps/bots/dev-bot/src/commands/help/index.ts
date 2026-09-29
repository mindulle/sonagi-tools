import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors } from '@sonagi-bots/shared';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('도움말')
    .setDescription('Sonagi Dev 봇에서 사용할 수 있는 명령어 목록과 사용법을 보여줍니다.'),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor(Colors.INFO)
      .setTitle('🛠️ Sonagi Dev 명령어 가이드')
      .setDescription('인프라 및 개발 유틸리티를 지원하는 Dev 봇의 명령어 목록입니다.')
      .setThumbnail(interaction.client.user?.displayAvatarURL() || null)
      .addFields(
        {
          name: '⚙️ 인프라 제어',
          value:
            '`/infra status` - 인프라 상태를 조회합니다.\n' +
            '`/infra deploy` - 서버 배포를 트리거합니다.\n' +
            '`/infra restart` - 특정 서비스를 재시작합니다.',
        },
        {
          name: '🧰 유틸리티',
          value: '`/utils` - 기타 개발 보조 유틸리티 명령어들을 제공합니다.',
        },
        {
          name: '🎮 Playgrounds',
          value: '`/play` - Sonagi Playgrounds 플랫폼과 상호작용합니다.',
        }
      )
      .setFooter({
        text: 'Sonagi Dev Bot | 슬래시(/)를 입력해 자동완성을 확인해보세요!',
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
