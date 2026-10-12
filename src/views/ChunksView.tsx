import { useMemo, useState } from "react";
import { Box, Check, ChevronRight, CodeXml, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import type { Analysis, ChunkEntry } from "../png/analyze";
import { chunkName, chunkSummary, describeChunk } from "../png/chunkInfo";
import { crcBytes, formatBytes, formatNumber, hex32, hexOffset } from "../png/format";
import { BYTES_PER_ROW, HexRows } from "../components/HexRows";
import { Card, ChunkBadge, KeyValueList, type KvItem } from "../components/ui";

const MINI_ROWS = 8;

function ChunkDetails({
  analysis,
  chunk,
  onHex,
}: {
  analysis: Analysis;
  chunk: ChunkEntry;
  onHex: (offset: number) => void;
}) {
  const desc = useMemo(() => describeChunk(chunk, analysis), [chunk, analysis]);
  const flags = [
    chunk.critical ? "Critical chunk" : "Ancillary chunk",
    chunk.public ? "Public" : "Private",
    chunk.reservedValid ? "Reserved bit valid" : "Reserved bit set",
    chunk.safeToCopy ? "Safe to copy" : "Unsafe to copy",
  ];

  const fieldItems: KvItem[] = desc.fields.map((f) => ({
    label: f.label,
    hint:
      f.offset !== undefined ? (
        <span className="field-offset">
          0x{hexOffset(f.offset)}
          {f.size !== undefined && ` · ${formatNumber(f.size)} B`}
        </span>
      ) : undefined,
    value: f.value,
    onClick: f.offset !== undefined ? () => onHex(f.offset!) : undefined,
    title: f.offset !== undefined ? "Show these bytes in the hex viewer" : undefined,
  }));

  const integrity: KvItem[] = [
    { label: "Offset", value: <span className="mono">{hex32(chunk.offset)}</span>, onClick: () => onHex(chunk.offset) },
    { label: "Data length", value: `${formatNumber(chunk.length)} B` },
    { label: "Total size", value: `${formatNumber(chunk.length + 12)} B`, title: "Length + type + data + CRC" },
    { label: "Stored CRC-32", value: <span className="mono">{crcBytes(chunk.storedCrc)}</span>, onClick: () => onHex(chunk.crcOffset) },
    { label: "Computed CRC-32", value: <span className="mono">{crcBytes(chunk.computedCrc)}</span> },
    {
      label: "Checksum",
      value: chunk.crcValid ? <span className="ok">Valid</span> : <span className="bad">Mismatch</span>,
    },
    { label: "Safe to copy", value: chunk.safeToCopy ? "Yes" : "No" },
    { label: "Parsed by format-png", value: chunk.known ? "Yes" : "No" },
  ];

  return (
    <Card title="Chunk details" icon={Box} end={<ChunkBadge chunk={chunk} />} className="detail-card">
      <div className="card-body">
        <h3 className="detail-title">{chunkName(chunk.type)}</h3>
        <p className="detail-sub">{flags.join(" · ")}</p>
        {desc.note && <p className="detail-note">{desc.note}</p>}
        {desc.fields.length > 0 && <KeyValueList items={fieldItems} />}
        {desc.swatches && (
          <>
            <h4 className="section-label" style={{ marginTop: 20 }}>
              Palette · {desc.swatches.length} entries
            </h4>
            <div className="palette-grid">
              {desc.swatches.map((s, i) => (
                <span
                  key={i}
                  className="swatch checker"
                  title={`#${i}: rgb(${s.r}, ${s.g}, ${s.b})${s.a < 255 ? ` alpha ${s.a}` : ""}`}
                >
                  <span
                    style={{ position: "absolute", inset: 0, background: `rgba(${s.r},${s.g},${s.b},${s.a / 255})` }}
                  />
                </span>
              ))}
            </div>
          </>
        )}
        {desc.text !== undefined && (
          <>
            <h4 className="section-label" style={{ marginTop: 20 }}>
              Text content
            </h4>
            <div className="text-block">{desc.text || <span className="muted">(empty)</span>}</div>
          </>
        )}
        <h4 className="section-label" style={{ marginTop: 28 }}>
          Integrity & location
        </h4>
        <KeyValueList items={integrity} />
        <h4 className="section-label" style={{ marginTop: 28 }}>
          Raw bytes
        </h4>
        <div className="mini-hex">
          <HexRows
            analysis={analysis}
            start={chunk.offset}
            rows={MINI_ROWS}
            end={chunk.end}
            onPick={(o) => onHex(o)}
          />
          <div className="mini-hex-foot">
            <span>
              {chunk.end - chunk.offset > MINI_ROWS * BYTES_PER_ROW
                ? `First ${MINI_ROWS * BYTES_PER_ROW} of ${formatNumber(chunk.end - chunk.offset)} bytes`
                : `${formatNumber(chunk.end - chunk.offset)} bytes`}
            </span>
            <button className="link-btn" onClick={() => onHex(chunk.offset)}>
              <CodeXml size={15} />
              Open in hex viewer
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ChunksView({
  analysis: a,
  selected,
  onSelect,
  onHex,
}: {
  analysis: Analysis;
  selected: number;
  onSelect: (index: number) => void;
  onHex: (offset: number) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      a.chunks
        .map((c) => ({ c, name: chunkName(c.type), summary: chunkSummary(c, a) }))
        .filter(
          ({ c, name, summary }) =>
            !q ||
            c.type.toLowerCase().includes(q) ||
            name.toLowerCase().includes(q) ||
            summary.toLowerCase().includes(q) ||
            hexOffset(c.offset).toLowerCase().includes(q.replace(/^0x/, "")),
        ),
    [a, q],
  );
  const chunk = a.chunks[selected] ?? a.chunks[0];
  const bad = a.chunks.filter((c) => !c.crcValid).length;
  const critical = a.chunks.filter((c) => c.critical).length;

  if (a.chunks.length === 0) {
    return (
      <Card>
        <div className="empty-row">
          No chunks could be read{a.fatalError ? `: ${a.fatalError}` : "."} The raw bytes are still available in the
          hex viewer.
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="chunks-head">
        <div>
          <h2>Chunk explorer</h2>
          <p>
            {a.chunks.length} chunks · {formatNumber(a.fileSize)} bytes · PNG signature verified
          </p>
        </div>
        <label className="search">
          <Search size={17} />
          <span className="visually-hidden">Find a chunk</span>
          <input
            type="search"
            placeholder="Find a chunk…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="chunks-layout">
        <div className="card">
          <div className="table-scroll">
            <table className="chunk-table">
              <thead>
                <tr>
                  <th>Chunk</th>
                  <th>Description</th>
                  <th>Size</th>
                  <th>Offset</th>
                  <th>CRC</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ c, name, summary }) => (
                  <tr
                    key={c.index}
                    className={c === chunk ? "selected" : ""}
                    onClick={() => onSelect(c.index)}
                    aria-selected={c === chunk}
                  >
                    <td>
                      <ChunkBadge chunk={c} />
                    </td>
                    <td className="desc">
                      {name}
                      {summary && <small>{summary}</small>}
                    </td>
                    <td className="mono">{formatBytes(c.length)}</td>
                    <td className="mono">{hex32(c.offset)}</td>
                    <td>
                      {c.crcValid ? (
                        <span className="crc-ok">
                          <Check size={15} /> Valid
                        </span>
                      ) : (
                        <span className="crc-bad">
                          <X size={15} /> Invalid
                        </span>
                      )}
                    </td>
                    <td className="chevron">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No chunk matches “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="card-foot">
            <span>
              {a.chunks.length} chunks · {critical} critical · {a.chunks.length - critical} ancillary
            </span>
            {bad === 0 ? (
              <span className="crc-ok">
                <ShieldCheck size={15} /> All checksums valid
              </span>
            ) : (
              <span className="crc-bad">
                <ShieldAlert size={15} /> {bad} invalid checksum{bad > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {chunk && <ChunkDetails analysis={a} chunk={chunk} onHex={onHex} />}
      </div>
    </>
  );
}
