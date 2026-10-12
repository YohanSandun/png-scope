import { useCallback, useRef, useState } from "react";
import { analyzePng, type Analysis } from "../png/analyze";

export type LoadState =
  | { status: "idle" }
  | { status: "loading"; name: string }
  | { status: "ready"; analysis: Analysis }
  | { status: "error"; name: string; message: string };

export function useFileLoader() {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const request = useRef(0);

  const load = useCallback(async (file: File) => {
    const id = ++request.current;
    setState({ status: "loading", name: file.name });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const analysis = await analyzePng(bytes, file.name || "pasted.png", file.lastModified);
      if (id === request.current) setState({ status: "ready", analysis });
    } catch (e) {
      if (id === request.current) {
        setState({ status: "error", name: file.name, message: e instanceof Error ? e.message : String(e) });
      }
    }
  }, []);

  const close = useCallback(() => {
    request.current++;
    setState({ status: "idle" });
  }, []);

  return { state, load, close };
}
