import { useState, type DragEvent } from "react";
import { Binary, CircleAlert, Layers, LoaderCircle, Lock, Upload } from "lucide-react";
import type { Theme } from "../state/useTheme";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function EmptyState({
  theme,
  onToggleTheme,
  onOpen,
  onFile,
  loadingName,
  error,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onOpen: () => void;
  onFile: (file: File) => void;
  loadingName?: string;
  error?: { name: string; message: string };
}) {
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div className="landing">
      <header className="landing-top">
        <Logo />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>
      <main className="landing-main">
        <div className="landing-inner">
          <h1>
            Every last byte of your <em>PNG</em>.
          </h1>
          <p className="landing-lead">
            Inspect chunks, checksums, color metadata, text, APNG frames and the raw hex of any PNG file.
            Everything runs in your browser.
          </p>
          <div
            className={`dropzone${dragging ? " dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="dropzone-icon">
              <Upload size={28} />
            </div>
            <strong>Drop a PNG here</strong>
            <p>or paste one from your clipboard</p>
            <button className="btn btn-primary btn-lg" onClick={onOpen}>
              Choose a file
            </button>
          </div>
          {loadingName && (
            <div className="loading">
              <LoaderCircle size={18} className="spin" />
              Reading {loadingName}…
            </div>
          )}
          {error && (
            <div className="load-error" role="alert">
              <CircleAlert size={20} />
              <div>
                <strong>Couldn't open {error.name || "that file"}</strong>
                <p>{error.message}</p>
              </div>
            </div>
          )}
          <div className="features">
            <div className="card feature">
              <Layers size={20} />
              <h3>Every chunk</h3>
              <p>Critical, ancillary, APNG and private chunks, each field mapped to its bytes.</p>
            </div>
            <div className="card feature">
              <Binary size={20} />
              <h3>Raw hex</h3>
              <p>Browse the whole file, colored by structure, with CRC-32 verified for every chunk.</p>
            </div>
            <div className="card feature">
              <Lock size={20} />
              <h3>Private by design</h3>
              <p>No uploads, no server, no tracking. Your files never leave your device.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
