import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const SCRIPTS_DIR = '/home/ubuntu/sonagi-playgrounds/scripts';
const RAG_API_URL = process.env.SONAGI_RAG_URL || 'http://100.91.9.83:13888/v0/search';

export const ragCommand = new Command('rag')
  .description('Interact with Sonagi FAISS Vector RAG Engine');

ragCommand
  .command('search <query>')
  .option('-r, --remote', 'Force querying via remote Sonagi RAG HTTP Server')
  .description('Search the vault using Vector Retrieval + CrossEncoder Reranking')
  .action(async (query: string, options) => {
    console.log(chalk.bold.magenta(`\n🔎 Querying Vault RAG: "${query}"...\n`));
    const retrieverPath = path.join(SCRIPTS_DIR, 'wiki_retriever.py');

    if (fs.existsSync(retrieverPath) && !options.remote) {
      const child = spawn('/home/ubuntu/.local/bin/uv', [
        'run',
        '--with', 'faiss-cpu',
        '--with', 'sentence-transformers',
        'python3',
        retrieverPath,
        query
      ], { stdio: 'inherit' });

      child.on('exit', (code) => {
        if (code !== 0) {
          console.log(chalk.red(`\nRAG search exited with code ${code}`));
        }
      });
    } else {
      // Remote API Fallback
      try {
        console.log(chalk.gray(`(Connecting to Sonagi RAG Hub at ${RAG_API_URL})`));
        const res = await axios.post(
          RAG_API_URL,
          { query },
          { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
        );

        if (res.data?.status === 'ok') {
          const sources = res.data.sources || [];
          console.log(chalk.green(`\nFound ${sources.length} relevant document(s):`));
          for (const s of sources) {
            console.log(`  • ${chalk.bold.cyan(s)}`);
          }
          console.log(chalk.bold('\n--- Retrieved Context ---'));
          console.log(res.data.context || 'No content snippet available.');
        } else {
          console.log(chalk.red(`RAG search error: ${res.data?.message}`));
        }
      } catch (err: any) {
        console.log(chalk.red(`Failed to connect to RAG server: ${err.message}`));
      }
    }
  });

ragCommand
  .command('rebuild')
  .option('-f, --full', 'Rebuild full index including deep curriculum & archives')
  .description('Rebuild FAISS Vector Index from markdown files')
  .action((options) => {
    const isFull = !!options.full;
    console.log(chalk.bold.blue(`\n⚡ Rebuilding FAISS Vector Index (${isFull ? 'FULL' : 'CORE'})...\n`));
    const indexerPath = path.join(SCRIPTS_DIR, 'wiki_indexer.py');
    const args = [
      'run',
      '--with', 'faiss-cpu',
      '--with', 'sentence-transformers',
      '--with', 'tqdm',
      'python3',
      indexerPath
    ];
    if (isFull) {
      args.push('--full');
    }

    const child = spawn('/home/ubuntu/.local/bin/uv', args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(chalk.green('\n✅ FAISS Vector Index rebuild completed.'));
      } else {
        console.log(chalk.red(`\n❌ Rebuilder exited with code ${code}`));
      }
    });
  });
