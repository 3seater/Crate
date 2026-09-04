import type { NotificationSound } from "@/stores/notifications";
import { useNotificationsStore } from "@/stores/notifications";

const SOUND_PATHS: Record<NotificationSound, string> = {
  blip: "/sounds/blip.mp3",
  click: "/sounds/click.mp3",
  coin: "/sounds/coin.mp3",
  ding: "/sounds/ding.mp3",
  kaching: "/sounds/kaching.mp3",
  oof: "/sounds/oof.mp3",
  ring: "/sounds/ring.mp3",
  "yeah-bwoi": "/sounds/yeah-bwoi.mp3",
};

/** Cache audio elements so we don't re-create on every play. */
const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(src: string): HTMLAudioElement {
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audioCache.set(src, audio);
  }
  return audio;
}

/** Play the user's chosen notification sound at their chosen volume. */
export function playNotificationSound(): void {
  const { soundEnabled, soundName, soundVolume } =
    useNotificationsStore.getState().preferences;
  if (!soundEnabled) {
    return;
  }

  const src = SOUND_PATHS[soundName];
  if (!src) {
    return;
  }

  const audio = getAudio(src);
  audio.volume = Math.max(0, Math.min(1, soundVolume / 100));
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Browser may block autoplay before user interaction — silently ignore.
  });
}

/** Preview a specific sound at a specific volume (for settings UI). */
export function previewSound(name: NotificationSound, volume: number): void {
  const src = SOUND_PATHS[name];
  if (!src) {
    return;
  }

  const audio = getAudio(src);
  audio.volume = Math.max(0, Math.min(1, volume / 100));
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Silently ignore autoplay restrictions.
  });
}
