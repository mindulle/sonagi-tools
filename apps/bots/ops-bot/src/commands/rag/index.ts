import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import axios from 'axios';

const RAG_API_URL = process.env.SONAGI_RAG_URL || 'http://100.91.9.83:13888/v0/search';

export const ragCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('rag')
    .setDescription('Sonagi FAISS RAG 엔진을 통해 위키 지식 베이스를 의미 기반 벡터 검색합니다.')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('검색할 질문이나 키워드를 입력하세요')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);

    try {
      const response = await axios.post(
        RAG_API_URL,
        { query },
        { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
      );

      const data = response.data;
      if (data.status === 'error') {
        await interaction.editReply({
          embeds: [createErrorEmbed(`RAG 검색 에러: ${data.message || 'Unknown error'}`)],
        });
        return;
      }

      const context: string = data.context || '';
      const sources: string[] = data.sources || [];

      if (!context.trim() && sources.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setColor(Colors.WARNING)
          .setTitle(`🔎 RAG 검색: "${query}"`)
          .setDescription('일치하는 위키 문서를 찾지 못했습니다.')
          .setFooter({ text: 'Sonagi RAG Hub (port 13888)' })
          .setTimestamp();
        await interaction.editReply({ embeds: [emptyEmbed] });
        return;
      }

      const maxDescLength = 3500;
      const displayContext =
        context.length > maxDescLength
          ? context.substring(0, maxDescLength) + '\n\n...[내용 일부 생략됨]'
          : context;

      const embed = new EmbedBuilder()
        .setColor(Colors.PRIMARY)
        .setTitle(`🔎 Sonagi RAG 검색 결과`)
        .setDescription(`**질의:** \`${query}\`\n\n${displayContext || '내용 요약 없음'}`)
        .addFields({
          name: '📚 참조 문서 (Sources)',
          value: sources.length > 0 ? sources.map((s) => `• \`${s}\``).join('\n') : '없음',
        })
        .setFooter({ text: 'Sonagi FAISS Vector Engine (13888)' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      await interaction.editReply({
        embeds: [createErrorEmbed(`RAG 엔진 연결 실패: ${error.message}`)],
      });
    }
  },
};
