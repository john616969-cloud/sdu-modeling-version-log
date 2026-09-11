import { describe, expect, it } from 'vitest';
import { CHUNK_MANIFEST_FORMAT, MAX_UPLOAD_BYTES, UPLOAD_CHUNK_BYTES, parseChunkManifest, splitUploadChunks } from '@/lib/upload';

describe('large upload helpers', () => {
  it('splits bytes into 5 MiB chunks without copying the content', () => {
    const bytes = new Uint8Array(UPLOAD_CHUNK_BYTES * 2 + 7);
    const chunks = splitUploadChunks(bytes);
    expect(chunks.map((chunk) => chunk.byteLength)).toEqual([UPLOAD_CHUNK_BYTES, UPLOAD_CHUNK_BYTES, 7]);
    chunks[0][0] = 9;
    expect(bytes[0]).toBe(9);
  });

  it('accepts a valid manifest and rejects inconsistent sizes', () => {
    const valid = { format: CHUNK_MANIFEST_FORMAT, original_name: '代码.zip', size_bytes: 6, sha256: 'a'.repeat(64), chunks: [{ path: 'chunks/123e4567-e89b-12d3-a456-426614174000/part-00001', size_bytes: 6 }] };
    expect(parseChunkManifest(new TextEncoder().encode(JSON.stringify(valid)))?.original_name).toBe('代码.zip');
    expect(() => parseChunkManifest(new TextEncoder().encode(JSON.stringify({ ...valid, size_bytes: 7 })))).toThrow('文件大小不一致');
  });

  it('keeps the configured maximum at exactly 50 MiB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(50 * 1024 * 1024);
  });
});
