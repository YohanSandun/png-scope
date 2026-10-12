import { useCallback, useEffect, useState } from "react";
import { Asterisk, FileImage, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { hasErrors, type Analysis } from "./png/analyze";
import { formatBytes } from "./png/format";
import { downloadReport } from "./png/report";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { useDecodedAnimation, useDecodedImage } from "./state/useDecoded";
import type { Theme } from "./state/useTheme";
import { TABS, isTabId, type TabId } from "./tabs";
import { OverviewView } from "./views/OverviewView";
import { ChunksView } from "./views/ChunksView";
import { MetadataView } from "./views/MetadataView";
import { AnimationView } from "./views/AnimationView";
import { HexView, type HexTarget } from "./views/HexView";

function tabFromHash(): TabId {
  const h = window.location.hash.slice(1);
  return isTabId(h) ? h : "overview";
}

export function Workspace({
  analysis: a,
  theme,
  onToggleTheme,
  onOpen,
  onClose,
}: {
  analysis: Analysis;
  theme: Theme;
  onToggleTheme: () => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [tab, setTabState] = useState<TabId>(() => (a.fatalError ? "hex" : tabFromHash()));
  const [chunk, setChunk] = useState(0);
  const [hexTarget, setHexTarget] = useState<HexTarget | null>(null);

  const setTab = useCallback((t: TabId) => {
    setTabState(t);
    if (window.location.hash.slice(1) !== t) window.history.pushState(null, "", `#${t}`);
  }, []);

  useEffect(() => {
    const onPop = () => setTabState(tabFromHash());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const image = useDecodedImage(a);
  const animation = useDecodedAnimation(a, tab === "animation");

  const navigate = useCallback(
    (t: TabId, opts?: { chunk?: number; offset?: number }) => {
      if (opts?.chunk !== undefined) setChunk(opts.chunk);
      if (opts?.offset !== undefined) setHexTarget({ offset: opts.offset, nonce: Date.now() });
      setTab(t);
    },
    [setTab],
  );
  const toHex = useCallback((offset: number) => navigate("hex", { offset }), [navigate]);
  const toChunk = useCallback((index: number) => navigate("chunks", { chunk: index }), [navigate]);

  const bad = hasErrors(a);
  const issueText = a.issues.map((i) => i.message).join("\n");

  return (
    <div className="app">
      <Sidebar analysis={a} tab={tab} onTab={setTab} />
      <div className="main">
        <TopBar
          tab={tab}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onOpen={onOpen}
          onExport={() => downloadReport(a)}
          onClose={onClose}
        />
        <main className="content">
          <div className="page-head">
            <div style={{ minWidth: 0 }}>
              <h1 className="page-title">Image inspector</h1>
              <div className="page-sub">
                <span style={{ wordBreak: "break-all" }}>
                  <FileImage size={17} />
                  {a.fileName}
                </span>
                <span>{formatBytes(a.fileSize)}</span>
                {a.header && (
                  <span>
                    {a.header.width} × {a.header.height}
                  </span>
                )}
              </div>
            </div>
            {bad ? (
              <span className="pill pill-error" title={issueText}>
                <ShieldAlert size={15} /> {a.fatalError ? "Unreadable PNG" : "Issues found"}
              </span>
            ) : a.issues.length ? (
              <span className="pill pill-warn" title={issueText}>
                <ShieldAlert size={15} /> Valid with warnings
              </span>
            ) : (
              <span className="pill pill-ok">
                <ShieldCheck size={15} /> Valid PNG
              </span>
            )}
          </div>

          <div className="tabs" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`tab${tab === id ? " active" : ""}`}
                onClick={() => setTab(id)}
              >
                <Icon size={18} />
                {label}
                {id === "chunks" && <span className="tag">{a.chunks.length}</span>}
                {id === "animation" && a.animationControl && <span className="tag">APNG</span>}
              </button>
            ))}
          </div>

          <div className="tab-panel" role="tabpanel">
            {tab === "overview" && <OverviewView analysis={a} image={image} onNavigate={navigate} />}
            {tab === "chunks" && <ChunksView analysis={a} selected={chunk} onSelect={setChunk} onHex={toHex} />}
            {tab === "metadata" && <MetadataView analysis={a} onChunk={toChunk} />}
            {tab === "animation" && <AnimationView analysis={a} image={image} animation={animation} />}
            {tab === "hex" && <HexView analysis={a} target={hexTarget} />}
          </div>

          <footer className="footer">
            <span>
              <Lock size={14} /> Local preview. No uploads, no tracking.
            </span>
            <span>
              PNG specification, down to the last byte. <Asterisk size={14} color="var(--accent-text)" />
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
