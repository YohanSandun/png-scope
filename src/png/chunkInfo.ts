import { parseText, pixelsPerInch, type ColorType, type PngText } from "format-png";
import type { Analysis, ChunkEntry } from "./analyze";
import { formatNumber, hex2, hexString, latin1, pad2, u16, u32 } from "./format";

export type ChunkGroup = "core" | "color" | "meta" | "anim" | "ext";

export interface ChunkSpec {
  name: string;
  group: ChunkGroup;
}

export const CHUNK_SPECS: Record<string, ChunkSpec> = {
  IHDR: { name: "Image header", group: "core" },
  PLTE: { name: "Palette", group: "core" },
  IDAT: { name: "Image data", group: "core" },
  IEND: { name: "Image trailer", group: "core" },
  tRNS: { name: "Transparency", group: "color" },
  cHRM: { name: "Primary chromaticities", group: "color" },
  gAMA: { name: "Image gamma", group: "color" },
  iCCP: { name: "Embedded ICC profile", group: "color" },
  sBIT: { name: "Significant bits", group: "color" },
  sRGB: { name: "Standard RGB color space", group: "color" },
  cICP: { name: "Coding-independent code points", group: "color" },
  mDCV: { name: "Mastering display color volume", group: "color" },
  cLLI: { name: "Content light level", group: "color" },
  bKGD: { name: "Background color", group: "meta" },
  hIST: { name: "Palette histogram", group: "meta" },
  pHYs: { name: "Physical pixel dimensions", group: "meta" },
  sPLT: { name: "Suggested palette", group: "meta" },
  tIME: { name: "Last modification time", group: "meta" },
  tEXt: { name: "Textual data", group: "meta" },
  zTXt: { name: "Compressed textual data", group: "meta" },
  iTXt: { name: "International text", group: "meta" },
  eXIf: { name: "Exif data", group: "meta" },
  acTL: { name: "Animation control", group: "anim" },
  fcTL: { name: "Frame control", group: "anim" },
  fdAT: { name: "Frame data", group: "anim" },
};

export const SPEC_GROUPS: { group: ChunkGroup; title: string; types: string[] }[] = [
  { group: "core", title: "Core image", types: ["IHDR", "PLTE", "IDAT", "IEND"] },
  {
    group: "color",
    title: "Color & transparency",
    types: ["tRNS", "cHRM", "gAMA", "iCCP", "sBIT", "sRGB", "cICP", "mDCV", "cLLI"],
  },
  {
    group: "meta",
    title: "Image & text metadata",
    types: ["bKGD", "hIST", "pHYs", "sPLT", "tIME", "tEXt", "zTXt", "iTXt", "eXIf"],
  },
  { group: "anim", title: "Animation", types: ["acTL", "fcTL", "fdAT"] },
];

export function chunkName(type: string): string {
  const spec = CHUNK_SPECS[type];
  if (spec) return spec.name;
  return type.charCodeAt(1) >= 0x61 ? "Private chunk" : "Unknown chunk";
}

export const COLOR_TYPES: Record<ColorType, { code: number; label: string; short: string; channels: number }> = {
  grayscale: { code: 0, label: "Grayscale", short: "Gray", channels: 1 },
  rgb: { code: 2, label: "Truecolor", short: "RGB", channels: 3 },
  indexed: { code: 3, label: "Indexed-color", short: "Indexed", channels: 1 },
  "grayscale-alpha": { code: 4, label: "Grayscale with alpha", short: "Gray + alpha", channels: 2 },
  rgba: { code: 6, label: "Truecolor with alpha", short: "RGBA", channels: 4 },
};

const COLOR_TYPE_BY_CODE: Record<number, string> = {
  0: "Grayscale",
  2: "Truecolor",
  3: "Indexed-color",
  4: "Grayscale with alpha",
  6: "Truecolor with alpha",
};

export const RENDERING_INTENTS = ["Perceptual", "Relative colorimetric", "Saturation", "Absolute colorimetric"];

