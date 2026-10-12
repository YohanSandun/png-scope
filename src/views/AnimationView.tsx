import { useEffect, useMemo, useState } from "react";
import { Pause, Play, StepBack, StepForward } from "lucide-react";
import { frameDelayMs, type RgbaAnimation, type RgbaImage } from "format-png";
import type { Analysis } from "../png/analyze";
import { BLEND_OPS, DISPOSE_OPS } from "../png/chunkInfo";
import { formatBytes, formatNumber } from "../png/format";
import { ImagePreview, type PixelSource } from "../components/ImagePreview";
import { KeyValueList, type KvItem } from "../components/ui";
import { MAX_ANIMATION_BYTES, animationBytes, type Decoded } from "../state/useDecoded";
import { chipLabel } from "../png/labels";

const DISPOSE_INDEX = { none: 0, background: 1, previous: 2 } as const;
const BLEND_INDEX = { source: 0, over: 1 } as const;

export function AnimationView({
  analysis: a,
  image,
  animation,
}: {
  analysis: Analysis;
  image: Decoded<RgbaImage>;
  animation: Decoded<RgbaAnimation>;
}) {
  const actl = a.animationControl;
  const fcs = a.frameControls;
  const anim = animation.status === "ready" ? animation.value : undefined;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const frameCount = anim?.frames.length ?? fcs.length;

  // Advance frames on their own delays; the loop count from acTL is honored.
  const [plays, setPlays] = useState(0);
  useEffect(() => {
    if (!anim || !playing || anim.frames.length < 2) return;
    const id = setTimeout(() => {
      const next = (frame + 1) % anim.frames.length;
      if (next === 0) {
        const done = plays + 1;
        if (anim.numPlays > 0 && done >= anim.numPlays) {
          setPlaying(false);
          return;
        }
        setPlays(done);
      }
      setFrame(next);
    }, Math.max(10, frameDelayMs(anim.frames[frame])));
    return () => clearTimeout(id);
  }, [anim, playing, frame, plays]);

  const source: PixelSource | undefined = useMemo(() => {
    if (anim) {
      const f = anim.frames[Math.min(frame, anim.frames.length - 1)];
      return { width: anim.width, height: anim.height, data: f.data };
    }
    return image.status === "ready" ? image.value : undefined;
  }, [anim, frame, image]);

  const totalMs = fcs.reduce((n, f) => n + frameDelayMs(f), 0);
  const fc = fcs[Math.min(frame, fcs.length - 1)];
  const h = a.header;
  const tooLarge = animationBytes(a) > MAX_ANIMATION_BYTES;

  const control: KvItem[] = [
    { label: "Number of frames", value: actl ? formatNumber(actl.numFrames) : "Not present" },
    { label: "Number of plays", value: actl ? (actl.numPlays === 0 ? "Infinite" : formatNumber(actl.numPlays)) : "—" },
    { label: "Duration", value: actl ? `${(totalMs / 1000).toFixed(2)} s per loop` : "—" },
    { label: "Canvas size", value: h ? `${formatNumber(h.width)} × ${formatNumber(h.height)}` : "—" },
    {
      label: "Default image",
      value: actl ? (a.chunks.findIndex((c) => c.type === "fcTL") < a.chunks.findIndex((c) => c.type === "IDAT") ? "First frame" : "Separate (not a frame)") : "—",
    },
  ];

  const frameItems: KvItem[] = fc
    ? [
        { label: "Sequence number", value: fc.sequenceNumber },
        { label: "Frame dimensions", value: `${formatNumber(fc.width)} × ${formatNumber(fc.height)}` },
        { label: "Offset X / Y", value: `${fc.x} / ${fc.y}` },
        {
          label: "Delay numerator / denominator",
          value: `${fc.delayNum} / ${fc.delayDen} (${Math.round(frameDelayMs(fc))} ms)`,
        },
        { label: "Dispose operation", value: `${DISPOSE_INDEX[fc.dispose]} · ${DISPOSE_OPS[DISPOSE_INDEX[fc.dispose]]}` },
        { label: "Blend operation", value: `${BLEND_INDEX[fc.blend]} · ${BLEND_OPS[BLEND_INDEX[fc.blend]]}` },
      ]
    : [
        { label: "Sequence number", value: "—" },
        { label: "Frame dimensions", value: "—" },
        { label: "Offset X / Y", value: "—" },
        { label: "Delay", value: "—" },
        { label: "Dispose operation", value: "—" },
        { label: "Blend operation", value: "—" },
      ];

  const step = (d: number) => {
    setPlaying(false);
    setFrame((f) => (f + d + frameCount) % frameCount);
  };

  const toolbar = anim && anim.frames.length > 1 && (
    <div className="preview-toolbar">
      <button className="icon-btn" onClick={() => step(-1)} title="Previous frame" aria-label="Previous frame">
        <StepBack size={18} />
      </button>
      <button
        className="icon-btn active"
        onClick={() => {
          setPlays(0);
          setPlaying(!playing);
        }}
        title={playing ? "Pause" : "Play"}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button className="icon-btn" onClick={() => step(1)} title="Next frame" aria-label="Next frame">
        <StepForward size={18} />
      </button>
      <input
        className="scrubber"
        type="range"
        min={0}
        max={frameCount - 1}
        value={frame}
        onChange={(e) => {
          setPlaying(false);
          setFrame(Number(e.target.value));
        }}
        aria-label="Frame"
      />
      <span className="mono muted" style={{ fontSize: 12.5, minWidth: 70, textAlign: "right" }}>
        {frame + 1} / {frameCount}
      </span>
    </div>
  );

  let subtitle = "This is a static PNG. It has no acTL chunk.";
  if (actl) {
    subtitle = `Animated PNG · ${formatNumber(actl.numFrames)} frames.`;
    if (animation.status === "loading") subtitle += " Decoding frames…";
    if (animation.status === "error") subtitle += ` Frames couldn't be decoded: ${animation.message}`;
    if (tooLarge) subtitle += ` Too large to preview (${formatBytes(animationBytes(a))} of frames); showing the default image.`;
  }

  return (
    <>
      <div className="anim-head">
        <div>
          <h2>Animation inspector</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="animation">
        <ImagePreview
          source={source}
          loading={!source && (image.status === "loading" || animation.status === "loading")}
          error={image.status === "error" ? image.message : undefined}
          chip={anim ? `Frame ${frame + 1} of ${frameCount}` : chipLabel(a)}
          end={actl ? "APNG" : "PNG"}
          toolbar={toolbar}
        />
        <div>
          <h2 className="section-label">Animation control · acTL</h2>
          <KeyValueList items={control} />
          <h2 className="section-label" style={{ marginTop: 28 }}>
            Frame control · fcTL{fc ? ` · frame ${frame + 1}` : ""}
          </h2>
          <KeyValueList items={frameItems} />
          {fcs.length > 1 && (
            <div className="frame-list card" style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
              <table className="frame-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Seq</th>
                    <th>Size</th>
                    <th>Offset</th>
                    <th>Delay</th>
                    <th>Dispose</th>
                    <th>Blend</th>
                  </tr>
                </thead>
                <tbody>
                  {fcs.map((f, i) => (
                    <tr
                      key={i}
                      className={i === frame ? "selected" : ""}
                      onClick={() => {
                        setPlaying(false);
                        setFrame(i);
                      }}
                    >
                      <td>{i + 1}</td>
                      <td className="mono">{f.sequenceNumber}</td>
                      <td className="mono">
                        {f.width}×{f.height}
                      </td>
                      <td className="mono">
                        {f.x},{f.y}
                      </td>
                      <td className="mono">{Math.round(frameDelayMs(f))} ms</td>
                      <td>{f.dispose}</td>
                      <td>{f.blend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
