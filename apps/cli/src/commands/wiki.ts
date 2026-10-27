import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

const VAULT_ROOT = process.env.VAULT_ROOT || '/home/ubuntu/llm-wiki';
const SCRIPTS_DIR = '/home/ubuntu/sonagi-playgrounds/scripts';

export const wikiCommand = new Command('wiki')
  .description('Manage and inspect LLM-Wiki knowledge base');

wikiCommand
  .command('status')
  .description('Show vault PARA statistics and sync health')
  .action(() => {
    console.log(chalk.bold.blue('\n📚 Sonagi LLM-Wiki Status\n'));
    console.log(chalk.gray(`Vault Root: ${VAULT_ROOT}`));

    const paraDirs = ['00_System', '01_Projects', '02_Areas', '03_Resources', '04_Archives', '10_Sources'];
    console.log(chalk.bold('\n📁 PARA Layer Inventory:'));
    for (const dir of paraDirs) {
      const fullPath = path.join(VAULT_ROOT, dir);
      if (fs.existsSync(fullPath)) {
        let count = 0;
        const countFiles = (p: string) => {
          const entries = fs.readdirSync(p, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                countFiles(path.join(p, entry.name));
              }
            } else if (entry.name.endsWith('.md')) {
              count++;
            }
          }
        };
        countFiles(fullPath);
        console.log(`  ${chalk.cyan(dir.padEnd(16))} : ${chalk.yellow(count.toString().padStart(5))} markdown notes`);
      } else {
        console.log(`  ${chalk.gray(dir.padEnd(16))} : ${chalk.red('Not Found')}`);
      }
    }
    console.log('');
  });

wikiCommand
  .command('lint')
  .description('Run comprehensive vault linter for broken links and orphans')
  .action(() => {
    console.log(chalk.bold.green('\n🔍 Running Vault Linter...\n'));
    const linterPath = path.join(SCRIPTS_DIR, 'wiki_linter.py');
    const child = spawn('python3', [linterPath], { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(chalk.green('\n✅ Linting completed.'));
      } else {
        console.log(chalk.red(`\n❌ Linter exited with code ${code}`));
      }
    });
  });

const inboxSubCommand = wikiCommand
  .command('inbox')
  .description('Inspect and manage LLM-Wiki 10_Sources/Inbox');

inboxSubCommand
  .command('list')
  .description('List all unorganized notes and web clips in 10_Sources/Inbox')
  .action(() => {
    console.log(chalk.bold.yellow('\n📥 LLM-Wiki Inbox Notes (10_Sources/Inbox):\n'));
    const inboxPath = path.join(VAULT_ROOT, '10_Sources/Inbox');
    if (!fs.existsSync(inboxPath)) {
      console.log(chalk.gray('  Inbox folder does not exist.'));
      return;
    }
    const files = fs.readdirSync(inboxPath).filter((f) => f.endsWith('.md'));
    if (files.length === 0) {
      console.log(chalk.gray('  No pending clips or inbox notes found.'));
      return;
    }
    for (const f of files) {
      const stats = fs.statSync(path.join(inboxPath, f));
      console.log(`  • ${chalk.bold(f)} ${chalk.gray(`(${stats.size} bytes, ${stats.mtime.toLocaleDateString()})`)}`);
    }
    console.log(chalk.cyan(`\nTotal: ${files.length} item(s)\n`));
  });
