export async function readBodyWithinLimit(stream, maxBytes) {
  if (!stream) return { body: null, tooLarge: false };

  const reader = stream.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { body: null, tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return { body: null, tooLarge: false };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new Blob([bytes]), tooLarge: false };
}
