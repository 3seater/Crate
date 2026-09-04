import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  copyImageToClipboard,
  saveImageAsFile,
} from "../../apps/web/src/components/share-pnl/share-actions";

describe("copyImageToClipboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("throws when Clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });

    const blob = new Blob(["test"], { type: "image/png" });
    await expect(copyImageToClipboard(blob)).rejects.toThrow(
      "Clipboard API is unavailable in this browser"
    );
  });

  it("calls clipboard.write with correct ClipboardItem", async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { write: writeMock } });
    vi.stubGlobal(
      "ClipboardItem",
      globalThis.ClipboardItem ??
        class ClipboardItem {
          types: string[];
          items: Record<string, Blob>;
          constructor(items: Record<string, Blob>) {
            this.items = items;
            this.types = Object.keys(items);
          }
          getType(type: string) {
            return Promise.resolve(this.items[type]);
          }
        }
    );

    const blob = new Blob(["test-png-data"], { type: "image/png" });
    await copyImageToClipboard(blob);

    expect(writeMock).toHaveBeenCalledOnce();
    const args = writeMock.mock.calls[0]?.[0];
    expect(args).toHaveLength(1);
    // Verify the ClipboardItem was constructed with image/png
    expect(args[0].types).toContain("image/png");
  });
});

describe("saveImageAsFile", () => {
  let clickMock: ReturnType<typeof vi.fn>;
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let anchorElement: Record<string, unknown>;

  beforeEach(() => {
    clickMock = vi.fn();
    anchorElement = { href: "", download: "", click: clickMock };

    const appendChildMock = vi.fn();
    const removeChildMock = vi.fn();
    const createElementMock = vi.fn().mockReturnValue(anchorElement);
    vi.stubGlobal("document", {
      createElement: createElementMock,
      body: { appendChild: appendChildMock, removeChild: removeChildMock },
    });

    createObjectURLMock = vi
      .fn()
      .mockReturnValue("blob:http://localhost/fake-url");
    revokeObjectURLMock = vi.fn();

    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates download link with correct filename", () => {
    const blob = new Blob(["test"], { type: "image/png" });
    saveImageAsFile(blob, "will-trump-win");

    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(anchorElement.download).toBe("doji-pnl-will-trump-win.png");
    expect(anchorElement.href).toBe("blob:http://localhost/fake-url");
    expect(clickMock).toHaveBeenCalledOnce();
  });

  it("revokes object URL after download", () => {
    const blob = new Blob(["test"], { type: "image/png" });
    saveImageAsFile(blob, "some-market");

    expect(revokeObjectURLMock).toHaveBeenCalledOnce();
    expect(revokeObjectURLMock).toHaveBeenCalledWith(
      "blob:http://localhost/fake-url"
    );
  });
});
