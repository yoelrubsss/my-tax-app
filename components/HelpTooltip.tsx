"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";

interface HelpTooltipProps {
  text: string;
  label?: string;
}

export default function HelpTooltip({ text, label = "מידע נוסף" }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const visible = open || hovered;

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        aria-expanded={visible}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card-muted text-primary shadow-sm transition-colors hover:bg-card hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      <span
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`absolute start-1/2 top-full z-[120] mt-1.5 w-56 -translate-x-1/2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs leading-5 text-text shadow-md ${
          visible ? "block" : "hidden"
        }`}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}
