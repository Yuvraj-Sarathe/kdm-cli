/**
 * Cache system interfaces for storing and retrieving AI explanation results.
 * Supports multiple backend implementations (file, memory, cloud storage).
 */

/** Configuration for initializing a cache provider. */
export interface CacheProviderConfig {
  /** Cache type identifier (e.g. 'file'). */
  type: string;
  /** Whether caching is enabled. */
  enabled: boolean;
  /** Local filesystem path for file-based cache. */
  path?: string;
  /** Cloud storage bucket name. */
  bucket?: string;
  /** Cloud storage region. */
  region?: string;
}

/** Represents a single cached entry with metadata. */
export interface CacheEntry {
  /** Cache key identifier. */
  key: string;
  /** ISO timestamp of when the entry was created. */
  createdAt?: string;
  /** Size of the cached data in bytes. */
  sizeBytes?: number;
}

/**
 * Interface for cache storage providers.
 * Implementations must handle errors gracefully for all operations.
 */
export interface CacheProvider {
  /** Provider name identifier. */
  name: string;
  /**
   * Configures the cache provider with the given settings.
   * @param config Cache configuration options.
   */
  configure(config: CacheProviderConfig): Promise<void>;
  /**
   * Stores a value under the given key.
   * @param key Cache key.
   * @param data String data to store.
   */
  store(key: string, data: string): Promise<void>;
  /**
   * Loads a value by key, returning null if not found.
   * @param key Cache key.
   * @returns The cached string data or null.
   */
  load(key: string): Promise<string | null>;
  /**
   * Lists all cached entries with metadata.
   * @returns Array of cache entry descriptors.
   */
  list(): Promise<CacheEntry[]>;
  /**
   * Removes a single cached entry by key.
   * @param key Cache key to remove.
   */
  remove(key: string): Promise<void>;
  /**
   * Checks whether a key exists in the cache.
   * @param key Cache key.
   * @returns True if the key exists.
   */
  exists(key: string): Promise<boolean>;
  /**
   * Removes all entries from the cache.
   */
  purge(): Promise<void>;
}
