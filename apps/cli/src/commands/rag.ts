import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';

const SCRIPTS_DIR = '/home/ubuntu/sonagi-playgrounds/scripts';

export const ragCommand = new Command('rag')
  .description('Interact with Sonagi FAISS Vector RAG Engine');

ragCommand
  .command('search <query>')
  .description('Search the vault using Vector Retrieval + CrossEncoder Reranking')
  .action((query: string) => {
    console.log(chalk.bold.magenta(`\n🔎 Querying Vault RAG: "${query}"...\n`));
    const retrieverPath = path.join(SCRIPTS_DIR, 'wiki_retriever.py');
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
