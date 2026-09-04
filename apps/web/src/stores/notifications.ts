import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export const NOTIFICATION_SOUNDS = [
  "blip",
  "click",
  "coin",
  "ding",
  "kaching",
  "oof",
  "ring",
  "yeah-bwoi",
] as const;
export type NotificationSound = (typeof NOTIFICATION_SOUNDS)[number];

export interface NotificationPreferences {
  /** Whether to display sonner toasts for user actions (buy/sell/place/cancel) */
  displayToasts: boolean;
  /** Whether to play a sound on toast */
  soundEnabled: boolean;
  /** Which sound to play */
  soundName: NotificationSound;
  /** Sound volume 0–100 */
  soundVolume: number;
  /** Where toasts appear on screen */
  toastPosition: ToastPosition;
}

export interface NotificationsState {
  preferences: NotificationPreferences;
}

interface NotificationsActions {
  clearAll: () => void;
  setPreference: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => void;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  displayToasts: true,
  toastPosition: "bottom-right",
  soundEnabled: false,
  soundName: "ding",
  soundVolume: 50,
};

const initialState: NotificationsState = {
  preferences: { ...DEFAULT_PREFERENCES },
};

function mergePreferences(
  persisted: Partial<NotificationPreferences> | undefined
): NotificationPreferences {
  if (!persisted) {
    return { ...DEFAULT_PREFERENCES };
  }
  return {
    displayToasts: persisted.displayToasts ?? DEFAULT_PREFERENCES.displayToasts,
    toastPosition: persisted.toastPosition ?? DEFAULT_PREFERENCES.toastPosition,
    soundEnabled: persisted.soundEnabled ?? DEFAULT_PREFERENCES.soundEnabled,
    soundName: persisted.soundName ?? DEFAULT_PREFERENCES.soundName,
    soundVolume: persisted.soundVolume ?? DEFAULT_PREFERENCES.soundVolume,
  };
}

export const useNotificationsStore = create<
  NotificationsState & NotificationsActions
>()(
  persist(
    (set) => ({
      ...initialState,

      setPreference: (key, value) => {
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        }));
      },

      clearAll: () => set(initialState),
    }),
    {
      name: "doji-notifications-storage",
      partialize: (state) => ({
        preferences: state.preferences,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<NotificationsState> | undefined;
        return {
          ...current,
          ...p,
          preferences: mergePreferences(p?.preferences),
        };
      },
    }
  )
);
