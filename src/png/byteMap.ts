import type { Analysis, ChunkEntry } from "./analyze";

export type Region = "signature" | "length" | "type" | "data" | "crc" | "trailing" | "unparsed";

export interface ByteLocation {
  region: Region;
  chunk?: ChunkEntry;
}

export const REGION_LABELS: Record<Region, string> = {
  signature: "PNG signature",
  length: "Length",
  type: "Chunk type",
  data: "Data",
  crc: "CRC-32",
  trailing: "Trailing data",
  unparsed: "Unparsed",
};

function findChunk(chunks: ChunkEntry[], offset: number): ChunkEntry | undefined {
  let lo = 0;
  let hi = chunks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = chunks[mid];
    if (offset < c.offset) hi = mid - 1;
    else if (offset >= c.end) lo = mid + 1;
    else return c;
  }
  return undefined;
}

export function locate(a: Analysis, offset: number): ByteLocation {
  if (offset < 8) return { region: "signature" };
  if (a.fatalError) return { region: "unparsed" };
  const chunk = findChunk(a.chunks, offset);
  if (!chunk) return { region: offset >= a.streamEnd ? "trailing" : "unparsed" };
  if (offset < chunk.offset + 4) return { region: "length", chunk };
  if (offset < chunk.dataOffset) return { region: "type", chunk };
  if (offset < chunk.crcOffset) return { region: "data", chunk };
  return { region: "crc", chunk };
}
