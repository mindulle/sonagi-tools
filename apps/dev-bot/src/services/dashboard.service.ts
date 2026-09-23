import { Client, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '@sonagi-bots/shared';
import { healthService } from './health.service';
import axios from 'axios';

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

      // 1. Get screenshot from Firecrawl (Hybrid View)
      // Fallback dashboard URL (LLM Ops Dashboard)
      const publicDashboardUrl = 'https://bi.sonagi.space/public/dashboard/83306f28-6513-41de-b7c2-3ee0555465bc';
      const firecrawlUrl = process.env.FIRECRAWL_API_URL || 'http://llmops-instance.tailb95307.ts.net:3002/v1/scrape';
      let screenshotBuffer: Buffer | null = null;

      try {
        const response = await axios.post(firecrawlUrl, {
          url: publicDashboardUrl,
          formats: ['screenshot'],
          waitFor: 5000
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer local-no-auth'
          },
          timeout: 15000
        });

        if (response.data?.success && response.data?.data?.screenshot) {
          const base64Data = response.data.data.screenshot.replace(/^data:image\/\w+;base64,/, '');
          screenshotBuffer = Buffer.from(base64Data, 'base64');
        }
      } catch (err: any) {
        logger.error('Failed to get dashboard screenshot via Firecrawl', err.message);
      }

      const files = [];
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📊 **Sonagi Infrastructure Dashboard**')
        .setDescription('실시간 인프라 및 마이크로서비스 대시보드 스냅샷입니다.')
        .setTimestamp();

      if (screenshotBuffer) {
        const attachment = new AttachmentBuilder(screenshotBuffer, { name: 'dashboard.png' });
        files.push(attachment);
        embed.setImage('attachment://dashboard.png');
      } else {
        // 스크린샷 획득 실패 시, 기존 텍스트(Health) 상태라도 임베드에 덧붙임
        const health = await healthService.getSystemStatus().catch(() => ({ minio: false, n8n: false, k3s: false }));
        embed.addFields(
          { name: '🖥️ Core Infra', value: `K3s: ${health.k3s ? '🟢' : '🔴'} | MinIO: ${health.minio ? '🟢' : '🔴'}`, inline: false },
          { name: '🤖 Automation', value: `n8n: ${health.n8n ? '🟢' : '🔴'}`, inline: false }
        );
      }

      // 2. ActionRow Button (Deep Dive)
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('🔍 딥다이브 (Metabase 이동)')
          .setStyle(ButtonStyle.Link)
          .setURL('https://bi.sonagi.space/dashboard/2')
      );

      // 3. Find existing dashboard message or create new
      const messages = await channel.messages.fetch({ limit: 10 });
      const existingMsg = messages.find(
        (m) =>
          m.author.id === client.user?.id &&
          m.embeds[0]?.title?.includes('Infrastructure Dashboard')
      );

      if (existingMsg) {
        await existingMsg.delete().catch(() => null); // Clear old attachments safely by deleting
      }

      // Delete other older messages from bot just to keep it clean
      const botMessages = messages.filter((m) => m.author.id === client.user?.id);
      for (const msg of botMessages.values()) {
        await msg.delete().catch(() => null);
      }

      await channel.send({ embeds: [embed], components: [row], files: files });
      logger.info(`Updated hybrid dashboard in ${channel.name}`);
      
    } catch (error) {
      logger.error('Error updating dashboard', error);
    } finally {
      this.updatingChannels.delete(channelId);
    }
  }
}
