import {
  init,
  readChunks,
  PngError,
  type PngChunks,
  type PngHeader,
  type PngMetadata,
  type PngTransparency,
  type FrameControl,
} from "format-png";
import { crc32 } from "./crc32";
import { hex32 } from "./format";

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface ChunkEntry {
  index: number;
  type: string;
  /** Offset of the length field. */
  offset: number;
  length: number;
  dataOffset: number;
  crcOffset: number;
  /** One past the last CRC byte. */
  end: number;
  data: Uint8Array;
  storedCrc: number;
  computedCrc: number;
  crcValid: boolean;
  known: boolean;
  critical: boolean;
  public: boolean;
  /** Third letter uppercase, as the spec requires. */
  reservedValid: boolean;
  safeToCopy: boolean;
  /** For fcTL chunks: their position among the file's frame controls. */
  frameIndex?: number;
}

export type IssueLevel = "error" | "warning" | "info";

export interface Issue {
  level: IssueLevel;
  message: string;
  offset?: number;
  chunkIndex?: number;
}

export interface Analysis {
  fileName: string;
  fileSize: number;
  lastModified?: number;
  bytes: Uint8Array;
  signatureValid: boolean;
  /** Set when format-png could not read the chunk stream; only raw bytes are available then. */
  fatalError?: string;
  header?: PngHeader;
  palette?: [number, number, number][];
  transparency?: PngTransparency;
  metadata: PngMetadata;
  animationControl?: { numFrames: number; numPlays: number };
  frameControls: (FrameControl & { sequenceNumber: number })[];
  chunks: ChunkEntry[];
  /** Offset just after IEND's CRC, where trailing data begins. */
  streamEnd: number;
  trailingBytes: number;
  issues: Issue[];
  idatCount: number;
  idatBytes: number;
}

let ready: Promise<void> | undefined;
export const ensureInit = () => (ready ??= init());

export class NotPngError extends Error {}

export function hasPngSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

export async function analyzePng(
  bytes: Uint8Array,
  fileName: string,
  lastModified?: number,
): Promise<Analysis> {
  if (!hasPngSignature(bytes)) {
    throw new NotPngError(
      bytes.length < 8
        ? "The file is too small to be a PNG."
        : "This file doesn't start with the PNG signature (89 50 4E 47 0D 0A 1A 0A).",
    );
  }
  await ensureInit();

  const base: Analysis = {
    fileName,
    fileSize: bytes.length,
    lastModified,
    bytes,
    signatureValid: true,
    metadata: { text: [] },
    frameControls: [],
    chunks: [],
    streamEnd: 8,
    trailingBytes: 0,
    issues: [],
    idatCount: 0,
    idatBytes: 0,
  };

  let parsed: PngChunks;
  try {
    // CRCs are checked below, per chunk, so a single bad checksum doesn't hide the rest of the file.
    parsed = readChunks(bytes, { validateCrc: false });
  } catch (e) {
    const message = e instanceof PngError || e instanceof Error ? e.message : String(e);
    return {
      ...base,
      streamEnd: bytes.length,
      fatalError: message,
      issues: [{ level: "error", message: `format-png could not read the chunk stream: ${message}` }],
    };
  }

  const issues: Issue[] = [];
  let fcTL = 0;
  const chunks: ChunkEntry[] = parsed.chunks.map((c, index) => {
    const length = c.data.length;
    const dataOffset = c.offset + 8;
    const crcOffset = dataOffset + length;
    const computedCrc = crc32(bytes, c.offset + 4, crcOffset);
    const storedCrc = c.crc >>> 0;
    const entry: ChunkEntry = {
      index,
      type: c.type,
      offset: c.offset,
      length,
      dataOffset,
      crcOffset,
      end: crcOffset + 4,
      data: c.data,
      storedCrc,
      computedCrc,
      crcValid: computedCrc === storedCrc,
      known: c.known,
      critical: c.critical,
      public: c.public,
      reservedValid: c.type.charCodeAt(2) < 0x61,
      safeToCopy: c.safeToCopy,
    };
    if (c.type === "fcTL") entry.frameIndex = fcTL++;
    if (!entry.crcValid) {
      issues.push({
        level: "error",
        message: `${c.type} at ${hex32(c.offset)} has CRC ${hex32(storedCrc)}, expected ${hex32(computedCrc)}.`,
        offset: crcOffset,
        chunkIndex: index,
      });
    }
    if (!entry.reservedValid) {
      issues.push({
        level: "warning",
        message: `${c.type} has the reserved bit set (lowercase third letter).`,
        offset: c.offset + 4,
        chunkIndex: index,
      });
    }
    if (!c.known && c.critical) {
      issues.push({
        level: "error",
        message: `Unknown critical chunk ${c.type}: decoders must refuse this image.`,
        offset: c.offset,
        chunkIndex: index,
      });
    }
    return entry;
  });

  const last = chunks.at(-1);
  const streamEnd = last ? last.end : 8;
  const trailingBytes = bytes.length - streamEnd;
  if (last && last.type !== "IEND") {
    issues.push({ level: "error", message: "The file has no IEND chunk.", offset: streamEnd });
  }
  if (trailingBytes > 0) {
    issues.push({
      level: "warning",
      message: `${trailingBytes.toLocaleString("en-US")} bytes after IEND are not part of the PNG.`,
      offset: streamEnd,
    });
  }

  const idat = chunks.filter((c) => c.type === "IDAT");

  return {
    ...base,
    header: parsed.header,
    palette: parsed.palette,
    transparency: parsed.transparency,
    metadata: parsed.metadata,
    animationControl: parsed.animationControl,
    frameControls: parsed.frameControls,
    chunks,
    streamEnd,
    trailingBytes,
    issues,
    idatCount: idat.length,
    idatBytes: idat.reduce((n, c) => n + c.length, 0),
  };
}

export const hasErrors = (a: Analysis) => a.issues.some((i) => i.level === "error");
