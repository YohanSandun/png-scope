import { Layers, Palette, Type } from "lucide-react";
import { pixelsPerInch } from "format-png";
import type { Analysis } from "../png/analyze";
import { RENDERING_INTENTS, SPEC_GROUPS, describeChunk } from "../png/chunkInfo";
import { formatBytes, formatNumber, pad2, ratio } from "../png/format";
import { Card, KeyValueList, type KvItem } from "../components/ui";

const INTENT_LABEL: Record<string, string> = {
  perceptual: RENDERING_INTENTS[0],
  "relative-colorimetric": RENDERING_INTENTS[1],
  saturation: RENDERING_INTENTS[2],
  "absolute-colorimetric": RENDERING_INTENTS[3],
};

const METADATA_TYPES = new Set(SPEC_GROUPS.filter((g) => g.group !== "core").flatMap((g) => g.types));

export function MetadataView({
  analysis: a,
  onChunk,
}: {
  analysis: Analysis;
  onChunk: (index: number) => void;
}) {
  const m = a.metadata;
  const find = (type: string) => a.chunks.find((c) => c.type === type);
  const go = (type: string) => {
    const c = find(type);
    return c ? () => onChunk(c.index) : undefined;
  };
  const raw = (type: string) => {
    const c = find(type);
    return c ? describeChunk(c, a).fields : undefined;
  };

  const phys = m.physicalDimensions;
  const ppi = phys?.unit === "meter" ? pixelsPerInch(phys) : undefined;
  const sbit = raw("sBIT");
  const bkgd = raw("bKGD");

  let profile = "Not specified";
  if (m.cicp) profile = `cICP · primaries ${m.cicp.colorPrimaries}, transfer ${m.cicp.transferFunction}`;
  else if (m.iccProfile) profile = `ICC · ${m.iccProfile.name}`;
  else if (m.srgb) profile = "sRGB IEC61966-2.1";

  const items: KvItem[] = [
    { label: "Color profile", value: profile, onClick: go(m.cicp ? "cICP" : m.iccProfile ? "iCCP" : "sRGB") },
    { label: "Rendering intent", value: m.srgb ? INTENT_LABEL[m.srgb] : "Not specified", onClick: go("sRGB") },
    { label: "Image gamma", value: m.gamma !== undefined ? m.gamma.toFixed(5) : "Not specified", onClick: go("gAMA") },
    {
      label: "Chromaticities",
      value: m.chromaticities
        ? `W ${m.chromaticities.white.x.toFixed(4)}, ${m.chromaticities.white.y.toFixed(4)}`
        : "Not specified",
      onClick: go("cHRM"),
    },
    ...(m.iccProfile
      ? [{ label: "ICC profile size", value: formatBytes(m.iccProfile.profile.length), onClick: go("iCCP") }]
      : []),
    {
      label: "Pixel density",
      value: ppi
        ? `${Math.round(ppi.x)} × ${Math.round(ppi.y)} DPI`
        : phys
          ? `${phys.x} : ${phys.y} (no unit)`
          : "Not specified",
      onClick: go("pHYs"),
    },
    ...(ppi && a.header
      ? [
          {
            label: "Print size",
            value: `${(a.header.width / ppi.x).toFixed(2)} × ${(a.header.height / ppi.y).toFixed(2)} in`,
          },
        ]
      : []),
    { label: "Pixel aspect ratio", value: phys ? ratio(phys.y, phys.x) : "1:1 (assumed)" },
    {
      label: "Significant bits",
      value: sbit ? sbit.map((f) => f.value).join(" / ") + " per channel" : "Not specified",
      onClick: go("sBIT"),
    },
    {
      label: "Background color",
      value: bkgd ? bkgd.map((f) => `${f.label} ${f.value}`).join(", ") : "Not specified",
      onClick: go("bKGD"),
    },
    {
      label: "Last modified",
      value: m.time
        ? `${m.time.year}-${pad2(m.time.month)}-${pad2(m.time.day)} ${pad2(m.time.hour)}:${pad2(m.time.minute)}:${pad2(m.time.second)} UTC`
        : "Not present",
      onClick: go("tIME"),
    },
    {
      label: "EXIF data",
      value: m.exif ? `${formatBytes(m.exif.data.length)} · ${m.exif.byteOrder}` : "Not present",
      onClick: go("eXIf"),
    },
  ];

  const textChunks = a.chunks.filter((c) => c.type === "tEXt" || c.type === "zTXt" || c.type === "iTXt");
  const metaCount = a.chunks.filter((c) => METADATA_TYPES.has(c.type) || (!c.critical && !c.known)).length;
  const present = new Set(a.chunks.map((c) => c.type));
  const extensions = [...present].filter((t) => !SPEC_GROUPS.some((g) => g.types.includes(t)));

  return (
    <div className="metadata">
      <div>
        <Card title="Color & image properties" icon={Palette} end={<span className="mono">{metaCount} metadata chunks</span>}>
          <div className="card-body">
            <KeyValueList items={items} />
            {m.text.map((t, i) => {
              const chunk = textChunks[i];
              const rows: KvItem[] = [
                { label: "Keyword", value: t.keyword },
                ...(t.chunkType === "iTXt"
                  ? [
                      { label: "Language", value: t.languageTag || "—" },
                      ...(t.translatedKeyword ? [{ label: "Translated keyword", value: t.translatedKeyword }] : []),
                    ]
                  : []),
                { label: "Compression", value: t.compressed ? "Compressed (zlib)" : "Uncompressed" },
                { label: "Value", value: <span style={{ whiteSpace: "pre-wrap" }}>{t.text}</span> },
              ];
              return (
                <div key={i}>
                  <h3
                    className="section-label"
                    style={{ marginTop: 28, cursor: chunk ? "pointer" : undefined }}
                    onClick={chunk ? () => onChunk(chunk.index) : undefined}
                  >
                    Text entries · {t.chunkType}
                  </h3>
                  <KeyValueList items={rows} />
                </div>
              );
            })}
            {m.text.length === 0 && (
              <p className="muted" style={{ marginTop: 20, display: "flex", gap: 8, alignItems: "center" }}>
                <Type size={16} /> No text chunks.
              </p>
            )}
          </div>
        </Card>
      </div>
      <Card title="PNG specification reference" icon={Layers}>
        <div className="card-body">
          {SPEC_GROUPS.map((g) => (
            <div className="spec-group" key={g.group}>
              <h3>{g.title}</h3>
              <div className="spec-types">
                {g.types.map((t) => (
                  <button
                    key={t}
                    className={`spec-type${present.has(t) ? " present" : ""}`}
                    disabled={!present.has(t)}
                    onClick={() => onChunk(find(t)!.index)}
                    title={present.has(t) ? `Show ${t}` : `${t} is not in this file`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="spec-group">
            <h3>Extensions</h3>
            <div className="spec-types">
              {extensions.length ? (
                extensions.map((t) => (
                  <button key={t} className="spec-type present" onClick={() => onChunk(find(t)!.index)}>
                    {t}
                  </button>
                ))
              ) : (
                <span className="spec-type">Unknown and private chunks</span>
              )}
            </div>
          </div>
          <div className="spec-foot">
            Highlighted chunks are present · PNG Third Edition · APNG · {formatNumber(present.size)} distinct types
          </div>
        </div>
      </Card>
    </div>
  );
}
