import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listEvents } from '../kubernetes/resources';

/** Event types that indicate problems. */
const WARNING_TYPE = 'Warning';

/**
 * Checks if an event represents a warning or error condition.
 * @param event The Event object.
 * @returns Array of failures found.
 */
const checkEventSeverity = (event: k8s.CoreV1Event): Failure[] => {
  if (event.type !== WARNING_TYPE) return [];
  const reason = event.reason ?? 'Unknown';
  const msg = event.message ?? '';
  return [{ text: `Warning event: ${reason}${msg ? ` - ${msg}` : ''}` }];
};

/**
 * Analyzer implementation focused on Kubernetes Events.
 * Reports only Warning-type events as potential issues.
 */
export const EventsAnalyzer: Analyzer = {
  name: 'Events',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listEvents(context);
    return resources.flatMap((event) => {
      const errors = checkEventSeverity(event);
      if (!errors.length) return [];
      const involvedName = event.involvedObject?.name ?? event.metadata?.name ?? 'unknown-event';
      const involvedKind = event.involvedObject?.kind ?? 'Event';
      return [{
        kind: 'Event',
        name: involvedName,
        namespace: event.metadata?.namespace ?? 'default',
        parentObject: involvedKind,
        errors,
      }];
    });
  },
};
