"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/ui/sheet";
import { HeaderNav } from "./header-nav";

/** Client island: mobile hamburger menu with nav drawer. */
export function HeaderMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        aria-controls="mobile-nav-sheet"
        aria-expanded={open}
        aria-label="Open main navigation"
        render={(props) => {
          const { asChild: _a, ...rest } = props as typeof props & {
            asChild?: boolean;
          };
          return (
            <Button className="size-10" size="icon" variant="ghost" {...rest}>
              <MenuIcon className="size-5" />
            </Button>
          );
        }}
      />
      <SheetContent
        className="w-72 sm:max-w-sm"
        id="mobile-nav-sheet"
        showCloseButton
        side="left"
      >
        <SheetTitle className="sr-only">Main navigation</SheetTitle>
        <div className="flex flex-col gap-2 pt-8">
          <HeaderNav />
        </div>
      </SheetContent>
    </Sheet>
  );
}
