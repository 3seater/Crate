"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useNotificationsStore } from "@/stores/notifications";

const Toaster = ({ ...props }: ToasterProps) => {
  const toastPosition = useNotificationsStore(
    (s) => s.preferences.toastPosition
  );

  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-positive" />,
        info: <InfoIcon className="size-4 text-text-primary" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-negative" />,
        loading: (
          <Loader2Icon className="size-4 animate-spin text-text-primary" />
        ),
      }}
      position={toastPosition}
      richColors
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": "var(--card)",
          "--success-text": "var(--card-foreground)",
          "--success-border": "var(--border)",
          "--error-bg":
            "color-mix(in oklch, var(--color-loss) 16%, var(--card))",
          "--error-text": "var(--card-foreground)",
          "--error-border":
            "color-mix(in oklch, var(--color-loss) 42%, var(--border))",
          "--info-bg": "var(--card)",
          "--info-text": "var(--card-foreground)",
          "--info-border": "var(--border)",
          "--warning-bg": "var(--card)",
          "--warning-text": "var(--card-foreground)",
          "--warning-border": "var(--border)",
        } as React.CSSProperties
      }
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "cn-toast border border-border bg-card text-text-primary",
          error: "[&_[data-description]]:text-text-secondary",
          title: "text-text-primary font-medium",
          description: "text-text-secondary",
          actionButton:
            "bg-primary text-primary-foreground hover:bg-primary/80",
          cancelButton:
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
