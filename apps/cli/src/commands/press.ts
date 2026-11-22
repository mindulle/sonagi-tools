import { Command } from 'commander';
import { spawn } from 'child_process';

/**
 * Sonagi Press — 렌더·납품 엔진(Python) 위임.
 *
 * 이 명령은 옵션을 해석하지 않는다. `sonagi press ...` 뒤의 인자를
 * 그대로 press 프로세스에 넘기고, 종료 코드와 시그널만 전달한다.
 */
export const pressCommand = new Command('press')
  .description('Sonagi Press — deterministic design & delivery engine (delegates to press)')
  .helpOption(false)
  .passThroughOptions()
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .argument('[args...]')
  .action((args: string[]) => {
    const bin = process.env.PRESS_BIN || 'press';
    const child = spawn(bin, args, { stdio: 'inherit', shell: false });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        console.error(
          'press를 찾을 수 없습니다. sonagi-assets의 press를 PATH에 두거나 PRESS_BIN을 지정하세요.'
        );
        process.exit(2);
      }
      console.error(err.message);
      process.exit(1);
    });

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.on(signal, () => child.kill(signal));
    }

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 1);
    });
  });
