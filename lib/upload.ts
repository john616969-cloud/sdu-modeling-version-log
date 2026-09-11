export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const DIRECT_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_CHUNK_BYTES = 5 * 1024 * 1024;
export const CHUNK_MANIFEST_FORMAT = 'sdu-modeling-chunks-v1';

export type ChunkManifest = {
  format: typeof CHUNK_MANIFEST_FORMAT;
  original_name: string;
  size_bytes: number;
  sha256: string;
  chunks: Array<{ path: string; size_bytes: number }>;
};

export function splitUploadChunks(bytes: Uint8Array) {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += UPLOAD_CHUNK_BYTES) {
    chunks.push(bytes.subarray(offset, Math.min(offset + UPLOAD_CHUNK_BYTES, bytes.byteLength)));
  }
  return chunks;
}

export function parseChunkManifest(bytes: Uint8Array): ChunkManifest | null {
  if (bytes.byteLength > 64 * 1024 || bytes[0] !== 0x7b) return null;
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { return null; }
  if (!value || typeof value !== 'object' || (value as { format?: unknown }).format !== CHUNK_MANIFEST_FORMAT) return null;
  const manifest = value as Partial<ChunkManifest>;
  if (typeof manifest.original_name !== 'string' || !manifest.original_name || manifest.original_name.length > 255) throw new Error('分片清单中的文件名无效。');
  if (!Number.isInteger(manifest.size_bytes) || (manifest.size_bytes ?? 0) <= 0 || (manifest.size_bytes ?? 0) > MAX_UPLOAD_BYTES) throw new Error('分片清单中的文件大小无效。');
  if (typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error('分片清单中的校验值无效。');
  if (!Array.isArray(manifest.chunks) || manifest.chunks.length < 1 || manifest.chunks.length > Math.ceil(MAX_UPLOAD_BYTES / UPLOAD_CHUNK_BYTES)) throw new Error('分片清单中的分片数量无效。');
  let total = 0;
  for (const chunk of manifest.chunks) {
    if (!chunk || typeof chunk.path !== 'string' || !/^chunks\/[0-9a-f-]+\/part-\d{5}$/.test(chunk.path) || chunk.path.includes('..')) throw new Error('分片清单中的路径无效。');
    if (!Number.isInteger(chunk.size_bytes) || chunk.size_bytes <= 0 || chunk.size_bytes > UPLOAD_CHUNK_BYTES) throw new Error('分片清单中的分片大小无效。');
    total += chunk.size_bytes;
  }
  if (total !== manifest.size_bytes) throw new Error('分片清单中的文件大小不一致。');
  return manifest as ChunkManifest;
}
