import { CodeXml, FileText, Layers, LayoutGrid, Play, type LucideIcon } from "lucide-react";

export type TabId = "overview" | "chunks" | "metadata" | "animation" | "hex";

export const TABS: { id: TabId; label: string; sideLabel: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", sideLabel: "Inspector", icon: LayoutGrid },
  { id: "chunks", label: "Chunks", sideLabel: "Chunks", icon: Layers },
  { id: "metadata", label: "Metadata", sideLabel: "Metadata", icon: FileText },
  { id: "animation", label: "Animation", sideLabel: "Animation", icon: Play },
  { id: "hex", label: "Hex viewer", sideLabel: "Hex viewer", icon: CodeXml },
];

export const isTabId = (s: string): s is TabId => TABS.some((t) => t.id === s);

export const APP_VERSION = "0.1.0";
export const SPEC_URL = "https://www.w3.org/TR/png-3/";
