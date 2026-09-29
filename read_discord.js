const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('ready', async () => {
  try {
    const channel = await client.channels.fetch('1528620974948225095');
    const messages = await channel.messages.fetch({ limit: 5 });
    messages.forEach(msg => {
      console.log(`[${msg.author.username}] ${msg.content}`);
      if (msg.embeds.length > 0) {
        console.log(`Embeds:`, JSON.stringify(msg.embeds, null, 2));
      }
    });
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
});

client.login(process.env.OPS_BOT_TOKEN);
