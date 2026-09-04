/**
 * Sonner wrapper: respects notification preference `displayToasts`.
 * Import `toast` from here instead of `sonner` so settings apply app-wide.
 */

import { toast as sonnerToast } from "sonner";

import { useNotificationsStore } from "@/stores/notifications";

export function shouldShowInAppToasts(): boolean {
  return useNotificationsStore.getState().preferences.displayToasts;
}

function noopToastId(): string {
  return "";
}

type SonnerToast = typeof sonnerToast;

export const toast = Object.assign(
  (message: Parameters<SonnerToast>[0], data?: Parameters<SonnerToast>[1]) => {
    if (!shouldShowInAppToasts()) {
      return noopToastId();
    }
    return sonnerToast(message, data);
  },
  {
    success: (...args: Parameters<SonnerToast["success"]>) => {
      if (!shouldShowInAppToasts()) {
        return noopToastId();
      }
      return sonnerToast.success(...args);
    },
    info: (...args: Parameters<SonnerToast["info"]>) => {
      if (!shouldShowInAppToasts()) {
        return noopToastId();
      }
      return sonnerToast.info(...args);
    },
    warning: (...args: Parameters<SonnerToast["warning"]>) => {
      if (!shouldShowInAppToasts()) {
        return noopToastId();
      }
      return sonnerToast.warning(...args);
    },
    error: (...args: Parameters<SonnerToast["error"]>) => {
      if (!shouldShowInAppToasts()) {
        return noopToastId();
      }
      return sonnerToast.error(...args);
    },
    message: (...args: Parameters<SonnerToast["message"]>) => {
      if (!shouldShowInAppToasts()) {
        return noopToastId();
      }
      return sonnerToast.message(...args);
    },
    loading: (...args: Parameters<SonnerToast["loading"]>) => {
      if (!shouldShowInAppToasts()) {
        return noopToastId();
      }
      return sonnerToast.loading(...args);
    },
    custom: (...args: Parameters<SonnerToast["custom"]>) => {
      if (!shouldShowInAppToasts()) {
        return noopToastId();
      }
      return sonnerToast.custom(...args);
    },
    promise: (...args: Parameters<SonnerToast["promise"]>) => {
      if (!shouldShowInAppToasts()) {
        const [promise] = args;
        const p = typeof promise === "function" ? promise() : promise;
        return {
          unwrap: () => p,
        } as ReturnType<SonnerToast["promise"]>;
      }
      return sonnerToast.promise(...args);
    },
    dismiss: sonnerToast.dismiss,
    getHistory: sonnerToast.getHistory,
    getToasts: sonnerToast.getToasts,
  }
) as typeof sonnerToast;
