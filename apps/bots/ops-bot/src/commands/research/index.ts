import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import axios from 'axios';

const SEARXNG_URL = process.env.SEARXNG_URL || 'http://100.91.9.83:8080';
const INBOX_API_URL = process.env.INBOX_API_URL || 'http://100.91.9.83:13888/v0/inbox';

interface SearxResult {
  title: string;
  url: string;
  content: string;
}

export const researchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('research')
    .setDescription('SearXNG + Jina Reader 파이프라인을 통해 외부 웹 심층 리서치를 수행합니다.')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('리서치할 주제나 질문을 입력하세요')
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName('save_to_inbox')
        .setDescription('결과를 llm-wiki Inbox(10_Sources/Inbox)에 자동 저장할지 여부 (기본: false)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    const saveToInbox = interaction.options.getBoolean('save_to_inbox') ?? false;

    try {
      // 1. Search SearXNG
      const searchUrl = `${SEARXNG_URL.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}&format=json`;
      const searchRes = await axios.get(searchUrl, { timeout: 10000 });
      const rawResults: SearxResult[] = searchRes.data?.results || [];

      const topResults = rawResults.slice(0, 3);
      if (topResults.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setColor(Colors.WARNING)
          .setTitle(`🌐 Web Research: "${query}"`)
          .setDescription('검색 결과를 찾지 못했습니다.')
          .setTimestamp();
        await interaction.editReply({ embeds: [emptyEmbed] });
        return;
      }

      // 2. Fetch page markdown via Jina Reader
      const sourceDetails: { title: string; url: string; snippet: string; fullContent: string }[] = [];
      for (const res of topResults) {
        let content = '';
        try {
          const jinaRes = await axios.get(`https://r.jina.ai/${res.url}`, {
            timeout: 10000,
            headers: { 'User-Agent': 'Sonagi-Ops-Bot/1.0' },
          });
          content = String(jinaRes.data || '');
        } catch {
          content = res.content || '페이지 본문 추출 실패';
        }

        const snippet = content.substring(0, 250).replace(/\n+/g, ' ');
        sourceDetails.push({
          title: res.title || res.url,
          url: res.url,
          snippet,
          fullContent: content.substring(0, 4000),
        });
      }

      // 3. Optionally Save to Inbox
      let savedFilename = '';
      if (saveToInbox) {
        try {
          const combinedMarkdown = sourceDetails
            .map(
              (s) =>
                `## [${s.title}](${s.url})\n\n${s.fullContent}\n\n---\n`
            )
            .join('\n');

          const inboxRes = await axios.post(
            INBOX_API_URL,
            {
              title: `Web Research: ${query}`,
              content: combinedMarkdown,
              author: interaction.user.username,
              source: 'Web Research (/research)',
              url: sourceDetails[0]?.url || '',
              tags: ['inbox', 'research', 'web-search'],
            },
            { timeout: 5000 }
          );

          if (inboxRes.data?.status === 'ok') {
            savedFilename = inboxRes.data.filename || '저장 성공';
          }
        } catch (err: any) {
          // Non-blocking error for save
        }
      }

      // 4. Build Discord Embed
      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(`🌐 Sonagi Web Research: "${query}"`)
        .setDescription(`상위 ${sourceDetails.length}개 웹 소스에서 정보를 수집하고 정제했습니다.`)
        .setTimestamp();

      for (const [idx, src] of sourceDetails.entries()) {
        embed.addFields({
          name: `${idx + 1}. ${src.title.substring(0, 100)}`,
          value: `🔗 [원문 링크](${src.url})\n> ${src.snippet}...`,
        });
      }

      if (saveToInbox) {
        embed.addFields({
          name: '📥 LLM-Wiki 적재 상태',
          value: savedFilename
            ? `✅ \`10_Sources/Inbox/${savedFilename}\`에 저장되었습니다.`
            : '⚠️ Inbox 저장 중 오류가 발생했으나 리서치 결과는 정상 수집되었습니다.',
        });
      }

      embed.setFooter({
        text: `SearXNG + Jina Reader Hub | Inbox: ${saveToInbox ? 'Enabled' : 'Disabled'}`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      await interaction.editReply({
        embeds: [createErrorEmbed(`웹 리서치 실행 실패: ${error.message}`)],
      });
    }
  },
};
