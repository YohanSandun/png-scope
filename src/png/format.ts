const nf = new Intl.NumberFormat("en-US");

export const formatNumber = (n: number) => nf.format(n);

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export const hex2 = (b: number) => b.toString(16).toUpperCase().padStart(2, "0");

export const hexOffset = (n: number, width = 8) => n.toString(16).toUpperCase().padStart(width, "0");

export const hex32 = (n: number) => `0x${hexOffset(n >>> 0)}`;

/** "7C A8 72 91" */
export const crcBytes = (n: number) =>
  [24, 16, 8, 0].map((s) => hex2((n >>> s) & 0xff)).join(" ");

export function hexString(bytes: Uint8Array, max = Infinity): string {
  const len = Math.min(bytes.length, max);
  const parts = new Array<string>(len);
  for (let i = 0; i < len; i++) parts[i] = hex2(bytes[i]);
  return parts.join(" ") + (bytes.length > max ? " …" : "");
}

export const isPrintable = (b: number) => b >= 0x20 && b < 0x7f;

export const asciiChar = (b: number) => (isPrintable(b) ? String.fromCharCode(b) : "·");

export function latin1(bytes: Uint8Array, start = 0, end = bytes.length): string {
  let s = "";
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

export const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
export const u32 = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
export const i32 = (b: Uint8Array, o: number) => u32(b, o) | 0;

export function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function ratio(a: number, b: number): string {
  if (!a || !b) return "—";
  const g = gcd(a, b);
  return `${a / g}:${b / g}`;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
