import { Moon, Sun } from "lucide-react";
import type { Theme } from "../state/useTheme";

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className="icon-btn" onClick={onToggle} title={`Switch to ${next} theme`} aria-label={`Switch to ${next} theme`}>
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
