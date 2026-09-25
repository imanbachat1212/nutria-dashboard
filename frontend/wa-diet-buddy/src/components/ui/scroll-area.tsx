import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

// `...props` and the forwarded `ref` both land on Radix's Root, which is NOT the element that
// scrolls — the Viewport inside it is. That matters for exactly one kind of prop: an onScroll
// passed to <ScrollArea> attaches to Root and never fires, because scroll events do not bubble.
// (Pointer events like onDragOver are unaffected — those do bubble up from the Viewport, which
// is why meal-plans.tsx's drag auto-scroll works as written.)
//
// onViewportScroll is the way through. Deliberately a separate, optional prop rather than
// redirecting `...props` to the Viewport: every existing consumer passes className/ref/
// onDragOver expecting Root, and moving the spread would silently relocate all of them. Nothing
// here changes for a caller that doesn't pass it.
//
// A caller needing the scrolling element itself (rather than just its events) can still reach
// it the way meal-plans.tsx does — querySelector("[data-radix-scroll-area-viewport]") on the
// forwarded Root ref. A viewportRef prop would be the tidier answer if a second consumer ever
// wants that; one wasn't added here because nothing needs it yet.
const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    onViewportScroll?: React.UIEventHandler<HTMLDivElement>;
  }
>(({ className, children, onViewportScroll, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    {/* Radix wraps `children` in its own internal div styled `display: table`, which sizes
        itself to the content's unwrapped max-content width instead of the viewport's actual
        width — so a long nowrap/truncate text node inside never gets a bounded box to shrink
        against, no matter what width classes its own row/ancestors carry. Forcing that
        Radix-owned wrapper back to `display: block` makes it fill this Viewport's real width
        instead, which is what every consumer of ScrollArea actually wants. */}
    <ScrollAreaPrimitive.Viewport
      className="h-full w-full rounded-[inherit] [&>div]:block!"
      onScroll={onViewportScroll}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
