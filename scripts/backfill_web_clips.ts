import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '/home/ubuntu/sonagi-tools/.env' });

const TOKEN = process.env.OPS_BOT_TOKEN;
const CHANNEL_ID = process.env.WEB_CLIP_CHANNEL_ID || '1519250071764336650';
const INBOX_DIR = '/home/ubuntu/llm-wiki/10_Sources/Inbox';

if (!TOKEN) {
  console.error('OPS_BOT_TOKEN is missing');
  process.exit(1);
}

fs.mkdirSync(INBOX_DIR, { recursive: true });

// Read existing files in Inbox to index existing message_ids or filenames
const existingFiles = fs.readdirSync(INBOX_DIR).filter((f) => f.endsWith('.md'));
const existingMessageIds = new Set<string>();

for (const file of existingFiles) {
  try {
    const content = fs.readFileSync(path.join(INBOX_DIR, file), 'utf-8');
    const match = content.match(/message_id:\s*["']?(\d+)["']?/);
    if (match) {
      existingMessageIds.add(match[1]);
    }
  } catch {}
}

console.log(`Loaded ${existingFiles.length} existing file(s) from ${INBOX_DIR}`);
console.log(`Indexed ${existingMessageIds.size} existing message_id(s)`);

const rest = new REST().setToken(TOKEN);

function sanitizeTitle(str: string): string {
  return str
    .replace(/[^\w\s\uAC00-\uD7A3-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 50) || 'clip';
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  return {
    prefix: `${year}-${month}-${day}-${hours}${minutes}${seconds}`,
    created: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
  };
}

async function backfillAllClips() {
  console.log(`\nStarting full historical backfill from channel: ${CHANNEL_ID}...`);
  let allMessages: any[] = [];
  let before: string | undefined = undefined;

  // 1. Fetch entire history with pagination
  while (true) {
    const query = new URLSearchParams({ limit: '100' });
    if (before) query.set('before', before);

    const msgs: any = await rest.get(Routes.channelMessages(CHANNEL_ID), { query });
    if (!msgs || msgs.length === 0) break;

    allMessages.push(...msgs);
    before = msgs[msgs.length - 1].id;
    process.stdout.write(`\rFetched ${allMessages.length} total messages...`);
    if (msgs.length < 100) break;
  }
  console.log(`\n\nFetched all ${allMessages.length} messages from Discord! Processing...`);

  // 2. Filter valid clips
  const ignoreAuthors = new Set(['Sonagi Ops', 'Backend Manager', 'llm-wiki']);
  const clips = allMessages.filter((m) => {
    if (ignoreAuthors.has(m.author.username)) return false;
    if (m.content?.startsWith('✅') || m.content?.startsWith('❌')) return false;
    const hasContent = !!m.content?.trim();
    const hasEmbeds = m.embeds && m.embeds.length > 0;
    const hasAttachments = m.attachments && m.attachments.length > 0;
    return hasContent || hasEmbeds || hasAttachments;
  });

  // Sort chronologically (oldest to newest)
  clips.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log(`Found ${clips.length} valid clips to process out of ${allMessages.length} total messages.\n`);

  let addedCount = 0;
  let skippedCount = 0;

  for (const m of clips) {
    if (existingMessageIds.has(m.id)) {
      skippedCount++;
      continue;
    }

    const embed = m.embeds?.[0];
    const urlMatch = m.content?.match(/https?:\/\/[^\s]+/);
    const url = embed?.url || (urlMatch ? urlMatch[0] : '');

    // Title resolution
    let title = embed?.title || '';
    if (!title && url) {
      try {
        const parsed = new URL(url);
        title = `Clip from ${parsed.hostname}`;
      } catch {
        title = m.content.substring(0, 40);
      }
    }
    if (!title) {
      title = m.content.substring(0, 40) || 'Untitled Web Clip';
    }

    // Clean title for display & filename
    title = title.replace(/\n+/g, ' ').trim();
    const safeTitle = sanitizeTitle(title);

    const { prefix, created } = formatDate(m.timestamp);
    const filename = `${prefix}_${safeTitle}.md`;
    const targetPath = path.join(INBOX_DIR, filename);

    // If file already exists on disk, skip
    if (fs.existsSync(targetPath)) {
      skippedCount++;
      existingMessageIds.add(m.id);
      continue;
    }

    // Body content
    let body = m.content || '';
    if (embed?.description) {
      body += `\n\n> **Description:** ${embed.description}`;
    }
    if (m.attachments?.length > 0) {
      body += '\n\n**Attachments:**\n' + m.attachments.map((a: any) => `- [${a.name}](${a.url})`).join('\n');
    }

    const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
author: "${m.author.username}"
type: web-clip
created: ${created}
source: "Discord Web Clip"
source_url: "${url}"
tags: ["inbox", "web-clip", "discord-clip"]
status: unprocessed
message_id: "${m.id}"
---

# ${title}

${body.trim()}
`;

    fs.writeFileSync(targetPath, frontmatter, 'utf-8');
    existingMessageIds.add(m.id);
    addedCount++;

    if (addedCount % 50 === 0) {
      console.log(`Saved ${addedCount} clips so far...`);
    }
  }

  console.log(`\n========================================`);
  console.log(`🎉 Backfill Complete!`);
  console.log(`  • Total messages analyzed: ${allMessages.length}`);
  console.log(`  • Total valid clips: ${clips.length}`);
  console.log(`  • Newly created files: ${addedCount}`);
  console.log(`  • Already existed (skipped): ${skippedCount}`);
  console.log(`========================================\n`);
}

backfillAllClips().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});
