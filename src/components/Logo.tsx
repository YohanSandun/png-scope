import { ScanSearch } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`logo ${className}`}>
      <span className="logo-mark">
        <ScanSearch size={22} strokeWidth={2.2} />
      </span>
      <span>
        PNGScope<span className="dot">.</span>
      </span>
    </span>
  );
}
