import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Check, CodeXml, Copy } from "lucide-react";
import type { Analysis, ChunkEntry } from "../png/analyze";
import { REGION_LABELS, locate } from "../png/byteMap";
import { chunkName, describeChunk, type Field } from "../png/chunkInfo";
import { formatNumber, hex2, hexOffset, hexString, u16, u32 } from "../png/format";
import { BYTES_PER_ROW, HexHeader, HexRows } from "../components/HexRows";
import { ChunkBadge } from "../components/ui";

const ROW_H = 26;
const HEADER_H = 40;
/** Browsers cap element heights (Firefox near 17.9M px), so very large files scroll proportionally. */
const MAX_SCROLL_H = 8_000_000;
const MAX_COPY = 1 << 20;

const fieldCache = new WeakMap<ChunkEntry, Field[]>();

export interface HexTarget {
  offset: number;
  nonce: number;
}

export function HexView({ analysis: a, target }: { analysis: Analysis; target: HexTarget | null }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [viewH, setViewH] = useState(600);
  const [scrollTop, setScrollTop] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [gotoText, setGotoText] = useState("");
  const [copied, setCopied] = useState(false);

  const totalRows = Math.max(1, Math.ceil(a.fileSize / BYTES_PER_ROW));
  const visibleRows = Math.max(1, Math.floor((viewH - HEADER_H) / ROW_H));
  const spacerH = Math.min(totalRows * ROW_H, MAX_SCROLL_H);
  const maxScroll = Math.max(0, spacerH + HEADER_H - viewH);
  const maxFirst = Math.max(0, totalRows - visibleRows);
  const firstRow = maxScroll > 0 ? Math.min(maxFirst, Math.round((scrollTop / maxScroll) * maxFirst)) : 0;
  const scaled = totalRows * ROW_H > MAX_SCROLL_H;

  useLayoutEffect(() => {
    const el = viewport.current!;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scrollToRow = useCallback(
    (row: number) => {
      const el = viewport.current;
      if (!el) return;
      const first = Math.max(0, Math.min(maxFirst, row));
      el.scrollTop = maxFirst ? (first / maxFirst) * maxScroll : 0;
      setScrollTop(el.scrollTop);
    },
    [maxFirst, maxScroll],
  );

  const reveal = useCallback(
    (offset: number) => {
      const row = Math.floor(offset / BYTES_PER_ROW);
      if (row < firstRow || row >= firstRow + visibleRows) scrollToRow(row - 3);
    },
    [firstRow, visibleRows, scrollToRow],
  );

  // Jumps requested from other tabs.
  useEffect(() => {
    if (!target) return;
    const o = Math.max(0, Math.min(a.fileSize - 1, target.offset));
    setAnchor(o);
    setCursor(o);
    scrollToRow(Math.floor(o / BYTES_PER_ROW) - 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // With proportional scrolling the wheel would skip thousands of rows per notch; scroll by rows instead.
  useEffect(() => {
    const el = viewport.current;
    if (!el || !scaled) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      const rows = Math.sign(e.deltaY) * Math.max(1, Math.round(Math.abs(e.deltaY) / ROW_H));
      scrollToRow(firstRow + rows);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scaled, firstRow, scrollToRow]);

  const selection = anchor !== null && cursor !== null ? { from: Math.min(anchor, cursor), to: Math.max(anchor, cursor) } : null;
  const focus = hover ?? cursor;
  const loc = focus !== null ? locate(a, focus) : null;

  const fieldAt = (chunk: ChunkEntry | undefined, o: number) => {
    if (!chunk) return undefined;
    let fields = fieldCache.get(chunk);
    if (!fields) fieldCache.set(chunk, (fields = describeChunk(chunk, a).fields));
    return fields.find((f) => f.offset !== undefined && f.size !== undefined && o >= f.offset && o < f.offset + f.size);
  };

  const band = loc?.chunk ? { from: loc.chunk.offset, to: loc.chunk.end } : null;

  const onPick = useCallback(
    (o: number, extend: boolean) => {
      if (extend && anchor !== null) setCursor(o);
      else {
        setAnchor(o);
        setCursor(o);
      }
    },
    [anchor],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (cursor === null) return;
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -BYTES_PER_ROW,
      ArrowDown: BYTES_PER_ROW,
    };
    const d = moves[e.key];
    if (d === undefined) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(a.fileSize - 1, cursor + d));
    if (!e.shiftKey) setAnchor(next);
    setCursor(next);
    reveal(next);
  };

  const onGoto = (e: FormEvent) => {
    e.preventDefault();
    const t = gotoText.trim().toLowerCase();
    const n = /^(0x|[0-9a-f]*[a-f][0-9a-f]*$)/.test(t) ? parseInt(t.replace(/^0x/, ""), 16) : parseInt(t, 10);
    if (Number.isNaN(n)) return;
    const o = Math.max(0, Math.min(a.fileSize - 1, n));
    setAnchor(o);
    setCursor(o);
    scrollToRow(Math.floor(o / BYTES_PER_ROW) - 3);
    viewport.current?.focus();
  };

  const copy = async () => {
    const from = selection?.from ?? firstRow * BYTES_PER_ROW;
    const to = selection ? selection.to + 1 : Math.min(a.fileSize, (firstRow + visibleRows) * BYTES_PER_ROW);
    const text = hexString(a.bytes.subarray(from, Math.min(to, from + MAX_COPY)));
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be blocked; nothing else to do.
    }
  };

  const shownFrom = firstRow * BYTES_PER_ROW;
  const shownTo = Math.min(a.fileSize, (firstRow + visibleRows) * BYTES_PER_ROW) - 1;
  const selLen = selection ? selection.to - selection.from + 1 : 0;
  const field = loc && focus !== null ? fieldAt(loc.chunk, focus) : undefined;
  const value = focus !== null ? a.bytes[focus] : 0;

  return (
    <section className="card hex-card">
      <header className="card-head">
        <h2 className="card-title">
          <CodeXml size={18} />
          Raw bytes
        </h2>
        <span className="tag">{formatNumber(a.fileSize)} bytes</span>
        <div className="end">
          <form className="goto" onSubmit={onGoto}>
            <label className="visually-hidden" htmlFor="goto">
              Go to offset
            </label>
            <input
              id="goto"
              placeholder="Go to 0x…"
              value={gotoText}
              onChange={(e) => setGotoText(e.target.value)}
            />
          </form>
          <button className="btn" onClick={copy} title={selection ? "Copy the selected bytes as hex" : "Copy the visible bytes as hex"}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : selection && selLen > 1 ? `Copy ${formatNumber(selLen)} bytes` : "Copy bytes"}
          </button>
        </div>
      </header>
      <div
        ref={viewport}
        className="hex-viewport"
        tabIndex={0}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onKeyDown={onKey}
        aria-label="Hex dump"
      >
        <HexHeader />
        <div style={{ height: spacerH, position: "relative" }}>
          <div style={{ position: "sticky", top: HEADER_H }}>
            <HexRows
              analysis={a}
              start={firstRow * BYTES_PER_ROW}
              rows={visibleRows + 1}
              hover={hover}
              selection={selection}
              band={band}
              onHover={setHover}
              onPick={onPick}
            />
          </div>
        </div>
      </div>
      <div className="hex-inspector">
        {focus === null || !loc ? (
          <div style={{ gridColumn: "1 / -1" }} className="muted">
            Hover a byte to see where it belongs. Click to select, Shift+click or Shift+arrows to extend.
          </div>
        ) : (
          <>
            <div>
              <span>Offset</span>
              <strong>
                0x{hexOffset(focus)} · {formatNumber(focus)}
              </strong>
            </div>
            <div>
              <span>Value</span>
              <strong>
                0x{hex2(value)} · {value} · {value.toString(2).padStart(8, "0")}
              </strong>
            </div>
            <div>
              <span>Region</span>
              <strong style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {loc.chunk && <ChunkBadge chunk={loc.chunk} />}
                <span className={`r-${loc.region}`}>{REGION_LABELS[loc.region]}</span>
              </strong>
            </div>
            <div>
              <span>{loc.chunk ? chunkName(loc.chunk.type) : "Field"}</span>
              <strong>
                {field
                  ? `${field.label}: ${field.value}`
                  : loc.chunk
                    ? `+${formatNumber(focus - loc.chunk.offset)} in chunk`
                    : "—"}
              </strong>
            </div>
            <div>
              <span>uint16 / uint32 BE</span>
              <strong>
                {focus + 1 < a.fileSize ? u16(a.bytes, focus) : "—"} /{" "}
                {focus + 3 < a.fileSize ? formatNumber(u32(a.bytes, focus)) : "—"}
              </strong>
            </div>
            {selLen > 1 && (
              <div>
                <span>Selection</span>
                <strong>
                  {formatNumber(selLen)} B · 0x{hexOffset(selection!.from)}–0x{hexOffset(selection!.to)}
                </strong>
              </div>
            )}
          </>
        )}
      </div>
      <div className="card-foot">
        <span>
          Showing bytes {formatNumber(shownFrom)}–{formatNumber(Math.max(shownFrom, shownTo))} of{" "}
          {formatNumber(a.fileSize)}
        </span>
        <span className="legend">
          {(["signature", "length", "type", "data", "crc", "trailing"] as const).map((r) => (
            <span key={r} className={`r-${r}`}>
              <i />
              {REGION_LABELS[r]}
            </span>
          ))}
        </span>
        <span>Big-endian · 16 bytes per row</span>
      </div>
    </section>
  );
}
