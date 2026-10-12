export function readBodyWithinLimit(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<{ body: Blob | null; tooLarge: boolean }>;
