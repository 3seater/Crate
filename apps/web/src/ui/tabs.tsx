"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/utils/cn";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      data-orientation={orientation}
      data-slot="tabs"
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-full p-[3px] text-muted-foreground data-[variant=line]:rounded-none group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function TabsList({
  className,
  variant = "default",
  value,
  ...props
}: TabsPrimitive.List.Props &
  VariantProps<typeof tabsListVariants> & { value?: string }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: props.children triggers indicator recalc when tabs change
  useLayoutEffect(() => {
    if (variant !== "line") {
      return;
    }
    const list = listRef.current;
    if (!list) {
      return;
    }

    const updateIndicator = () => {
      const active =
        list.querySelector("[data-active]") ??
        list.querySelector('[role="tab"][aria-selected="true"]');
      if (!active) {
        setIndicator(null);
        return;
      }
      const lr = list.getBoundingClientRect();
      const ar = active.getBoundingClientRect();
      setIndicator({ left: ar.left - lr.left, width: ar.width });
    };

    updateIndicator();

    const observer = new MutationObserver(() => {
      updateIndicator();
    });
    observer.observe(list, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-active"],
    });

    window.addEventListener("resize", updateIndicator);

    const raf = requestAnimationFrame(() => {
      updateIndicator();
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [variant, value, props.children]);

  return (
    <TabsPrimitive.List
      className={cn(
        tabsListVariants({ variant }),
        variant === "line" && "relative",
        className
      )}
      data-slot="tabs-list"
      data-variant={variant}
      ref={listRef}
      {...props}
    >
      {props.children}
      {variant === "line" && indicator && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 z-10 h-0.5 bg-primary transition-[left,width] duration-200 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-1.5 py-0.5 font-medium text-foreground/60 text-xs transition-all hover:text-text-primary focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:py-[calc(--spacing(1.25))] dark:text-muted-foreground dark:hover:text-text-primary [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-text-primary dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-text-primary",
        "group-data-[variant=line]/tabs-list:after:hidden! after:absolute after:bg-primary after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-horizontal/tabs:after:-bottom-1.25 group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:w-0.5 group-data-[variant=default]/tabs-list:data-active:after:opacity-100",
        className
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn("flex-1 text-xs/relaxed outline-none", className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
