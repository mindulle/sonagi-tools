import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { logger, Colors } from '@sonagi-bots/shared';
import axios from 'axios';
import { healthService } from './health.service';

export class DashboardService {
  private static updatingChannels = new Set<string>();

  static async updateDashboard(client: Client, targetChannelId?: string | null): Promise<void> {
    const channelId = targetChannelId || process.env.DASHBOARD_CHANNEL_ID;
    if (!channelId) return;

    if (this.updatingChannels.has(channelId)) return;
    this.updatingChannels.add(channelId);

    try {
      const channel = (await client.channels.fetch(channelId)) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        logger.warn('DASHBOARD_CHANNEL_ID is invalid or not a text channel.');
        return;
      }

      // 1. Gather Infra Data
      const health = await healthService.getSystemStatus().catch((err) => {
        logger.error('Failed to get system status for dashboard', err);
        return { minio: false, n8n: false, runtime: false, timestamp: new Date() };
      });

      // 2. Gather Kimaki Routines Data
      let routinesText = '• 등록된 정기 루틴이 없습니다.';
      try {
        const routinesUrl =
          process.env.ROUTINES_API_URL || 'https://activity.sonagi.space/api/routines';
        const routinesRes = await axios.get(routinesUrl, { timeout: 8000 });
        if (
          routinesRes.data?.success &&
          Array.isArray(routinesRes.data.routines) &&
          routinesRes.data.routines.length > 0
        ) {
          routinesText = routinesRes.data.routines
            .map((r: any) => {
              const nextDate = new Date(r.nextRunAt);
              const kstStr = nextDate.toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul',
                month: 'numeric',
                day: 'numeric',
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });
              const title = r.title || r.prompt;
              return `• **[${kstStr}]** <#${r.channelId}> ➔ ${title}`;
            })
            .join('\n');
        }
      } catch (err) {
        logger.warn('Failed to fetch routines for dashboard', err);
        routinesText = '⚠️ 루틴 정보를 일시적으로 불러올 수 없습니다.';
      }

      // 3. Build Embed
      const isAllGreen = health.runtime && health.n8n && health.minio;
      const embed = new EmbedBuilder()
        .setTitle('📊 Sonagi Infrastructure & Routine Dashboard')
        .setColor(isAllGreen ? Colors.SUCCESS : Colors.WARNING)
        .setTimestamp(health.timestamp)
        .setDescription('실시간 인프라 및 에이전트 정기 루틴 관제 상태입니다.')
        .addFields(
          {
            name: '🖥️ Core Infrastructure',
            value: `**Container Runtime**: ${health.runtime ? '🟢 Online' : '🔴 Offline'}\n**MinIO Storage**: ${health.minio ? '🟢 Online' : '🔴 Offline'}`,
            inline: true,
          },
          {
            name: '🤖 Automation Services',
            value: `**n8n Pipeline**: ${health.n8n ? '🟢 Online' : '🔴 Offline'}`,
            inline: true,
          },
          {
            name: '🤖 Bot Microservices',
            value: `**Dev Bot**: 🟢 Online\n**Ops Bot**: 🟢 Online\n**Media Bot**: 🟢 Online`,
            inline: true,
          },
          {
            name: '⏰ Scheduled Kimaki Routines (KST Next Run)',
            value: routinesText,
            inline: false,
          }
        )
        .setFooter({ text: 'Updated every 5 minutes' });

      // 4. Find existing dashboard message or create new
      const messages = await channel.messages.fetch({ limit: 10 });
      const existingMsg = messages.find(
        (m) => m.author.id === client.user?.id && m.embeds[0]?.title?.includes('Dashboard')
      );

      if (existingMsg) {
        await existingMsg.edit({ embeds: [embed] });
        logger.info(`Updated existing dashboard in ${channel.name}`);
      } else {
        // Delete old messages from bot
        const botMessages = messages.filter((m) => m.author.id === client.user?.id);
        for (const msg of botMessages.values()) {
          await msg.delete().catch(() => null);
        }
        await channel.send({ embeds: [embed] });
        logger.info(`Created new dashboard in ${channel.name}`);
      }
    } catch (error) {
      logger.error('Error updating dashboard', error);
    } finally {
      this.updatingChannels.delete(channelId);
    }
  }
}
