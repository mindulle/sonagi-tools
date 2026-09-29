import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { logger, Colors } from '@sonagi-bots/shared';
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
        return { minio: false, n8n: false, k3s: false, timestamp: new Date() };
      });

      // 2. Build Embed
      const embed = new EmbedBuilder()
        .setTitle('📊 Sonagi Infrastructure Dashboard')
        .setColor(health.k3s && health.n8n && health.minio ? Colors.SUCCESS : Colors.WARNING)
        .setTimestamp(health.timestamp)
        .setDescription('실시간 인프라 및 마이크로서비스 상태입니다.')
        .addFields(
          {
            name: '🖥️ Core Infrastructure',
            value: `**K3s Cluster**: ${health.k3s ? '🟢 Online' : '🔴 Offline'}\n**MinIO Storage**: ${health.minio ? '🟢 Online' : '🔴 Offline'}`,
            inline: false,
          },
          {
            name: '🤖 Automation Services',
            value: `**n8n Pipeline**: ${health.n8n ? '🟢 Online' : '🔴 Offline'}`,
            inline: false,
          },
          {
            name: '🤖 Bot Microservices',
            value: `**Dev Bot**: 🟢 Online\n**Ops Bot**: 🟢 Online (Assumed)\n**Media Bot**: 🟢 Online (Assumed)`,
            inline: false,
          }
        )
        .setFooter({ text: 'Updated every 5 minutes' });

      // 3. Find existing dashboard message or create new
      const messages = await channel.messages.fetch({ limit: 10 });
      const existingMsg = messages.find(
        (m) =>
          m.author.id === client.user?.id &&
          m.embeds[0]?.title?.includes('Infrastructure Dashboard')
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
