import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Grid2x2, Image as ImageIcon, LoaderCircle, Maximize2, Minimize2, Scan, ZoomIn, ZoomOut } from "lucide-react";

export interface PixelSource {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const ZOOM_STEPS = [0.05, 0.1, 0.125, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32];

export function ImagePreview({
  source,
  loading,
  error,
  chip,
  title = "Image preview",
  end = "PNG",
  toolbar,
}: {
  source?: PixelSource;
  loading?: boolean;
  error?: string;
  chip?: string;
  title?: string;
  end?: ReactNode;
  toolbar?: ReactNode;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [checker, setChecker] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [probe, setProbe] = useState<{ x: number; y: number; rgba: number[] } | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === cardRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    if (canvas.width !== source.width) canvas.width = source.width;
    if (canvas.height !== source.height) canvas.height = source.height;
    canvas
      .getContext("2d")!
      .putImageData(new ImageData(source.data, source.width, source.height), 0, 0);
  }, [source]);

  const fitScale = source
    ? Math.max(0.01, Math.min(32, (stage.w - 32) / source.width, (stage.h - 32) / source.height))
    : 1;
  // Fit shrinks large images and enlarges small ones by whole steps, so pixels stay square.
  const scale = zoom === "fit" ? (fitScale < 1 ? fitScale : Math.floor(fitScale)) : zoom;

  const step = (dir: 1 | -1) => {
    const i = ZOOM_STEPS.findIndex((z) => z >= scale - 1e-6);
    const idx = dir > 0 ? (ZOOM_STEPS[i] > scale + 1e-6 ? i : i + 1) : (i < 0 ? ZOOM_STEPS.length : i) - 1;
    setZoom(ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx))]);
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!source) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * source.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * source.height);
    if (x < 0 || y < 0 || x >= source.width || y >= source.height) return setProbe(null);
    const i = (y * source.width + x) * 4;
    setProbe({ x, y, rgba: Array.from(source.data.subarray(i, i + 4)) });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else cardRef.current?.requestFullscreen?.();
  };

  return (
    <section ref={cardRef} className="card preview-card">
      <header className="card-head">
        <h2 className="card-title">
          <ImageIcon size={18} />
          {title}
        </h2>
        <div className="end">{end}</div>
      </header>
        <div ref={stageRef} className={`preview-stage ${checker ? "checker" : "solid"}`}>
          {source && (
            <canvas
              ref={canvasRef}
              className={scale > 1 ? "pixelated" : ""}
              style={{ width: source.width * scale, height: source.height * scale }}
              onMouseMove={onMove}
              onMouseLeave={() => setProbe(null)}
            />
          )}
          {!source && (
            <div className="preview-msg">
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={22} />
                  Decoding…
                </>
              ) : (
                error && <>Couldn't decode the image: {error}</>
              )}
            </div>
          )}
          {chip && source && (
            <div className="preview-overlay">
              <span className="preview-chip">{chip}</span>
            </div>
          )}
        </div>
        {toolbar}
        <div className="preview-toolbar">
          <button className="icon-btn" onClick={() => step(-1)} disabled={!source} title="Zoom out" aria-label="Zoom out">
            <ZoomOut size={18} />
          </button>
          <span className="zoom mono">{Math.round(scale * 100)}%</span>
          <button className="icon-btn" onClick={() => step(1)} disabled={!source} title="Zoom in" aria-label="Zoom in">
            <ZoomIn size={18} />
          </button>
          <span className="toolbar-sep" />
          <button
            className={`icon-btn${zoom === "fit" ? " active" : ""}`}
            onClick={() => setZoom(zoom === "fit" ? 1 : "fit")}
            disabled={!source}
            title={zoom === "fit" ? "Actual size" : "Fit to view"}
            aria-label="Toggle fit to view"
          >
            <Scan size={18} />
          </button>
          <div className="probe mono" aria-live="off">
            {probe ? (
              <>
                <span
                  className="swatch"
                  style={{ background: `rgba(${probe.rgba[0]},${probe.rgba[1]},${probe.rgba[2]},${probe.rgba[3] / 255})` }}
                />
                {probe.x}, {probe.y} · {probe.rgba.join(" ")}
              </>
            ) : (
              source && `${source.width} × ${source.height}`
            )}
          </div>
          <button
            className={`icon-btn${checker ? " active" : ""}`}
            onClick={() => setChecker(!checker)}
            title="Transparency grid"
            aria-label="Toggle transparency grid"
          >
            <Grid2x2 size={18} />
          </button>
          <button className="icon-btn" onClick={toggleFullscreen} title="Full screen" aria-label="Toggle full screen">
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
    </section>
  );
}