export const DISPOSE_OPS = ["None", "Background", "Previous"];
export const BLEND_OPS = ["Source", "Over"];

/** One field of a chunk, with where its bytes live in the file. */
export interface Field {
  label: string;
  value: string;
  /** Absolute file offset of the field's first byte. */
  offset?: number;
  size?: number;
}

export interface ChunkDescription {
  fields: Field[];
  /** Palette swatches for PLTE, with alpha from tRNS. */
  swatches?: { r: number; g: number; b: number; a: number }[];
  /** Long text content (tEXt/zTXt/iTXt). */
  text?: string;
  note?: string;
}

const CICP_PRIMARIES: Record<number, string> = {
  1: "BT.709 / sRGB",
  9: "BT.2020",
  11: "DCI-P3",
  12: "Display P3",
};
const CICP_TRANSFER: Record<number, string> = {
  1: "BT.709",
  8: "Linear",
  13: "sRGB",
  14: "BT.2020 (10-bit)",
  16: "PQ (SMPTE ST 2084)",
  18: "HLG",
};

function cstringEnd(data: Uint8Array, from: number): number {
  const i = data.indexOf(0, from);
  return i < 0 ? data.length : i;
}

function safeParseText(type: PngText["chunkType"], data: Uint8Array): PngText | undefined {
  try {
    return parseText(type, data);
  } catch {
    return undefined;
  }
}

