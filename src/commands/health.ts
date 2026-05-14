import { Command } from 'commander';
import { logger } from '../utils/logger';
import { createSpinner } from '../ui/spinner';

export const registerHealthCommand = (program: Command) => {
  program
    .command('health <target>')
    .description('Show health status for pods or containers')
    .action(async (target) => {
      const spinner = createSpinner(`Checking health for ${target}...`).start();
      try {
        // TODO: Implement actual health check logic
        spinner.stop(`Health check for ${target} complete`);
        logger.info(`Showing health for ${target}...`);
      } catch (error) {
        const errorMessage = (error as Error).message;
        spinner.fail(`Health check for ${target} failed: ${errorMessage}`);
        logger.error(`Health check for ${target} failed: ${errorMessage}`, error);
        throw error;
      }
    });
};
