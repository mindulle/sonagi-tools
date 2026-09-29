/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import axios from 'axios';

// API call to fetch all workflows
async function getAllWorkflows(): Promise<any[]> {
  const apiUrl = process.env.N8N_API_URL?.replace(/\/$/, '');
  const apiKey = process.env.N8N_API_KEY;
  if (!apiUrl || !apiKey) throw new Error('N8N configuration missing.');

  const response = await axios.get(`${apiUrl}/api/v1/workflows`, {
    headers: {
      'X-N8N-API-KEY': apiKey,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    params: { limit: 250 },
    timeout: 10000,
  });
  return response.data?.data || [];
}

export const infraCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('infra')
    .setDescription('인프라 맵을 생성하여 디스코드 웹훅과 n8n 워크플로우 간의 연결을 확인합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      if (!interaction.guild) {
        throw new Error('이 명령어는 서버 내에서만 사용할 수 있습니다.');
      }

      // Fetch Discord Webhooks
      const webhooksCollection = await interaction.guild.fetchWebhooks();
      const webhooks = Array.from(webhooksCollection.values());

      // Fetch active n8n workflows
      const allWorkflows = await getAllWorkflows();
      const activeWorkflows = allWorkflows.filter((wf: any) => wf.active);

      // Map webhooks
      const webhookMap: Record<string, any> = {};

      for (const wh of webhooks) {
        if (!wh.channelId) continue;

        let category = 'ORPHAN';
        const creator = wh.owner?.username || 'Unknown';

        if (!wh.applicationId && wh.name.includes(' #')) {
          category = 'FOLLOW';
        } else if (wh.applicationId) {
          category = 'BOT';
        }

        webhookMap[wh.id] = {
          name: wh.name,
          channelId: wh.channelId,
          category,
          creator,
          workflows: [],
        };
      }

      // Match workflows
      for (const wf of activeWorkflows) {
        const nodesStr = JSON.stringify(wf.nodes || []);
        for (const whId in webhookMap) {
          if (nodesStr.includes(whId)) {
            webhookMap[whId].category = 'N8N';
            webhookMap[whId].workflows.push(wf.name);
          }
        }
      }

      // Build text lists
      const n8nList: string[] = [];
      const botList: string[] = [];
      const followList: string[] = [];
      const orphanList: string[] = [];

      for (const [, data] of Object.entries(webhookMap)) {
        const channelMention = `<#${data.channelId}>`;

        if (data.category === 'N8N') {
          for (const wfName of data.workflows) {
            n8nList.push(`- ⚙️ \`${wfName}\`\n  ➔ ${channelMention} (via \`${data.name}\`)`);
          }
        } else if (data.category === 'BOT') {
          botList.push(`- 🤖 \`${data.creator}\` ➔ ${channelMention} (via \`${data.name}\`)`);
        } else if (data.category === 'FOLLOW') {
          followList.push(`- 🌐 \`${data.name}\` ➔ ${channelMention}`);
        } else {
          orphanList.push(`- 🔴 **${data.name}** (${data.creator}) ➔ ${channelMention}`);
        }
      }

      let description = '';
      if (n8nList.length > 0) description += `**✅ n8n 파이프라인**\n${n8nList.join('\n')}\n\n`;
      if (botList.length > 0) description += `**🤖 봇 스크립트**\n${botList.join('\n')}\n\n`;
      if (followList.length > 0)
        description += `**📡 커뮤니티 피드**\n${followList.join('\n')}\n\n`;

      let embedColor: number = Colors.SUCCESS;
      if (orphanList.length > 0) {
        description += `**⚠️ 유령 웹훅 (정리 요망)**\n${orphanList.join('\n')}`;
        embedColor = Colors.ERROR;
      } else {
        description += `**✨ 유령 웹훅 0개 — 클린!**`;
      }

      const embed = new EmbedBuilder()
        .setTitle('🗺️ Discord 인프라 연동 명세서')
        .setDescription(description)
        .setColor(embedColor)
        .setFooter({
          text: `Auto-Mapper | 활성 워크플로우 ${activeWorkflows.length}개 · 웹훅 ${webhooks.length}개 스캔`,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      await interaction.editReply({
        embeds: [createErrorEmbed(`인프라 스캔 실패: ${error.message}`)],
      });
    }
  },
};
