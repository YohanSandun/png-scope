import { Check, CircleAlert, Database, Layers, Maximize2, Palette, TriangleAlert } from "lucide-react";
import type { RgbaImage } from "format-png";
import type { Analysis } from "../png/analyze";
import { COLOR_TYPES } from "../png/chunkInfo";
import { chipLabel, colorSpaceLabel, transparencyLabel } from "../png/labels";
import { formatBytes, formatNumber, hexOffset, ratio } from "../png/format";
import { ImagePreview } from "../components/ImagePreview";
import { KeyValueList, StatCard, type KvItem } from "../components/ui";
import type { Decoded } from "../state/useDecoded";
import type { TabId } from "../tabs";

export function OverviewView({
  analysis: a,
  image,
  onNavigate,
}: {
  analysis: Analysis;
  image: Decoded<RgbaImage>;
  onNavigate: (tab: TabId, opts?: { chunk?: number; offset?: number }) => void;
}) {
  const h = a.header;
  const ct = h ? COLOR_TYPES[h.colorType] : undefined;
  const transparency = transparencyLabel(a);

  const details: KvItem[] = [
    { label: "Compression", value: "Deflate / zlib" },
    { label: "Interlacing", value: h ? (h.interlaced ? "Adam7 (interlaced)" : "None (non-interlaced)") : "—" },
    { label: "Color space", value: colorSpaceLabel(a) },
    {
      label: "Transparency",
      value: transparency.yes ? (
        <span className="ok">
          <Check size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
          {transparency.text}
        </span>
      ) : (
        transparency.text
      ),
    },
    {
      label: "Animation",
      value: a.animationControl
        ? `APNG · ${formatNumber(a.animationControl.numFrames)} frames`
        : "Static image",
      onClick: () => onNavigate("animation"),
    },
    { label: "Aspect ratio", value: h ? ratio(h.width, h.height) : "—" },
    {
      label: "Chunks",
      value: `${a.chunks.length} · ${a.chunks.filter((c) => c.critical).length} critical`,
      onClick: () => onNavigate("chunks"),
    },
    {
      label: "Image data",
      value: `${formatNumber(a.idatCount)} IDAT · ${formatBytes(a.idatBytes)}`,
    },
    ...(h && a.idatBytes
      ? [
          {
            label: "Compression ratio",
            value: `${((h.height * (1 + Math.ceil((h.width * ct!.channels * h.bitDepth) / 8))) / a.idatBytes).toFixed(2)} : 1`,
            title: "Filtered scanline bytes (non-interlaced) divided by compressed IDAT bytes",
          },
        ]
      : []),
    ...(a.trailingBytes > 0
      ? [
          {
            label: "Trailing data",
            value: <span className="bad">{formatBytes(a.trailingBytes)} after IEND</span>,
            onClick: () => onNavigate("hex", { offset: a.streamEnd }),
          },
        ]
      : []),
  ];

  return (
    <div className="overview">
      <ImagePreview
        source={image.status === "ready" ? image.value : undefined}
        loading={image.status === "loading"}
        error={image.status === "error" ? image.message : undefined}
        chip={chipLabel(a)}
        end={a.animationControl ? "APNG · default image" : "PNG"}
      />
      <div>
        <h2 className="section-label">At a glance</h2>
        {a.issues.length > 0 && (
          <div className="issues">
            {a.issues.slice(0, 6).map((issue, i) => (
              <button
                key={i}
                className={`issue ${issue.level}`}
                onClick={() =>
                  issue.chunkIndex !== undefined
                    ? onNavigate("chunks", { chunk: issue.chunkIndex })
                    : issue.offset !== undefined && onNavigate("hex", { offset: issue.offset })
                }
              >
                {issue.level === "error" ? <CircleAlert size={16} /> : <TriangleAlert size={16} />}
                <span>
                  {issue.message}
                  {issue.offset !== undefined && <span className="mono"> · 0x{hexOffset(issue.offset)}</span>}
                </span>
              </button>
            ))}
            {a.issues.length > 6 && <span className="muted">and {a.issues.length - 6} more…</span>}
          </div>
        )}
        <div className="stats">
          <StatCard
            label="Dimensions"
            icon={Maximize2}
            value={h ? `${formatNumber(h.width)} × ${formatNumber(h.height)}` : "—"}
            sub={h ? `${((h.width * h.height) / 1e6).toFixed(2)} megapixels` : "Unknown"}
          />
          <StatCard
            label="Color type"
            icon={Palette}
            value={ct?.label ?? "—"}
            sub={ct ? `Color type ${ct.code} · ${ct.short}` : "Unknown"}
          />
          <StatCard
            label="Bit depth"
            icon={Layers}
            value={h ? `${h.bitDepth} bit${h.bitDepth === 1 ? "" : "s"}` : "—"}
            sub={h && ct ? `${ct.channels * h.bitDepth} bits per pixel` : "Unknown"}
          />
          <StatCard
            label="File size"
            icon={Database}
            value={formatBytes(a.fileSize)}
            sub={`${formatNumber(a.fileSize)} bytes`}
          />
        </div>
        <KeyValueList items={details} />
      </div>
    </div>
  );
}
