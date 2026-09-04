import { useState } from "react";
import { isBrowser } from "../lib/is-browser";
import { useEventListener } from "./use-event-listener";

type VisibilityState = "hidden" | "visible" | "prerender" | undefined;

function getVisibility(): VisibilityState {
  if (!isBrowser) {
    return "visible";
  }
  return document.visibilityState;
}

/** Tracks document.visibilityState (tab focus). */
export function useDocumentVisibility(): VisibilityState {
  const [visibility, setVisibility] = useState<VisibilityState>(getVisibility);

  useEventListener(
    "visibilitychange",
    () => {
      setVisibility(getVisibility());
    },
    {
      target: () => document,
    }
  );

  return visibility;
}
