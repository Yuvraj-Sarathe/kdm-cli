// import { Command } from 'commander';
// import { logger } from '../utils/logger';
// import { createSpinner } from '../ui/spinner';

// export const registerHealthCommand = (program: Command) => {
//   program
//     .command('health <target>')
//     .description('Show health status for pods or containers')
//     .action(async (target) => {
//       const spinner = createSpinner(`Checking health for ${target}...`).start();
//       try {
//         // TODO: Implement actual health check logic
//         spinner.stop(`Health check for ${target} complete`);
//         logger.info(`Showing health for ${target}...`);
//       } catch (error) {
//         const errorMessage = (error as Error).message;
//         spinner.fail(`Health check for ${target} failed: ${errorMessage}`);
//         logger.error(`Health check for ${target} failed: ${errorMessage}`, error);
//         throw error;
//       }
//     });
// };


// updated

import { Command } from 'commander';
import chalk from 'chalk';
import { getRunningContainers } from '../docker/containers';
import { getRunningPods } from '../kubernetes/pods';
import { logger } from '../utils/logger';
import { createSpinner } from '../ui/spinner';
import { renderTable } from '../ui/table';

export interface HealthOptions {
  watch?: boolean;
  interval?: string;
}

const healthColor = (status: string): string => {
  if (status === 'healthy' || status === 'running' || status === 'Running') {
    return chalk.green(status);
  }
  if (status === 'unhealthy' || status === 'exited' || status === 'Failed') {
    return chalk.red(status);
  }
  return chalk.yellow(status);
};

const fetchHealthRows = async (target: string): Promise<(string | number)[][]> => {
  const rows: (string | number)[][] = [];

  if (target === 'all' || target === 'containers') {
    try {
      const containers = await getRunningContainers();
      rows.push(
        ...containers.map((container) => [
          'container',
          container.name,
          healthColor(container.state),
          container.status,
        ]),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn?.(`Docker unavailable: ${message}`);
    }
  }

  if (target === 'all' || target === 'pods') {
    try {
      const pods = await getRunningPods();
      rows.push(
        ...pods.map((pod) => [
          'pod',
          pod.name,
          healthColor(pod.status),
          `namespace: ${pod.namespace}, restarts: ${pod.restarts}`,
        ]),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn?.(`Kubernetes unavailable: ${message}`);
    }
  }

  return rows;
};

export const showHealth = async (target: string, options: HealthOptions = {}): Promise<void> => {
  logger.info?.(`Showing health for ${target}...`);

  const validTargets = ['all', 'containers', 'pods'];
  if (!validTargets.includes(target)) {
    logger.error?.(
      `Unknown target: ${target}. Valid targets are: ${validTargets.join(', ')}.`,
    );
    process.exitCode = 1;
    return;
  }

  if (options.watch) {
    const intervalSeconds = parseInt(options.interval || '5', 10);
    if (isNaN(intervalSeconds) || intervalSeconds <= 0) {
      logger.error?.('Invalid interval. Please provide a positive number of seconds.');
      process.exitCode = 1;
      return;
    }

    let isRunning = true;
    let timer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      isRunning = false;
      if (timer) {
        clearTimeout(timer);
      }
    };

    const sigintHandler = () => {
      cleanup();
      process.exit(0);
    };

    if (process.env.NODE_ENV !== 'test') {
      process.on('SIGINT', sigintHandler);
      process.on('SIGTERM', sigintHandler);
    }

    const poll = async () => {
      if (!isRunning) return;

      const rows = await fetchHealthRows(target);
      
      // Clear terminal screen
      process.stdout.write('\x1Bc');

      const timestamp = new Date().toLocaleTimeString();
      console.log(
        chalk.bold.cyan(`[KDM Health] Target: ${target} | Last updated: ${timestamp} (Interval: ${intervalSeconds}s)`)
      );
      console.log(chalk.dim('Press Ctrl+C to exit\n'));

      if (rows.length === 0) {
        logger.warn?.(`No ${target === 'all' ? 'workloads' : target} found.`);
      } else {
        renderTable({
          head: ['TYPE', 'NAME', 'HEALTH', 'DETAILS'],
          rows,
        });
      }

      if (isRunning) {
        timer = setTimeout(poll, intervalSeconds * 1000);
      }
    };

    await poll();
  } else {
    const spinner = createSpinner(`Checking ${target} health...`).start();
    const rows = await fetchHealthRows(target);
    spinner.stop();

    if (rows.length === 0) {
      logger.warn?.(`No ${target === 'all' ? 'workloads' : target} found.`);
      return;
    }

    renderTable({
      head: ['TYPE', 'NAME', 'HEALTH', 'DETAILS'],
      rows,
    });
  }
};

export const registerHealthCommand = (program: Command): void => {
  program
    .command('health <target>')
    .description(
      'Show health status for pods, containers, or all workloads.\n' +
      'Valid targets: all | containers | pods',
    )
    .option('-w, --watch', 'Watch mode: continuously refresh health output')
    .option('-i, --interval <number>', 'Refresh interval in seconds', '5')
    .action(async (target, options) => {
      await showHealth(target, options);
    });
};