import { useEffect, useState } from "react";
import { decodeAnimationRgba8Async, decodeRgba8Async, type RgbaAnimation, type RgbaImage } from "format-png";
import type { Analysis } from "../png/analyze";

export type Decoded<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error"; message: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The default image as 8-bit RGBA, decoded in a worker. */
export function useDecodedImage(analysis: Analysis): Decoded<RgbaImage> {
  const [state, setState] = useState<Decoded<RgbaImage>>({ status: "idle" });

  useEffect(() => {
    if (analysis.fatalError) {
      setState({ status: "error", message: analysis.fatalError });
      return;
    }
    let live = true;
    setState({ status: "loading" });
    decodeRgba8Async(analysis.bytes, { validateCrc: false }).then(
      (value) => live && setState({ status: "ready", value }),
      (e) => live && setState({ status: "error", message: message(e) }),
    );
    return () => {
      live = false;
    };
  }, [analysis]);

  return state;
}

/** Above this, composited frames would take too much memory to hold at once. */
export const MAX_ANIMATION_BYTES = 768 * 1024 * 1024;

export function animationBytes(a: Analysis): number {
  if (!a.header || !a.animationControl) return 0;
  return a.header.width * a.header.height * 4 * a.animationControl.numFrames;
}

/** Every APNG frame composited as a viewer shows it. Decoding starts the first time `enabled` is true. */
export function useDecodedAnimation(analysis: Analysis, enabled: boolean): Decoded<RgbaAnimation> {
  const [result, setResult] = useState<{ for: Analysis; state: Decoded<RgbaAnimation> } | null>(null);
  const [requested, setRequested] = useState<Analysis | null>(null);
  if (enabled && requested !== analysis) setRequested(analysis);

  const animated = !!analysis.animationControl && !analysis.fatalError;
  const tooLarge = animationBytes(analysis) > MAX_ANIMATION_BYTES;

  useEffect(() => {
    if (requested !== analysis || !animated || tooLarge) return;
    let live = true;
    setResult({ for: analysis, state: { status: "loading" } });
    decodeAnimationRgba8Async(analysis.bytes, { validateCrc: false }).then(
      (value) => live && setResult({ for: analysis, state: { status: "ready", value } }),
      (e) => live && setResult({ for: analysis, state: { status: "error", message: message(e) } }),
    );
    return () => {
      live = false;
    };
  }, [requested, analysis, animated, tooLarge]);

  return result?.for === analysis ? result.state : { status: "idle" };
}
