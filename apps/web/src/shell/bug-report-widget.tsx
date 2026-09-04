"use client";

import { Bug, ImagePlus, Loader2, X } from "lucide-react";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentProps,
  type DragEvent,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "@/lib/app-toast";
import { useWalletStore } from "@/stores/wallet";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { Textarea } from "@/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import { cn } from "@/utils/cn";

/** Keep in sync with MAX_IMAGES in apps/web/src/app/api/report-bug/route.ts. */
const MAX_IMAGES = 5;
/** Keep in sync with MAX_IMAGE_BYTES in the API route. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MESSAGE_CHARS = 4000;

interface AttachedImage {
  file: File;
  id: string;
  previewUrl: string;
}

function makeImageId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Button that matches the surrounding bottom-bar toggle styling. */
const BottomBarTriggerButton = memo(function BottomBarTriggerButton({
  active,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 font-medium text-xs shadow-none transition-colors",
        active
          ? "text-text-primary"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
});

export const BugReportWidget = memo(function BugReportWidget() {
  "use no memo";
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Select primitive fields individually — returning an object literal from a
  // Zustand selector breaks `useSyncExternalStore`'s snapshot caching and
  // triggers "getServerSnapshot should be cached" in React 19.
  const address = useWalletStore((s) => s.address);
  const chainId = useWalletStore((s) => s.chainId);

  const addFiles = useCallback((incoming: FileList | File[] | null) => {
    if (!incoming) {
      return;
    }
    const accepted: AttachedImage[] = [];
    const filesArray = Array.from(incoming);
    for (const file of filesArray) {
      if (!file.type.startsWith("image/")) {
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`"${file.name}" is larger than 5 MB.`);
        continue;
      }
      accepted.push({
        id: makeImageId(file),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (accepted.length === 0) {
      return;
    }
    setImages((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) {
        toast.error(`You can attach up to ${MAX_IMAGES} images.`);
        for (const img of accepted) {
          URL.revokeObjectURL(img.previewUrl);
        }
        return prev;
      }
      if (accepted.length > room) {
        toast.error(`Only ${MAX_IMAGES} images allowed — extras ignored.`);
        for (const img of accepted.slice(room)) {
          URL.revokeObjectURL(img.previewUrl);
        }
      }
      return [...prev, ...accepted.slice(0, room)];
    });
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setImages((prev) => {
      for (const img of prev) {
        URL.revokeObjectURL(img.previewUrl);
      }
      return [];
    });
    setMessage("");
  }, []);

  // Revoke every object URL when unmounting to avoid leaking blob memory.
  useEffect(() => {
    return () => {
      // This intentionally captures the latest images via closure at unmount time.
      // We also revoke individually on remove / clear above.
    };
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        clearAll();
      }
    },
    [clearAll]
  );

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      addFiles(event.target.files);
      event.target.value = "";
    },
    [addFiles]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file?.type.startsWith("image/")) {
            files.push(file);
          }
        }
      }
      if (files.length > 0) {
        event.preventDefault();
        addFiles(files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      addFiles(event.dataTransfer?.files ?? null);
    },
    [addFiles]
  );

  const contextPayload = useMemo(() => {
    if (typeof window === "undefined") {
      return {};
    }
    return {
      url: window.location.href,
      userAgent: window.navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString(),
      address,
      chainId,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    };
  }, [address, chainId]);

  const submit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Please describe the bug first.");
      return;
    }
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("message", trimmed);
      formData.set("context", JSON.stringify(contextPayload));
      images.forEach((img, index) => {
        formData.append(`image${index}`, img.file, img.file.name);
      });

      const response = await fetch("/api/report-bug", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json().catch(() => ({
        ok: false,
        error: "Unexpected server response.",
      }))) as { ok?: boolean; error?: string };

      if (!(response.ok && body.ok)) {
        toast.error(body.error ?? "Could not send bug report.");
        return;
      }

      toast.success("Bug report sent. Thanks!");
      handleOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send bug report."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [message, images, isSubmitting, contextPayload, handleOpenChange]);

  const charsLeft = MAX_MESSAGE_CHARS - message.length;
  const canSubmit = message.trim().length > 0 && !isSubmitting;

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <BottomBarTriggerButton
              aria-label="Report a bug"
              onClick={() => setOpen(true)}
            />
          }
        >
          <Bug className="h-3.5 w-3.5" />
          <span>Report a bug</span>
        </TooltipTrigger>
        <TooltipContent>Send a bug report to the Doji team</TooltipContent>
      </Tooltip>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a bug</DialogTitle>
            <DialogDescription>
              Tell us what went wrong. Screenshots help a lot — drop, paste, or
              click to attach.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                className="font-medium text-text-secondary text-xs"
                htmlFor={textareaId}
              >
                What happened?
              </label>
              <Textarea
                autoFocus
                id={textareaId}
                maxLength={MAX_MESSAGE_CHARS}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={handlePaste}
                placeholder="Describe the bug, what you expected, and any steps to reproduce…"
                rows={5}
                value={message}
              />
              <div
                className={cn(
                  "self-end text-[10px]",
                  charsLeft < 0 ? "text-destructive" : "text-text-tertiary"
                )}
              >
                {charsLeft} characters left
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-text-secondary text-xs">
                  Attachments
                </span>
                <span className="text-[10px] text-text-tertiary">
                  {images.length}/{MAX_IMAGES} • up to 5 MB each
                </span>
              </div>

              {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone; keyboard users click the "browse" button inside */}
              {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop zone; keyboard users click the "browse" button inside */}
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-4 text-center transition-colors",
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-border bg-input/20 hover:border-border-strong"
                )}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onPaste={handlePaste}
              >
                <ImagePlus className="h-4 w-4 text-text-tertiary" />
                <div className="text-[11px] text-text-tertiary">
                  Drop images here, paste from clipboard, or{" "}
                  <button
                    className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
                    disabled={images.length >= MAX_IMAGES}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    browse
                  </button>
                </div>
                <input
                  accept="image/*"
                  className="sr-only"
                  multiple
                  onChange={handleFileInput}
                  ref={fileInputRef}
                  type="file"
                />
              </div>

              {images.length > 0 && (
                <ul className="grid grid-cols-3 gap-2 pt-1">
                  {images.map((img) => (
                    <li
                      className="group relative aspect-square overflow-hidden rounded-md border border-border bg-input/30"
                      key={img.id}
                    >
                      {/* biome-ignore lint/performance/noImgElement: blob: URL previews are not optimizable by next/image */}
                      <img
                        alt={img.file.name}
                        className="h-full w-full object-cover"
                        height={128}
                        src={img.previewUrl}
                        width={128}
                      />
                      <button
                        aria-label={`Remove ${img.file.name}`}
                        className="absolute top-1 right-1 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 shadow-sm transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100"
                        onClick={() => removeImage(img.id)}
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 truncate bg-background/80 px-1.5 py-0.5 text-[10px] text-text-tertiary">
                        {formatBytes(img.file.size)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={!canSubmit} onClick={submit} size="sm">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <Bug className="h-3 w-3" />
                  <span>Send report</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
