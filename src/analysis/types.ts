import { AnalyzerResult } from '../analyzers/types';

export interface AnalysisOptions {
  filters?: string[];
  namespace?: string;
  labelSelector?: string;
  kubeconfig?: string;
  kubecontext?: string;
  output?: 'text' | 'json';
  maxConcurrency?: number;
  withStats?: boolean;
  withDocs?: boolean;
  signal?: AbortSignal;
  explain?: boolean;
  backend?: string;
  language?: string;
  anonymize?: boolean;
  customHeaders?: Record<string, string>;
  noCache?: boolean;
}

export interface AnalysisStats {
  analyzer: string;
  durationMs: number;
}

export interface AnalysisOutput {
  provider?: string;
  errors: string[];
  status: 'OK' | 'ProblemDetected';
  problems: number;
  results: AnalyzerResult[];
  stats?: AnalysisStats[];
}
export type AnalysisStatus = 'OK' | 'ProblemDetected';
export type AnalysisErrors = string[];
