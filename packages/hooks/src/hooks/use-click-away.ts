import type { BasicTarget } from "../lib/create-effect-with-target";
import { getTargetElement } from "../lib/create-effect-with-target";
import { useEffectWithTarget } from "./use-effect-with-target";
import { useLatest } from "./use-latest";

type DocumentEventKey = keyof DocumentEventMap;

const getDocumentOrShadow = (
  target: BasicTarget | BasicTarget[]
): Document | Node => {
  if (!(target && document.getRootNode)) {
    return document;
  }
  const targets = Array.isArray(target) ? target : [target];
  const first = getTargetElement(targets[0]);
  if (first?.getRootNode() instanceof ShadowRoot) {
    return first.getRootNode();
  }
  return document;
};

/** Calls onClickAway when a click occurs outside the target element(s). */
export function useClickAway<T extends Event = Event>(
  onClickAway: (event: T) => void,
  target: BasicTarget | BasicTarget[],
  eventName: DocumentEventKey | DocumentEventKey[] = "click"
): void {
  const onClickAwayRef = useLatest(onClickAway);

  useEffectWithTarget(
    () => {
      const handler = (event: Event) => {
        const targets = Array.isArray(target) ? target : [target];
        const clickedInside = targets.some((item) => {
          const el = getTargetElement(item);
          return el?.contains(event.target as Node);
        });
        if (clickedInside) {
          return;
        }
        onClickAwayRef.current(event as T);
      };

      const doc = getDocumentOrShadow(target);
      const eventNames = Array.isArray(eventName) ? eventName : [eventName];

      for (const ev of eventNames) {
        doc.addEventListener(ev, handler);
      }
      return () => {
        for (const ev of eventNames) {
          doc.removeEventListener(ev, handler);
        }
      };
    },
    Array.isArray(eventName) ? eventName : [eventName],
    target
  );
}
