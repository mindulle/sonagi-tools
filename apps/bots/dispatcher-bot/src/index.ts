import axios from 'axios';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Observability: Sentry Initialization
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  beforeSend(event, _hint) {
    // Mask sensitive tokens
    const eventString = JSON.stringify(event);
    const token = process.env.PAPERCLIP_API_KEY;
    if (token && eventString.includes(token)) {
      return JSON.parse(eventString.replace(new RegExp(token, 'g'), '[FILTERED_TOKEN]'));
    }
    return event;
  },
});

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL || 'http://localhost:3100/api';
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY || ''; // If required
const PAPERCLIP_COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || '3fa0dfa2-9f91-4002-8012-ac598bbb4761';
const OPENHANDS_API_URL = process.env.OPENHANDS_API_URL || 'http://100.82.121.40:3000/api'; // devops machine

const POLL_INTERVAL_MS = 60 * 1000; // 1 minute
const TASKS_FILE = path.resolve(__dirname, 'active_tasks.json');

// Helper to read/write active tasks
function getActiveTasks(): Record<string, string> {
  if (fs.existsSync(TASKS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
    } catch (e) {
      console.error('[Dispatcher] Error reading active tasks file:', e);
    }
  }
  return {};
}

function saveActiveTask(issueId: string, conversationId: string) {
  const tasks = getActiveTasks();
  tasks[issueId] = conversationId;
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

function removeActiveTask(issueId: string) {
  const tasks = getActiveTasks();
  delete tasks[issueId];
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

async function checkActiveTasks() {
  const tasks = getActiveTasks();
  const issueIds = Object.keys(tasks);
  
  if (issueIds.length === 0) return;
  console.log(`[Dispatcher] Checking status for ${issueIds.length} active OpenHands task(s)...`);

  for (const issueId of issueIds) {
    const conversationId = tasks[issueId];
    try {
      // Check conversation status
      const response = await axios.get(`${OPENHANDS_API_URL}/conversations/${conversationId}`, {
        timeout: 10000,
        headers: {
          ...(process.env.OPENHANDS_API_KEY ? { Authorization: `Bearer ${process.env.OPENHANDS_API_KEY}` } : {})
        }
      });
      
      const status = response.data?.conversation_status || response.data?.status;
      if (status === 'STOPPED' || status === 'FINISHED') {
        console.log(`[Dispatcher] Conversation ${conversationId} finished. Marking issue ${issueId} as done.`);
        // Mark issue as done
        await axios.patch(`${PAPERCLIP_API_URL}/issues/${issueId}`, {
          status: 'done'
        }, {
          timeout: 5000,
          headers: { Authorization: `Bearer ${PAPERCLIP_API_KEY}` }
        });
        removeActiveTask(issueId);
      }
    } catch (error: any) {
      console.error(`[Dispatcher] Failed to check status for conversation ${conversationId}:`, error?.response?.data || error.message);
    }
  }
}

async function pollPaperclipQueue() {
  console.log('[Dispatcher] Polling Paperclip for To-Do issues...');
  try {
    // 1. Fetch To Do issues labeled 'openhands'
    const response = await axios.get(`${PAPERCLIP_API_URL}/companies/${PAPERCLIP_COMPANY_ID}/issues`, {
      headers: { Authorization: `Bearer ${PAPERCLIP_API_KEY}` },
      params: { 
        status: 'todo',
        label: 'openhands'
      }
    });

    const issues = response.data || [];
    console.log(`[Dispatcher] Found ${issues.length} 'todo' issues for OpenHands.`);

    for (const issue of issues) {
      console.log(`[Dispatcher] Found Issue ${issue.identifier}: ${issue.title}`);

      // 2. Dispatch to OpenHands
      try {
        console.log(`[Dispatcher] Dispatching ${issue.identifier} to OpenHands...`);
        const ohResponse = await axios.post(`${OPENHANDS_API_URL}/conversations`, {
          initial_user_msg: `Issue ${issue.identifier}: ${issue.title}\n\n${issue.description}`
        }, {
          timeout: 10000,
          headers: { 
            ...(process.env.OPENHANDS_API_KEY ? { Authorization: `Bearer ${process.env.OPENHANDS_API_KEY}` } : {})
          }
        });

        const conversationId = ohResponse.data?.conversation_id || ohResponse.data?.id;
        if (!conversationId) {
          throw new Error('No conversation ID returned from OpenHands');
        }

        // Save mapping
        saveActiveTask(issue.id, conversationId);

        // 3. Mark issue as in_progress and assign to human to avoid bot interception
        console.log(`[Dispatcher] Marking ${issue.identifier} as in_progress...`);
        await axios.patch(`${PAPERCLIP_API_URL}/issues/${issue.id}`, {
          status: 'in_progress',
          assigneeUserId: issue.createdByUserId || 'DsiBvgqTrJMAzDuHz3jA9NrBtHwGQaYW'
        }, {
          timeout: 5000,
          headers: { Authorization: `Bearer ${PAPERCLIP_API_KEY}` }
        });
        
        console.log(`[Dispatcher] Successfully dispatched ${issue.identifier} (Conversation: ${conversationId}).`);
      } catch (dispatchError: any) {
        console.error(`[Dispatcher] Failed to dispatch ${issue.identifier}:`, dispatchError?.response?.data || dispatchError.message);
        Sentry.captureException(dispatchError);
      }
    }
  } catch (error: any) {
    console.error('[Dispatcher] Error polling Paperclip API:', error?.response?.data || error.message);
    Sentry.captureException(error);
  }
}

// Main Loop
console.log('🚀 OpenHands PM2 Dispatcher Bot Started!');
setInterval(() => {
  void pollPaperclipQueue();
  void checkActiveTasks();
}, POLL_INTERVAL_MS);

// Run immediately on start
void (async () => {
  await pollPaperclipQueue();
  await checkActiveTasks();
})();
