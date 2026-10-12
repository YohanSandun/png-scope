import { ChevronRight, Download, Plus, X } from "lucide-react";
import type { Theme } from "../state/useTheme";
import { TABS, type TabId } from "../tabs";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar({
  tab,
  theme,
  onToggleTheme,
  onOpen,
  onExport,
  onClose,
}: {
  tab: TabId;
  theme: Theme;
  onToggleTheme: () => void;
  onOpen: () => void;
  onExport: () => void;
  onClose: () => void;
}) {
  const current = TABS.find((t) => t.id === tab)!;
  return (
    <header className="topbar">
      <Logo className="topbar-logo" />
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span className="crumb-root">Workspace</span>
        <ChevronRight size={16} className="crumb-root" />
        <strong>{current.id === "overview" ? "Image inspector" : current.label}</strong>
      </nav>
      <div className="topbar-actions">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button className="icon-btn" onClick={onClose} title="Close file" aria-label="Close file">
          <X size={18} />
        </button>
        <button className="btn" onClick={onExport} title="Download a JSON report of this file">
          <Download size={17} />
          <span className="btn-label">Export report</span>
        </button>
        <button className="btn btn-primary" onClick={onOpen}>
          <Plus size={17} />
          <span className="btn-label">Open PNG</span>
        </button>
      </div>
    </header>
  );
}