export function describeChunk(chunk: ChunkEntry, a: Analysis): ChunkDescription {
  const d = chunk.data;
  const at = (rel: number) => chunk.dataOffset + rel;
  const f = (label: string, value: string, rel?: number, size?: number): Field =>
    rel === undefined ? { label, value } : { label, value, offset: at(rel), size };
  const need = (n: number): ChunkDescription | undefined =>
    d.length < n ? { fields: [], note: `Expected at least ${n} bytes of data, found ${d.length}.` } : undefined;
  const colorType = a.header?.colorType;

  switch (chunk.type) {
    case "IHDR": {
      const short = need(13);
      if (short) return short;
      const ct = d[9];
      return {
        fields: [
          f("Width", `${formatNumber(u32(d, 0))} px`, 0, 4),
          f("Height", `${formatNumber(u32(d, 4))} px`, 4, 4),
          f("Bit depth", `${d[8]} bit${d[8] === 1 ? "" : "s"}`, 8, 1),
          f("Color type", `${ct} · ${COLOR_TYPE_BY_CODE[ct] ?? "Invalid"}`, 9, 1),
          f("Compression method", `${d[10]} · ${d[10] === 0 ? "Deflate" : "Invalid"}`, 10, 1),
          f("Filter method", `${d[11]} · ${d[11] === 0 ? "Adaptive" : "Invalid"}`, 11, 1),
          f("Interlace method", `${d[12]} · ${d[12] === 0 ? "None" : d[12] === 1 ? "Adam7" : "Invalid"}`, 12, 1),
        ],
      };
    }
    case "PLTE": {
      const n = Math.floor(d.length / 3);
      const alpha = a.transparency?.kind === "palette" ? a.transparency.alpha : undefined;
      const swatches = Array.from({ length: n }, (_, i) => ({
        r: d[i * 3],
        g: d[i * 3 + 1],
        b: d[i * 3 + 2],
        a: alpha && i < alpha.length ? alpha[i] : 255,
      }));
      return {
        fields: [
          f("Entries", formatNumber(n), 0, d.length),
          f("Bytes per entry", "3 · R, G, B"),
          ...(d.length % 3 ? [f("Invalid", `Length ${d.length} is not a multiple of 3`)] : []),
        ],
        swatches,
      };
    }
    case "tRNS": {
      if (colorType === "grayscale" && d.length >= 2) {
        return { fields: [f("Transparent gray", formatNumber(u16(d, 0)), 0, 2)] };
      }
      if (colorType === "rgb" && d.length >= 6) {
        return {
          fields: [
            f("Transparent red", formatNumber(u16(d, 0)), 0, 2),
            f("Transparent green", formatNumber(u16(d, 2)), 2, 2),
            f("Transparent blue", formatNumber(u16(d, 4)), 4, 2),
          ],
        };
      }
      if (colorType === "indexed") {
        const transparent = Array.from(d).filter((v) => v < 255).length;
        return {
          fields: [
            f("Alpha entries", formatNumber(d.length), 0, d.length),
            f("Non-opaque entries", formatNumber(transparent)),
            f("Fully transparent", formatNumber(Array.from(d).filter((v) => v === 0).length)),
          ],
        };
      }
      return { fields: [], note: "tRNS is not allowed for color types with an alpha channel." };
    }
    case "gAMA": {
      const short = need(4);
      if (short) return short;
      const raw = u32(d, 0);
      const g = a.metadata.gamma ?? raw / 100000;
      return {
        fields: [
          f("Stored value", formatNumber(raw), 0, 4),
          f("Gamma", g.toFixed(5)),
          f("Display exponent", g ? (1 / g).toFixed(2) : "—"),
        ],
      };
    }
    case "cHRM": {
      const short = need(32);
      if (short) return short;
      const names = ["White point", "Red", "Green", "Blue"];
      return {
        fields: names.map((n, i) =>
          f(n, `x ${(u32(d, i * 8) / 100000).toFixed(5)} · y ${(u32(d, i * 8 + 4) / 100000).toFixed(5)}`, i * 8, 8),
        ),
      };
    }
    case "sRGB": {
      const short = need(1);
      if (short) return short;
      return { fields: [f("Rendering intent", `${d[0]} · ${RENDERING_INTENTS[d[0]] ?? "Invalid"}`, 0, 1)] };
    }
    case "iCCP": {
      const nameEnd = cstringEnd(d, 0);
      const fields: Field[] = [
        f("Profile name", latin1(d, 0, nameEnd), 0, nameEnd),
        f("Null separator", "00", nameEnd, 1),
        f("Compression method", `${d[nameEnd + 1]} · ${d[nameEnd + 1] === 0 ? "Deflate" : "Invalid"}`, nameEnd + 1, 1),
        f("Compressed profile", `${formatNumber(d.length - nameEnd - 2)} B`, nameEnd + 2, d.length - nameEnd - 2),
      ];
      const icc = a.metadata.iccProfile?.profile;
      if (icc && icc.length >= 128) {
        fields.push(
          f("Decompressed profile", `${formatNumber(icc.length)} B`),
          f("ICC version", `${icc[8]}.${icc[9] >> 4}.${icc[9] & 0xf}`),
          f("Device class", latin1(icc, 12, 16).trim()),
          f("Color space", latin1(icc, 16, 20).trim()),
          f("Connection space", latin1(icc, 20, 24).trim()),
        );
      }
      return { fields };
    }
    case "cICP": {
      const short = need(4);
      if (short) return short;
      return {
        fields: [
          f("Color primaries", `${d[0]} · ${CICP_PRIMARIES[d[0]] ?? "Other"}`, 0, 1),
          f("Transfer function", `${d[1]} · ${CICP_TRANSFER[d[1]] ?? "Other"}`, 1, 1),
          f("Matrix coefficients", `${d[2]}${d[2] === 0 ? " · RGB" : ""}`, 2, 1),
          f("Full range", d[3] ? "1 · Yes" : "0 · No (narrow)", 3, 1),
        ],
      };
    }
    case "mDCV": {
      const short = need(24);
      if (short) return short;
      const c = (o: number) => `x ${(u16(d, o) / 50000).toFixed(4)} · y ${(u16(d, o + 2) / 50000).toFixed(4)}`;
      return {
        fields: [
          f("Red primary", c(0), 0, 4),
          f("Green primary", c(4), 4, 4),
          f("Blue primary", c(8), 8, 4),
          f("White point", c(12), 12, 4),
          f("Max luminance", `${(u32(d, 16) / 10000).toFixed(4)} cd/m²`, 16, 4),
          f("Min luminance", `${(u32(d, 20) / 10000).toFixed(4)} cd/m²`, 20, 4),
        ],
      };
    }
    case "cLLI": {
      const short = need(8);
      if (short) return short;
      return {
        fields: [
          f("Max content light level", `${(u32(d, 0) / 10000).toFixed(4)} cd/m²`, 0, 4),
          f("Max frame-average light level", `${(u32(d, 4) / 10000).toFixed(4)} cd/m²`, 4, 4),
        ],
      };
    }
    case "sBIT": {
      const labels: Record<string, string[]> = {
        grayscale: ["Gray"],
        rgb: ["Red", "Green", "Blue"],
        indexed: ["Red", "Green", "Blue"],
        "grayscale-alpha": ["Gray", "Alpha"],
        rgba: ["Red", "Green", "Blue", "Alpha"],
      };
      const names = labels[colorType ?? "rgba"];
      return { fields: Array.from(d, (v, i) => f(`${names[i] ?? `Channel ${i}`} bits`, String(v), i, 1)) };
    }
    case "bKGD": {
      if (colorType === "indexed" && d.length >= 1) {
        const p = a.palette?.[d[0]];
        return {
          fields: [f("Palette index", String(d[0]), 0, 1), ...(p ? [f("Color", `rgb(${p.join(", ")})`)] : [])],
        };
      }
      if ((colorType === "grayscale" || colorType === "grayscale-alpha") && d.length >= 2) {
        return { fields: [f("Gray", formatNumber(u16(d, 0)), 0, 2)] };
      }
      if (d.length >= 6) {
        return {
          fields: [
            f("Red", formatNumber(u16(d, 0)), 0, 2),
            f("Green", formatNumber(u16(d, 2)), 2, 2),
            f("Blue", formatNumber(u16(d, 4)), 4, 2),
          ],
        };
      }
      return { fields: [], note: "Length doesn't match the image's color type." };
    }
    case "hIST": {
      const n = Math.floor(d.length / 2);
      const values = Array.from({ length: Math.min(n, 8) }, (_, i) => u16(d, i * 2));
      return {
        fields: [
          f("Entries", formatNumber(n), 0, d.length),
          f("First entries", values.join(", ") + (n > 8 ? " …" : "")),
        ],
      };
    }
    case "pHYs": {
      const short = need(9);
      if (short) return short;
      const x = u32(d, 0);
      const y = u32(d, 4);
      const meter = d[8] === 1;
      const fields = [
        f("Pixels per unit, X", formatNumber(x), 0, 4),
        f("Pixels per unit, Y", formatNumber(y), 4, 4),
        f("Unit", `${d[8]} · ${meter ? "Meter" : "Unknown"}`, 8, 1),
      ];
      const ppi = meter ? pixelsPerInch({ x, y, unit: "meter" }) : undefined;
      if (ppi) {
        fields.push(f("Resolution", `${Math.round(ppi.x)} × ${Math.round(ppi.y)} DPI`));
      }
      return { fields };
    }
    case "sPLT": {
      const nameEnd = cstringEnd(d, 0);
      const depth = d[nameEnd + 1];
      const entrySize = depth === 16 ? 10 : 6;
      return {
        fields: [
          f("Palette name", latin1(d, 0, nameEnd), 0, nameEnd),
          f("Sample depth", `${depth} bits`, nameEnd + 1, 1),
          f("Entries", formatNumber(Math.floor((d.length - nameEnd - 2) / entrySize)), nameEnd + 2, d.length - nameEnd - 2),
        ],
      };
    }
    case "tIME": {
      const short = need(7);
      if (short) return short;
      return {
        fields: [
          f("Year", String(u16(d, 0)), 0, 2),
          f("Month", String(d[2]), 2, 1),
          f("Day", String(d[3]), 3, 1),
          f("Hour", String(d[4]), 4, 1),
          f("Minute", String(d[5]), 5, 1),
          f("Second", String(d[6]), 6, 1),
          f("UTC", `${u16(d, 0)}-${pad2(d[2])}-${pad2(d[3])} ${pad2(d[4])}:${pad2(d[5])}:${pad2(d[6])}`),
        ],
      };
    }
    case "tEXt": {
      const k = cstringEnd(d, 0);
      const t = safeParseText("tEXt", d);
      return {
        fields: [
          f("Keyword", latin1(d, 0, k), 0, k),
          f("Null separator", "00", k, 1),
          f("Text", `${formatNumber(d.length - k - 1)} B · Latin-1`, k + 1, d.length - k - 1),
        ],
        text: t?.text ?? latin1(d, k + 1),
      };
    }
    case "zTXt": {
      const k = cstringEnd(d, 0);
      const t = safeParseText("zTXt", d);
      return {
        fields: [
          f("Keyword", latin1(d, 0, k), 0, k),
          f("Null separator", "00", k, 1),
          f("Compression method", `${d[k + 1]} · ${d[k + 1] === 0 ? "Deflate" : "Invalid"}`, k + 1, 1),
          f("Compressed text", `${formatNumber(d.length - k - 2)} B`, k + 2, d.length - k - 2),
          ...(t ? [f("Decompressed", `${formatNumber(t.text.length)} characters`)] : []),
        ],
        text: t?.text,
        note: t ? undefined : "The text could not be decompressed.",
      };
    }
    case "iTXt": {
      const k = cstringEnd(d, 0);
      const flag = d[k + 1];
      const method = d[k + 2];
      const langEnd = cstringEnd(d, k + 3);
      const transEnd = cstringEnd(d, langEnd + 1);
      const t = safeParseText("iTXt", d);
      return {
        fields: [
          f("Keyword", latin1(d, 0, k), 0, k),
          f("Compression flag", flag ? "1 · Compressed" : "0 · Uncompressed", k + 1, 1),
          f("Compression method", `${method} · Deflate`, k + 2, 1),
          f("Language", t?.languageTag || latin1(d, k + 3, langEnd) || "—", k + 3, langEnd - k - 3),
          f("Translated keyword", t?.translatedKeyword || "—", langEnd + 1, transEnd - langEnd - 1),
          f("Text", `${formatNumber(d.length - transEnd - 1)} B · UTF-8`, transEnd + 1, d.length - transEnd - 1),
        ],
        text: t?.text,
        note: t ? undefined : "The text could not be decoded.",
      };
    }
    case "eXIf": {
      const order = latin1(d, 0, 2);
      return {
        fields: [
          f(
            "Byte order",
            order === "MM" ? "MM · Big-endian" : order === "II" ? "II · Little-endian" : `${order} · Invalid`,
            0,
            2,
          ),
          f("TIFF magic", d.length >= 4 ? hexString(d.subarray(2, 4)) : "—", 2, 2),
          f("Exif size", `${formatNumber(d.length)} B`),
        ],
      };
    }
    case "acTL": {
      const short = need(8);
      if (short) return short;
      const plays = u32(d, 4);
      return {
        fields: [
          f("Number of frames", formatNumber(u32(d, 0)), 0, 4),
          f("Number of plays", plays === 0 ? "0 · Infinite" : formatNumber(plays), 4, 4),
        ],
      };
    }
    case "fcTL": {
      const short = need(26);
      if (short) return short;
      const num = u16(d, 20);
      const den = u16(d, 22) || 100;
      return {
        fields: [
          f("Sequence number", String(u32(d, 0)), 0, 4),
          f("Frame", chunk.frameIndex === undefined ? "—" : `#${chunk.frameIndex + 1}`),
          f("Width", `${formatNumber(u32(d, 4))} px`, 4, 4),
          f("Height", `${formatNumber(u32(d, 8))} px`, 8, 4),
          f("X offset", `${formatNumber(u32(d, 12))} px`, 12, 4),
          f("Y offset", `${formatNumber(u32(d, 16))} px`, 16, 4),
          f("Delay numerator", String(num), 20, 2),
          f("Delay denominator", String(u16(d, 22)), 22, 2),
          f("Delay", `${Math.round((num / den) * 1000)} ms`),
          f("Dispose operation", `${d[24]} · ${DISPOSE_OPS[d[24]] ?? "Invalid"}`, 24, 1),
          f("Blend operation", `${d[25]} · ${BLEND_OPS[d[25]] ?? "Invalid"}`, 25, 1),
        ],
      };
    }
    case "fdAT": {
      const short = need(4);
      if (short) return short;
      return {
        fields: [
          f("Sequence number", String(u32(d, 0)), 0, 4),
          f("Frame data", `${formatNumber(d.length - 4)} B · zlib stream`, 4, d.length - 4),
        ],
      };
    }
    case "IDAT": {
      const idats = a.chunks.filter((c) => c.type === "IDAT");
      const pos = idats.indexOf(chunk);
      const fields = [
        f("Segment", `${pos + 1} of ${idats.length}`),
        f("Compressed bytes", formatNumber(d.length), 0, d.length),
        f("Share of image data", a.idatBytes ? `${((d.length / a.idatBytes) * 100).toFixed(1)}%` : "—"),
      ];
      if (pos === 0 && d.length >= 2) {
        const cmf = d[0];
        const flg = d[1];
        const levels = ["Fastest", "Fast", "Default", "Maximum"];
        fields.push(
          f("zlib CMF", `0x${hex2(cmf)} · method ${cmf & 0xf}, window ${1 << ((cmf >> 4) + 8)} B`, 0, 1),
          f("zlib FLG", `0x${hex2(flg)} · level ${levels[flg >> 6]}${flg & 0x20 ? ", preset dict" : ""}`, 1, 1),
          f("Header check", ((cmf << 8) | flg) % 31 === 0 ? "Valid" : "Invalid", 0, 2),
        );
      }
      if (pos === idats.length - 1 && d.length >= 4) {
        fields.push(f("Adler-32", `0x${hexString(d.subarray(d.length - 4)).replace(/ /g, "")}`, d.length - 4, 4));
      }
      return { fields };
    }
    case "IEND":
      return { fields: [], note: d.length ? `IEND should be empty but holds ${d.length} bytes.` : "Marks the end of the PNG datastream. It has no data." };
    default: {
      const printable = d.length > 0 && Array.from(d.subarray(0, 512)).every((b) => (b >= 0x20 && b < 0x7f) || b === 9 || b === 10 || b === 13 || b === 0);
      return {
        fields: [f("Data", `${formatNumber(d.length)} B · not interpreted`, 0, d.length)],
        text: printable ? latin1(d, 0, Math.min(d.length, 4096)).replace(/\0/g, "␀") : undefined,
        note: chunk.type.charCodeAt(1) >= 0x61
          ? "A private chunk. Its meaning is defined by the application that wrote it."
          : "A chunk type format-png doesn't know.",
      };
    }
  }
}

/** Short description for the chunk table. */
export function chunkSummary(chunk: ChunkEntry, a: Analysis): string {
  const d = chunk.data;
  switch (chunk.type) {
    case "IHDR":
      return a.header ? `${a.header.width} × ${a.header.height}, ${a.header.bitDepth}-bit ${COLOR_TYPES[a.header.colorType].short}` : "";
    case "PLTE":
      return `${Math.floor(d.length / 3)} colors`;
    case "tEXt":
    case "zTXt":
    case "iTXt":
      return latin1(d, 0, cstringEnd(d, 0));
    case "fcTL":
      return chunk.frameIndex === undefined ? "" : `Frame ${chunk.frameIndex + 1}`;
    case "fdAT":
    case "acTL":
      return d.length >= 4 ? (chunk.type === "acTL" ? `${u32(d, 0)} frames` : `Seq ${u32(d, 0)}`) : "";
    case "sRGB":
      return RENDERING_INTENTS[d[0]] ?? "";
    case "gAMA":
      return d.length >= 4 ? (u32(d, 0) / 100000).toFixed(5) : "";
    default:
      return "";
  }
}
