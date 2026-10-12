import type { Analysis } from "./analyze";
import { COLOR_TYPES } from "./chunkInfo";

export function colorSpaceLabel(a: Analysis): string {
  const m = a.metadata;
  if (m.cicp) return `cICP ${m.cicp.colorPrimaries}/${m.cicp.transferFunction}`;
  if (m.iccProfile) return `ICC · ${m.iccProfile.name}`;
  if (m.srgb) return "sRGB";
  if (m.gamma) return `Gamma ${m.gamma.toFixed(5)}`;
  return "Not specified (assume sRGB)";
}

export function transparencyLabel(a: Analysis): { text: string; yes: boolean } {
  const ct = a.header?.colorType;
  if (ct === "rgba" || ct === "grayscale-alpha") return { text: "Alpha channel", yes: true };
  if (a.transparency?.kind === "palette") return { text: "Palette alpha (tRNS)", yes: true };
  if (a.transparency) return { text: "Single color key (tRNS)", yes: true };
  return { text: "None (opaque)", yes: false };
}

export function chipLabel(a: Analysis): string {
  if (!a.header) return "PNG";
  return `${COLOR_TYPES[a.header.colorType].short} · ${a.header.bitDepth}-bit`;
}
