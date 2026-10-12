import { memo } from "react";
import type { Analysis } from "../png/analyze";
import { locate } from "../png/byteMap";
import { asciiChar, hex2, hexOffset, isPrintable } from "../png/format";

export const BYTES_PER_ROW = 16;
const COLUMNS = Array.from({ length: BYTES_PER_ROW }, (_, i) => i);

export interface HexRowsProps {
  analysis: Analysis;
  /** Offset of the first byte of the first row. */
  start: number;
  rows: number;
  /** Exclusive end of the bytes to show. */
  end?: number;
  hover?: number | null;
  selection?: { from: number; to: number } | null;
  /** Byte range drawn with a soft background, such as the hovered chunk. */
  band?: { from: number; to: number } | null;
  onHover?: (offset: number | null) => void;
  onPick?: (offset: number, extend: boolean) => void;
  header?: boolean;
}

export function HexHeader() {
  return (
    <div className="hex-header" aria-hidden>
      <span className="hex-offset">OFFSET</span>
      <span className="hex-bytes">
        {COLUMNS.map((i) => (
          <span key={i} className="hex-byte">
            {hex2(i)}
          </span>
        ))}
      </span>
      <span className="hex-ascii">ASCII</span>
    </div>
  );
}

function HexRowsImpl({ analysis, start, rows, end, hover, selection, band, onHover, onPick, header }: HexRowsProps) {
  const { bytes } = analysis;
  const limit = Math.min(end ?? bytes.length, bytes.length);
  const lines = [];

  for (let r = 0; r < rows; r++) {
    const rowStart = start + r * BYTES_PER_ROW;
    if (rowStart >= limit) break;
    const hexCells = [];
    const charCells = [];
    for (const c of COLUMNS) {
      const o = rowStart + c;
      if (o >= limit) {
        hexCells.push(<span key={c} className="hex-byte empty">00</span>);
        charCells.push(<span key={c} className="hex-char empty">.</span>);
        continue;
      }
      const b = bytes[o];
      const { region } = locate(analysis, o);
      let cls = `r-${region}`;
      if (band && o >= band.from && o < band.to) cls += " in-chunk";
      if (selection && o >= selection.from && o <= selection.to) cls += " selected";
      if (o === hover) cls += " hover";
      hexCells.push(
        <span key={c} className={`hex-byte ${cls}`} data-o={o}>
          {hex2(b)}
        </span>,
      );
      charCells.push(
        <span key={c} className={`hex-char ${cls}${isPrintable(b) ? "" : " np"}`} data-o={o}>
          {asciiChar(b)}
        </span>,
      );
    }
    lines.push(
      <div className="hex-row" key={rowStart}>
        <span className="hex-offset">{hexOffset(rowStart)}</span>
        <span className="hex-bytes">{hexCells}</span>
        <span className="hex-ascii">{charCells}</span>
      </div>,
    );
  }

  // One set of listeners for all cells; each cell carries its offset in data-o.
  const offsetOf = (e: React.MouseEvent) => {
    const o = (e.target as HTMLElement).dataset?.o;
    return o === undefined ? null : Number(o);
  };

  return (
    <div
      className="hex-rows"
      onMouseMove={onHover ? (e) => onHover(offsetOf(e)) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onMouseDown={
        onPick
          ? (e) => {
              const o = offsetOf(e);
              if (o !== null) onPick(o, e.shiftKey);
            }
          : undefined
      }
    >
      {header && <HexHeader />}
      {lines}
    </div>
  );
}

export const HexRows = memo(HexRowsImpl);
