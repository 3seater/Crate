"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/utils/cn";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full outline-none transition-[background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        /* Off: surface-3 track with a visible border for definition */
        "data-unchecked:bg-surface-3 data-unchecked:shadow-[inset_0_1px_2px_rgb(0_0_0/0.35),0_0_0_1px_rgb(255_255_255/0.08)]",
        /* On: lighter neutral, border shifts to white/10 */
        "data-checked:bg-[oklch(0.42_0_0)] data-checked:shadow-[inset_0_1px_2px_rgb(0_0_0/0.2),0_0_0_1px_rgb(255_255_255/0.12)]",
        "data-[size=default]:h-[16.6px] data-[size=sm]:h-3.5 data-[size=default]:w-7 data-[size=sm]:w-6",
        "after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className
      )}
      data-size={size}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full transition-transform duration-200",
          /* White thumb with layered shadow for depth — raised look */
          "bg-white shadow-[0_1px_3px_rgb(0_0_0/0.35),0_1px_1px_rgb(0_0_0/0.2)] ring-1 ring-black/10",
          "data-checked:shadow-[0_1px_4px_rgb(0_0_0/0.4),0_1px_2px_rgb(0_0_0/0.25)] data-checked:ring-black/15",
          "group-data-[size=default]/switch:size-3.5 group-data-[size=sm]/switch:size-3",
          "group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)]",
          "group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
