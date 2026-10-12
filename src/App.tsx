import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "./components/EmptyState";
import { Workspace } from "./Workspace";
import { useFileLoader } from "./state/useFileLoader";
import { useTheme } from "./state/useTheme";

export function App() {
  const { theme, toggle } = useTheme();
  const { state, load, close } = useFileLoader();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const open = useCallback(() => input.current?.click(), []);

  // Files can be dropped anywhere, or pasted from the clipboard.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) load(file);
    };
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      const file = files.find((f) => f.type === "image/png") ?? files[0];
      if (file) {
        e.preventDefault();
        load(file);
      }
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [load]);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,.png,.apng"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) load(file);
          e.target.value = "";
        }}
      />
      {state.status === "ready" ? (
        <Workspace
          key={`${state.analysis.fileName}:${state.analysis.fileSize}:${state.analysis.lastModified ?? ""}`}
          analysis={state.analysis}
          theme={theme}
          onToggleTheme={toggle}
          onOpen={open}
          onClose={close}
        />
      ) : (
        <EmptyState
          theme={theme}
          onToggleTheme={toggle}
          onOpen={open}
          onFile={load}
          loadingName={state.status === "loading" ? state.name : undefined}
          error={state.status === "error" ? state : undefined}
        />
      )}
      {dragging && (
        <div className="drag-overlay">
          <div>Drop a PNG to inspect it</div>
        </div>
      )}
    </>
  );
}
