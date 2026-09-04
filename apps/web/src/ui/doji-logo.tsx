import Image from "next/image";

/** Brand logo loaded from public assets. */
export function DojiLogo({ className }: { className?: string }) {
  return (
    <Image
      alt="Doji"
      className={className}
      draggable={false}
      height={714}
      priority
      src="/doji-logo.svg"
      width={1430}
    />
  );
}

/** Wing mark only (no wordmark), from `doji-mark.svg`. */
export function DojiMark({ className }: { className?: string }) {
  return (
    <Image
      alt="Doji"
      className={className}
      draggable={false}
      height={260}
      priority
      src="/doji-mark.svg"
      width={200}
    />
  );
}
