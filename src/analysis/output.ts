import { AnalysisOutput } from './types';
import { AnalyzerResult, Failure } from '../analyzers/types';
import chalk from 'chalk';

function redactSensitive(value: string, sensitive?: { unmasked: string; masked: string }[]): string {
  if (!sensitive?.length) return value;
  return sensitive.reduce(
    (acc, pair) => (pair.unmasked ? acc.split(pair.unmasked).join(pair.masked) : acc),
    value
  );
}

function formatSummary(output: AnalysisOutput): string {
  if (output.status === 'OK') {
    return chalk.green('No problems detected');
  }
  return chalk.yellow(
    `Status: ProblemDetected (${output.problems} ${output.problems === 1 ? 'problem' : 'problems'})`
  );
}

function formatWarnings(errors: string[]): string[] {
  return [
    '',
    chalk.yellow('Warnings / Errors:'),
    ...errors.map((err) => `- ${chalk.yellow(err)}`),
  ];
}

function formatFailure(failure: Failure): string[] {
  const lines: string[] = [];
  lines.push(`  - ${chalk.red('Error:')} ${chalk.red(redactSensitive(failure.text, failure.sensitive))}`);
  if (failure.kubernetesDoc) {
    lines.push(
      `    ${chalk.red('Kubernetes Doc:')} ${chalk.red(redactSensitive(failure.kubernetesDoc, failure.sensitive))}`
    );
  }
  return lines;
}

function formatResult(res: AnalyzerResult): string[] {
  const parentPart = res.parentObject ? `(${res.parentObject})` : '';
  const nsPart = res.namespace ? ` [${res.namespace}]` : '';
  const lines: string[] = [
    `- Name: ${chalk.yellow(res.name)}${nsPart} ${chalk.cyan(parentPart)}`.trim(),
    ...res.errors.flatMap(formatFailure),
  ];
  if (res.details) {
    lines.push(chalk.green(res.details));
  }
  return lines;
}

function formatResultGroups(results: AnalyzerResult[]): string[] {
  const grouped = new Map<string, AnalyzerResult[]>();
  for (const res of results) {
    const list = grouped.get(res.kind) || [];
    list.push(res);
    grouped.set(res.kind, list);
  }

  const lines: string[] = [''];
  for (const [kind, group] of grouped.entries()) {
    lines.push(`${chalk.cyan(kind)}s:`);
    lines.push(...group.flatMap(formatResult));
  }
  return lines;
}

function formatStats(stats: NonNullable<AnalysisOutput['stats']>): string[] {
  return [
    '',
    chalk.yellow(
      'The stats mode allows for debugging and understanding the time taken by an analysis by displaying the statistics of each analyzer.'
    ),
    ...stats.map((stat) => `- Analyzer ${chalk.yellow(stat.analyzer)} took ${stat.durationMs}ms`),
  ];
}

export function formatTextOutput(output: AnalysisOutput): string {
  const lines: string[] = [formatSummary(output)];

  if (output.provider) {
    lines.push(`AI Provider: ${chalk.yellow(output.provider)}`);
  }

  if (output.errors?.length) {
    lines.push(...formatWarnings(output.errors));
  }

  if (output.results?.length) {
    lines.push(...formatResultGroups(output.results));
  }

  if (output.stats?.length) {
    lines.push(...formatStats(output.stats));
  }

  return lines.join('\n');
}

export function formatJsonOutput(output: AnalysisOutput): string {
  return JSON.stringify(output, null, 2);
}
