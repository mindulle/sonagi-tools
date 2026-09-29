/* eslint-disable */
import { Client, Events, Message } from 'discord.js';
import { logger } from '@sonagi-bots/shared';
import { EagleService } from '../services/eagle.service';

const DESIGN_CLIP_CHANNEL_ID = process.env.DESIGN_CLIP_CHANNEL_ID || '1528620974948225095';

export function registerMessageCreateEvent(client: Client): void {
  client.on(Events.MessageCreate, (message: Message) => {
    void (async () => {
      if (message.author.id === client.user?.id) return;
      if (message.channelId === DESIGN_CLIP_CHANNEL_ID) {
        try {
          const imageUrls: string[] = [];
          message.attachments.forEach((attachment) => {
            if (attachment.contentType?.startsWith('image/')) imageUrls.push(attachment.url);
          });
          let msgToProcess = message;
          if (imageUrls.length === 0) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            try {
              msgToProcess = await message.fetch();
            } catch (err) {}
          }
          msgToProcess.embeds.forEach((embed) => {
            if (embed.image?.url) imageUrls.push(embed.image.url);
            else if (embed.thumbnail?.url) imageUrls.push(embed.thumbnail.url);
          });
          if (imageUrls.length === 0) return;

          let allSuccess = true;
          for (const url of imageUrls) {
            const success = await EagleService.saveImageToEagle(url, message.content);
            if (!success) allSuccess = false;
          }
          await message.react(allSuccess ? '✅' : '❌');
        } catch (error) {
          logger.error('Error processing design clip', error);
          await message.react('❌');
        }
      }
    })();
  });
}
