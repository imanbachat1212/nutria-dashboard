import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "@/lib/utils";

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

// `portal` is opt-in and defaults to false (prompt-114) — purely additive, so every existing
// caller keeps the exact non-portalled behaviour it was written against. nutrient-contributions.tsx
// documents a dependency on it (its content inherits the trigger's text-align, which is why it
// passes text-left), so flipping the default would change that file's rendering.
//
// Opt in when the trigger sits inside a clipping ancestor — a Dialog, or a ScrollArea viewport.
// Radix positions the content absolutely but does NOT escape `overflow` without a Portal, so an
// un-portalled card there is cut off at the container's edge. Measured: in plan-item-picker's
// Recipes tab the card laid out at x=989 with the dialog ending at x=1005, leaving a 16px
// sliver visible. Nothing in the DOM reports that — innerText reads the full card either way.
const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content> & { portal?: boolean }
>(({ className, align = "center", sideOffset = 4, portal = false, ...props }, ref) => {
  const content = (
    <HoverCardPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-hover-card-content-transform-origin)",
        className,
      )}
      {...props}
    />
  );
  return portal ? <HoverCardPrimitive.Portal>{content}</HoverCardPrimitive.Portal> : content;
});
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent };
