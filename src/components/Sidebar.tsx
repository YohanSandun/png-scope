import { ArrowUpRight, BookOpen, FileImage, Lock } from "lucide-react";
import { hasErrors, type Analysis } from "../png/analyze";
import { formatBytes } from "../png/format";
import { APP_VERSION, SPEC_URL, TABS, type TabId } from "../tabs";
import { Logo } from "./Logo";

export function Sidebar({
  analysis,
  tab,
  onTab,
}: {
  analysis: Analysis;
  tab: TabId;
  onTab: (t: TabId) => void;
}) {
  return (
    <aside className="sidebar">
      <Logo />
      <div className="side-label">Workspace</div>
      <nav className="side-nav">
        {TABS.map(({ id, sideLabel, icon: Icon }) => (
          <button
            key={id}
            className={`side-link${tab === id ? " active" : ""}`}
            onClick={() => onTab(id)}
            aria-current={tab === id ? "page" : undefined}
          >
            <Icon size={19} />
            {sideLabel}
            {id === "chunks" && <span className="count">{analysis.chunks.length}</span>}
          </button>
        ))}
      </nav>
      <div className="side-divider" />
      <div className="current-file">
        <div className="current-file-head">
          Current file
          <span className={`status-dot${hasErrors(analysis) ? " bad" : ""}`} />
        </div>
        <div className="current-file-name">
          <FileImage size={18} />
          {analysis.fileName}
        </div>
        <div className="current-file-meta">{formatBytes(analysis.fileSize)} · PNG image</div>
      </div>
      <div className="side-bottom">
        <a className="side-row" href={SPEC_URL} target="_blank" rel="noreferrer">
          <BookOpen size={18} />
          PNG reference
          <ArrowUpRight size={16} />
        </a>
        <div className="side-row">
          <Lock size={16} />
          Your files stay on your device
        </div>
        <div className="side-version">PNGScope / Version {APP_VERSION}</div>
      </div>
    </aside>
  );
}
