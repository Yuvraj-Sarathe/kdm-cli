import { Command } from 'commander';
import { logger } from '../utils/logger';
import { createSpinner } from '../ui/spinner';

export const registerLogsCommand = (program: Command) => {
  program
    .command('logs <name>')
    .description('Show logs for a container or pod')
    .action(async (name) => {
      const spinner = createSpinner(`Fetching logs for ${name}...`).start();
      try {
        // TODO: Implement actual log fetching logic
        spinner.stop(`Logs for ${name} fetched`);
        logger.info(`Showing logs for ${name}...`);
      } catch (error) {
        spinner.fail(`Failed to fetch logs for ${name}: ${(error as Error).message}`);
      }
    });
};
