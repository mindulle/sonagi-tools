import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors } from '@sonagi-bots/shared';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('도움말')
    .setDescription('Sonagi Media 봇에서 사용할 수 있는 명령어 목록과 사용법을 보여줍니다.'),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle('🎨 Sonagi Media 명령어 가이드')
      .setDescription('미디어 에셋 및 오디오 재생을 지원하는 Media 봇의 명령어 목록입니다.')
      .setThumbnail(interaction.client.user?.displayAvatarURL() || null)
      .addFields(
        {
          name: '📦 CDN & 스토리지',
          value: '`/cdn` - MinIO 스토리지 버킷 및 로컬 CDN을 제어하고 에셋을 업로드합니다.',
        },
        {
          name: '📻 라디오 & 오디오',
          value: '`/radio` - 음성 채널에서 팟캐스트, 라디오 스트림 등을 재생합니다.',
        }
      )
      .setFooter({
        text: 'Sonagi Media Bot | 슬래시(/)를 입력해 자동완성을 확인해보세요!',
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
