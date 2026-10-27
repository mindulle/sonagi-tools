import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';

const INTEL_DIR = '/home/ubuntu/llm-wiki/00_System/scripts/intelligence_bot';

export const intelCommand = new Command('intel').description(
  'Orchestrate LangGraph Intelligence Bot'
);

intelCommand
  .command('run')
  .description('Trigger Market Intelligence LangGraph workflow and compile results into LLM-Wiki')
  .action(() => {
    console.log(chalk.bold.yellow('\n🤖 Dispatched LangGraph Market Intelligence Workflow...\n'));
    const runnerCode = `
import sys
import time
from graphs.market_intelligence_graph import graph

initial_state = {
    "targets": [],
    "raw_data": [],
    "analyzed_data": [],
    "errors": [],
    "status": "init"
}
config = {"configurable": {"thread_id": f"cli_run_{int(time.time())}"}}

print("Executing Phase 1: Dispatch -> Collect -> Analyze...", flush=True)
for event in graph.stream(initial_state, config=config):
    for node, state in event.items():
        print(f"  ✓ Node '{node}' completed.", flush=True)

print("Executing Phase 2: Resume to Loader...", flush=True)
for event in graph.stream(None, config=config):
    for node, state in event.items():
        print(f"  ✓ Node '{node}' completed.", flush=True)

print("\\nLangGraph Workflow Finished Successfully!", flush=True)
`;

    const child = spawn(
      '/home/ubuntu/.local/bin/uv',
      [
        'run',
        '--with',
        'langgraph',
        '--with',
        'langchain-openai',
        '--with',
        'pydantic',
        'python3',
        '-c',
        runnerCode,
      ],
      {
        cwd: INTEL_DIR,
        stdio: 'inherit',
      }
    );

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(
          chalk.green('\n✅ Market Intelligence successfully gathered and compiled into LLM-Wiki!')
        );
      } else {
        console.log(chalk.red(`\n❌ LangGraph exited with code ${code}`));
      }
    });
  });
