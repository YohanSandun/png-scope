import type { Analysis } from "./analyze";
import { chunkName, describeChunk } from "./chunkInfo";
import { hex32 } from "./format";

/** A JSON-friendly summary of the analysis, for "Export report". */
export function buildReport(a: Analysis) {
  const { metadata } = a;
  return {
    generator: "PNGScope",
    generatedAt: new Date().toISOString(),
    file: { name: a.fileName, size: a.fileSize, signatureValid: a.signatureValid },
    header: a.header,
    fatalError: a.fatalError,
    issues: a.issues,
    animation: a.animationControl ? { ...a.animationControl, frames: a.frameControls } : null,
    metadata: {
      ...metadata,
      iccProfile: metadata.iccProfile
        ? { name: metadata.iccProfile.name, size: metadata.iccProfile.profile.length }
        : undefined,
      exif: metadata.exif ? { byteOrder: metadata.exif.byteOrder, size: metadata.exif.data.length } : undefined,
    },
    palette: a.palette,
    chunks: a.chunks.map((c) => ({
      type: c.type,
      name: chunkName(c.type),
      offset: c.offset,
      length: c.length,
      crc: hex32(c.storedCrc),
      crcValid: c.crcValid,
      critical: c.critical,
      public: c.public,
      safeToCopy: c.safeToCopy,
      fields: describeChunk(c, a).fields.map(({ label, value, offset }) => ({ label, value, offset })),
    })),
    trailingBytes: a.trailingBytes,
  };
}

export function downloadReport(a: Analysis) {
  const json = JSON.stringify(buildReport(a), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${a.fileName.replace(/\.png$/i, "")}.pngscope.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
