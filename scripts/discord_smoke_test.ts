import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });

const TOKEN = process.env.OPS_BOT_TOKEN;
const CHANNEL_ID =
  process.env.DISCORD_TEST_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID || '1564551822503579698'; // Default to active Discord thread

if (!TOKEN) {
  console.error('❌ Error: OPS_BOT_TOKEN is required to run Discord E2E smoke tests.');
  process.exit(1);
}

const isMockBackend = process.argv.includes('--mock-backend');
const isCleanup = process.argv.includes('--cleanup');

console.log('🧪 [Discord E2E Smoke Test Runner]');
console.log(`  • Channel ID: ${CHANNEL_ID}`);
console.log(`  • Backend Mode: ${isMockBackend ? 'MOCK (CI-Safe)' : 'LIVE (Tailscale / Backend)'}`);
console.log(`  • Auto-Cleanup: ${isCleanup ? 'Enabled' : 'Disabled'}\n`);

const rest = new REST().setToken(TOKEN);

// Dynamic import of command modules
const { ragCommand } = require('../apps/bots/ops-bot/dist/commands/rag/index.js');
const { researchCommand } = require('../apps/bots/ops-bot/dist/commands/research/index.js');

interface MockInteractionOptions {
  getString: (name: string) => string | null;
  getBoolean: (name: string) => boolean | null;
}

interface TestResult {
  command: string;
  success: boolean;
  messageId?: string;
  error?: string;
  durationMs: number;
}

function createInteraction(
  commandName: string,
  optionsMap: Record<string, any>,
  onMessageCreated: (msgId: string) => void
) {
  let messageId: string | null = null;

  return {
    commandName,
    user: { username: 'SmokeTestRunner' },
    options: {
      getString: (name: string) => optionsMap[name] || null,
      getBoolean: (name: string) => (optionsMap[name] !== undefined ? optionsMap[name] : null),
    } as MockInteractionOptions,

    deferReply: async () => {
      const res: any = await rest.post(Routes.channelMessages(CHANNEL_ID), {
        body: {
          content: `⏳ **[Smoke Test]** \`/${commandName}\` 실행 검증 중...`,
        },
      });
      messageId = res.id;
      if (messageId) {
        onMessageCreated(messageId);
      }
    },

    editReply: async ({ embeds }: { embeds: any[] }) => {
      if (!messageId) {
        throw new Error('editReply called before deferReply');
      }
      const serializedEmbeds = embeds.map((e) => (typeof e.toJSON === 'function' ? e.toJSON() : e));
      await rest.patch(Routes.channelMessage(CHANNEL_ID, messageId), {
        body: {
          content: `✅ **[Smoke Test Passed]** \`/${commandName}\` 정상 렌더링 검증 완료:`,
          embeds: serializedEmbeds,
        },
      });
    },
  };
}

async function runSmokeTests() {
  const createdMessageIds: string[] = [];
  const results: TestResult[] = [];

  // --- Test 1: /rag command ---
  const ragStart = Date.now();
  console.log('▶️ Testing /rag command...');
  try {
    const ragInteraction = createInteraction('rag', { query: '소나기 시스템' }, (id) =>
      createdMessageIds.push(id)
    );
    await ragCommand.execute(ragInteraction);
    const duration = Date.now() - ragStart;
    console.log(`  ✅ /rag command passed (${duration}ms)`);
    results.push({ command: 'rag', success: true, durationMs: duration });
  } catch (err: any) {
    const duration = Date.now() - ragStart;
    console.error(`  ❌ /rag command failed:`, err.message);
    results.push({ command: 'rag', success: false, error: err.message, durationMs: duration });
  }

  // Brief pause to prevent Discord API burst
  await new Promise((r) => setTimeout(r, 1500));

  // --- Test 2: /research command ---
  const researchStart = Date.now();
  console.log('▶️ Testing /research command...');
  try {
    const researchInteraction = createInteraction(
      'research',
      { query: 'Sonagi Architecture', save_to_inbox: false },
      (id) => createdMessageIds.push(id)
    );
    await researchCommand.execute(researchInteraction);
    const duration = Date.now() - researchStart;
    console.log(`  ✅ /research command passed (${duration}ms)`);
    results.push({ command: 'research', success: true, durationMs: duration });
  } catch (err: any) {
    const duration = Date.now() - researchStart;
    console.error(`  ❌ /research command failed:`, err.message);
    results.push({ command: 'research', success: false, error: err.message, durationMs: duration });
  }

  // --- Optional Auto-Cleanup ---
  if (isCleanup && createdMessageIds.length > 0) {
    console.log(`\n🧹 Cleaning up ${createdMessageIds.length} test message(s) in 5 seconds...`);
    await new Promise((r) => setTimeout(r, 5000));
    for (const id of createdMessageIds) {
      try {
        await rest.delete(Routes.channelMessage(CHANNEL_ID, id));
        console.log(`  🗑️ Deleted message ${id}`);
      } catch (e: any) {
        console.warn(`  ⚠️ Could not delete message ${id}: ${e.message}`);
      }
    }
  }

  // --- Summary Report ---
  console.log('\n========================================');
  console.log('📋 Discord E2E Smoke Test Summary');
  console.log('========================================');
  let allPassed = true;
  for (const r of results) {
    const badge = r.success ? '✅ PASS' : '❌ FAIL';
    console.log(
      `  • /${r.command.padEnd(10)} : ${badge} (${r.durationMs}ms) ${r.error ? `[Error: ${r.error}]` : ''}`
    );
    if (!r.success) allPassed = false;
  }
  console.log('========================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error('Fatal Smoke Test Error:', err);
  process.exit(1);
});
