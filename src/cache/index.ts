/**
 * Cache factory module that resolves the appropriate CacheProvider
 * based on the configured cache type.
 */

import type { CacheConfig } from '../config/schema';
import type { CacheProvider } from './types';
import { FileCacheProvider } from './file-cache';

/**
 * Creates and configures a CacheProvider based on the given cache configuration.
 * Currently supports the 'file' type only; additional providers can be added here.
 * @param config Cache configuration from the KDM config store.
 * @returns A configured CacheProvider instance.
 */
export function createCacheProvider(config: CacheConfig): CacheProvider {
  const provider = new FileCacheProvider();
  provider.configure({
    type: config.type,
    enabled: config.enabled,
    path: config.path,
  });
  return provider;
}

export type { CacheProvider, CacheEntry } from './types';
