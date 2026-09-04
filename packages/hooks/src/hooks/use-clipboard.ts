import { useEffect, useMemo, useRef, useState } from "react";
import { isBrowser } from "../lib/is-browser";
import { useEventListener } from "./use-event-listener";
import { useMemoizedFn } from "./use-memoized-fn";
import { useUnmount } from "./use-unmount";

export interface UseClipboardOptions {
  /** Ms before resetting `copied` to false. Default 1500. Pass 0 to never auto-reset. */
  copiedDuring?: number;
  /** Fallback to document.execCommand('copy') if Clipboard API unavailable. Default false. */
  legacy?: boolean;
  /** Called on copy failure. */
  onError?: (err: unknown) => void;
  /** Called on successful copy. */
  onSuccess?: () => void;
  /** Enable reading from clipboard. Default false. */
  read?: boolean;
  /** Alias for copiedDuring. */
  resetAfterMs?: number;
  /** Default source for copy when called without arg. */
  source?: string;
}

export interface UseClipboardReturn {
  copied: boolean;
  copy: (text?: string) => Promise<void>;
  isSupported: boolean;
  text: string;
}

type PermissionState = "granted" | "denied" | "prompt" | undefined;

function isAllowed(status: PermissionState): boolean {
  return status === "granted" || status === "prompt";
}

function legacyCopy(value: string): void {
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "absolute";
  ta.style.opacity = "0";
  ta.setAttribute("readonly", "");
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

function legacyRead(): string {
  return document?.getSelection?.()?.toString() ?? "";
}

/** Reactive Clipboard API with copy/read support. */
export function useClipboard(
  options: UseClipboardOptions = {}
): UseClipboardReturn {
  const {
    read = false,
    source,
    copiedDuring = 1500,
    resetAfterMs,
    legacy = false,
    onSuccess,
    onError,
  } = options;

  const copiedDuringMs = resetAfterMs ?? copiedDuring;

  const [text, setText] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [permissionRead, setPermissionRead] =
    useState<PermissionState>(undefined);
  const [permissionWrite, setPermissionWrite] =
    useState<PermissionState>(undefined);
  const timeoutRef = useRef<number | null>(null);

  const isClipboardApiSupported = useMemo(() => {
    if (!isBrowser) {
      return false;
    }
    return "clipboard" in navigator;
  }, []);

  const isSupported = useMemo(
    () => isClipboardApiSupported || legacy,
    [isClipboardApiSupported, legacy]
  );

  useEffect(() => {
    if (!(isBrowser && isClipboardApiSupported)) {
      return;
    }
    const check = async () => {
      try {
        if ("permissions" in navigator) {
          const readPerm = await navigator.permissions.query({
            name: "clipboard-read" as PermissionName,
          });
          setPermissionRead(readPerm.state);
          readPerm.onchange = () => setPermissionRead(readPerm.state);

          const writePerm = await navigator.permissions.query({
            name: "clipboard-write" as PermissionName,
          });
          setPermissionWrite(writePerm.state);
          writePerm.onchange = () => setPermissionWrite(writePerm.state);
        }
      } catch {
        // Permissions API not supported
      }
    };
    check();
  }, [isClipboardApiSupported]);

  const updateText = useMemoizedFn(async () => {
    let useLegacy = !(isClipboardApiSupported && isAllowed(permissionRead));
    if (!useLegacy) {
      try {
        const clipboardText = await navigator.clipboard.readText();
        setText(clipboardText);
      } catch {
        useLegacy = true;
      }
    }
    if (useLegacy) {
      setText(legacyRead());
    }
  });

  useEventListener(isSupported && read ? ["copy", "cut"] : [], updateText, {
    passive: true,
    enable: isSupported && read,
  });

  const copy = useMemoizedFn(async (value?: string) => {
    const textToCopy = value ?? source;
    if (!isSupported || textToCopy == null) {
      return;
    }

    let useLegacy = !(isClipboardApiSupported && isAllowed(permissionWrite));
    if (!useLegacy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
      } catch (err) {
        onError?.(err);
        useLegacy = true;
      }
    }
    if (useLegacy) {
      legacyCopy(textToCopy);
    }

    setText(textToCopy);
    setCopied(true);
    onSuccess?.();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (copiedDuringMs > 0) {
      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, copiedDuringMs);
    }
  });

  useUnmount(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  });

  return { isSupported, text, copied, copy };
}
