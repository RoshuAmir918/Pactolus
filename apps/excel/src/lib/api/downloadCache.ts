const cache = new Map<string, { url: string; cachedAt: number }>();

// Pre-signed S3 URLs expire after 60 min — evict at 45 min to be safe
const TTL_MS = 45 * 60 * 1000;

export function getCachedDownloadUrl(documentId: string): string | null {
  const entry = cache.get(documentId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(documentId);
    return null;
  }
  return entry.url;
}

export function setCachedDownloadUrl(documentId: string, url: string): void {
  cache.set(documentId, { url, cachedAt: Date.now() });
}
