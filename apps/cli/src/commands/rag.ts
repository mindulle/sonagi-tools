import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const SCRIPTS_DIR = '/home/ubuntu/sonagi-playgrounds/scripts';
const RAG_API_URL = process.env.SONAGI_RAG_URL || 'http://100.91.9.83:13888/v0/search';

export const ragCommand = new Command('rag').description(
  'Interact with Sonagi FAISS Vector RAG Engine'
);

ragCommand
  .command('search <query>')
  .option('-r, --remote', 'Force querying via remote Sonagi RAG HTTP Server')
  .description('Search the vault using Vector Retrieval + CrossEncoder Reranking')
  .action(async (query: string, options) => {
    console.log(chalk.bold.magenta(`\n🔎 Querying Vault RAG: "${query}"...\n`));
    const retrieverPath = path.join(SCRIPTS_DIR, 'wiki_retriever.py');

    if (fs.existsSync(retrieverPath) && !options.remote) {
      const child = spawn(
        '/home/ubuntu/.local/bin/uv',
        [
          'run',
          '--with',
          'faiss-cpu',
          '--with',
          'sentence-transformers',
          'python3',
          retrieverPath,
          query,
        ],
        { stdio: 'inherit' }
      );

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
  .command('status')
  .description('Check FAISS Vector Index and RAG server daemon status')
  .action(async () => {
    console.log(chalk.bold.cyan('\n📊 Checking Sonagi RAG & FAISS Status...\n'));
    try {
      const healthUrl = RAG_API_URL.replace('/v0/search', '/v0/health');
      const res = await axios.get(healthUrl, { timeout: 3000 });
      console.log(chalk.green(`• RAG API Server (13888): ONLINE (Version: ${res.data.version})`));
      console.log(chalk.green(`• FAISS In-Memory Loaded: ${res.data.faiss_loaded ? 'YES' : 'NO'}`));
      console.log(chalk.green(`• Total Vectors Cached: ${res.data.total_vectors}`));
    } catch (err: any) {
      console.log(chalk.red(`• RAG API Server: OFFLINE (${err.message})`));
    }

    try {
      const pm2Check = spawn('pm2', ['list'], { stdio: 'pipe' });
      let output = '';
      pm2Check.stdout.on('data', (d) => {
        output += d.toString();
      });
      pm2Check.on('exit', () => {
        const hasDaemon = output.includes('wiki-faiss-daemon');
        const hasServer = output.includes('sonagi_server_para');
        console.log(
          chalk.cyan(
            `• PM2 wiki-faiss-daemon: ${hasDaemon ? chalk.green('RUNNING') : chalk.red('STOPPED')}`
          )
        );
        console.log(
          chalk.cyan(
            `• PM2 sonagi_server_para: ${hasServer ? chalk.green('RUNNING') : chalk.red('STOPPED')}\n`
          )
        );
      });
    } catch (e: any) {
      console.log(chalk.gray(`(Could not query PM2: ${e.message})\n`));
    }
  });

ragCommand
  .command('index <files...>')
  .description('Incrementally index specific markdown file(s) into FAISS immediately')
  .action((files: string[]) => {
    console.log(chalk.bold.blue(`\n⚡ Incrementally indexing ${files.length} file(s)...\n`));
    const incScript = path.join(SCRIPTS_DIR, 'wiki_incremental_indexer.py');
    const child = spawn('python3', [incScript, ...files], { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(chalk.green('\n✅ Incremental indexing completed.'));
      } else {
        console.log(chalk.red(`\n❌ Incremental indexing failed with code ${code}`));
      }
    });
  });

ragCommand
  .command('rebuild')
  .option('-f, --full', 'Rebuild full index including deep curriculum & archives')
  .description('Rebuild FAISS Vector Index from markdown files')
  .action((options) => {
    const isFull = !!options.full;
    console.log(
      chalk.bold.blue(`\n⚡ Rebuilding FAISS Vector Index (${isFull ? 'FULL' : 'CORE'})...\n`)
    );
    const indexerPath = path.join(SCRIPTS_DIR, 'wiki_indexer.py');
    const args = [
      'run',
      '--with',
      'faiss-cpu',
      '--with',
      'sentence-transformers',
      '--with',
      'tqdm',
      'python3',
      indexerPath,
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
