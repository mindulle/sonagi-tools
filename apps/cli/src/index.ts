import { Command } from 'commander';
import chalk from 'chalk';
import { wikiCommand } from './commands/wiki';
import { ragCommand } from './commands/rag';
import { intelCommand } from './commands/intel';
import { infraCommand } from './commands/infra';
import { researchCommand } from './commands/research';
import { pressCommand } from './commands/press';

const program = new Command();

program
  .enablePositionalOptions()
  .name('sonagi')
  .description(chalk.bold.blue('⚡ Sonagi Ecosystem Unified Orchestrator CLI'))
  .version('0.1.0');

// Register modular commands
program.addCommand(wikiCommand);
program.addCommand(ragCommand);
program.addCommand(intelCommand);
program.addCommand(infraCommand);
program.addCommand(researchCommand);
program.addCommand(pressCommand);

program.parse(process.argv);
