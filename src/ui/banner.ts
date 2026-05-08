import chalk from 'chalk';

export const showWelcomeBanner = (version: string) => {
  const banner = `
  _  __ _____   __  __ 
 | |/ /|  __ \\ |  \\/  |
 | ' / | |  | || \\  / |
 |  <  | |  | || |\\/| |
 | . \\ | |__| || |  | |
 |_|\\_\\|_____/ |_|  |_|
`;
  
  console.log(chalk.cyan.bold(banner));
  console.log(chalk.blue.bold(` Welcome to Kubernetes & Docker Monitor v${version}\n`));
};
