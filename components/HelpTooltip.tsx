"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

interface HelpTooltipProps {
  text: string;
  label?: string;
  /** Wider panel for longer explanatory text (e.g. contextual help) */
  wide?: boolean;
  /** Higher stacking inside fixed panels / modals (e.g. above chat messages) */
  elevated?: boolean;
  /** Extra classes for the trigger button (size, opacity) */
  triggerClassName?: string;
  /**
   * Render the tooltip in document.body with fixed positioning so ancestors with overflow:hidden
   * cannot clip it.
   */
  usePortal?: boolean;
  /** Override portaled panel z-index (e.g. 100 above a z-[60] chat shell) */
  portalZIndex?: number;
}

export default function HelpTooltip({
  text,
  label = "מידע נוסף",
  wide = false,
  elevated = false,
  triggerClassName,
  usePortal = false,
  portalZIndex,
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const visible = open || hovered;
  const [portalCoords, setPortalCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const resolvedPortalZ = portalZIndex ?? (elevated ? 200 : 120);
  const panelZ = elevated ? "z-[200]" : "z-[120]";

  const updatePortalPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el || !usePortal) return;
    const r = el.getBoundingClientRect();
    const w = wide ? Math.min(window.innerWidth - 16, 22 * 16) : 14 * 16;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    setPortalCoords({ top: r.bottom + 6, left, width: w });
  }, [usePortal, wide]);

  useLayoutEffect(() => {
    if (!usePortal || !visible) return;
    updatePortalPosition();
  }, [usePortal, visible, updatePortalPosition]);

  useEffect(() => {
    if (!usePortal || !visible) return;
    const onScroll = () => updatePortalPosition();
    const onResize = () => updatePortalPosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [usePortal, visible, updatePortalPosition]);

  const panelBase =
    "rounded-md border border-border bg-card px-2.5 py-2 text-xs leading-relaxed text-text shadow-lg break-words";

  const inlinePanel = !usePortal && (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`absolute start-1/2 top-full mt-1.5 max-w-[min(22rem,calc(100vw-1rem))] -translate-x-1/2 ${panelZ} ${panelBase} ${
        wide ? "w-[min(92vw,22rem)] text-right" : "w-56"
      } ${visible ? "block" : "hidden"}`}
      role="tooltip"
    >
      {text}
    </span>
  );

  const portalPanel =
    usePortal &&
    visible &&
    portalCoords &&
    typeof document !== "undefined" &&
    createPortal(
      <span
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed ${panelBase} ${wide ? "text-right" : ""}`}
        style={{
          top: portalCoords.top,
          left: portalCoords.left,
          width: wide ? portalCoords.width : 224,
          maxWidth: "min(22rem, calc(100vw - 1rem))",
          zIndex: resolvedPortalZ,
        }}
        role="tooltip"
      >
        {text}
      </span>,
      document.body
    );

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={visible}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-card-muted text-primary shadow-sm transition-colors hover:bg-card hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary ${triggerClassName ?? ""}`}
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      {inlinePanel}
      {portalPanel}
    </span>
  );
}
