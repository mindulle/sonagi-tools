import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import http from 'http';

export const infraCommand = new Command('infra').description(
  'Monitor Sonagi System Infrastructure & Daemons'
);

function checkHttp(port: number, path = '/'): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path, timeout: 2000 }, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

infraCommand
  .command('status')
  .description('Check health of PM2 services, RAG API, and Network bridges')
  .action(async () => {
    console.log(chalk.bold.cyan('\n🌐 Sonagi Infrastructure Health Check\n'));

    // Check RAG API (port 13888)
    const ragHealthy = await checkHttp(13888, '/v0/health');
    console.log(
      `  • Sonagi RAG Server (13888) : ${ragHealthy ? chalk.green('● ACTIVE') : chalk.red('○ DOWN')}`
    );

    // Check PM2
    try {
      const pm2Bin = execSync(
        'which pm2 2>/dev/null || echo "/home/ubuntu/.nvm/versions/node/v24.18.0/bin/pm2"',
        { encoding: 'utf-8' }
      ).trim();
      const pm2Out = execSync(`${pm2Bin} jlist`, { encoding: 'utf-8' });
      const jsonStart = pm2Out.indexOf('[');
      if (jsonStart !== -1) {
        const pm2List = JSON.parse(pm2Out.substring(jsonStart));
        console.log(chalk.bold('\n⚙️ PM2 Daemons:'));
        for (const proc of pm2List) {
          const isOnline = proc.pm2_env.status === 'online';
          const statusBadge = isOnline
            ? chalk.green('● ONLINE')
            : chalk.red(`○ ${proc.pm2_env.status.toUpperCase()}`);
          console.log(
            `    - ${chalk.bold(proc.name.padEnd(20))} : ${statusBadge} (pid: ${proc.pid}, uptime: ${Math.round(proc.pm2_env.pm_uptime ? (Date.now() - proc.pm2_env.pm_uptime) / 3600000 : 0)}h)`
          );
        }
      }
    } catch (e: any) {
      console.log(chalk.yellow(`  • PM2 status check failed: ${e.message}`));
    }

    console.log('');
  });
