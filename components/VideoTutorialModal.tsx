"use client";

import { X, CirclePlay } from "lucide-react";

/** Replace with your production YouTube/Vimeo embed URL (embed form, not watch URL). */
const DEFAULT_EMBED_SRC =
  "https://www.youtube.com/embed/ScMzIvxBSi4?rel=0";

interface VideoTutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional override; defaults to placeholder embed */
  embedSrc?: string;
}

export default function VideoTutorialModal({
  open,
  onOpenChange,
  embedSrc = DEFAULT_EMBED_SRC,
}: VideoTutorialModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-tutorial-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="סגור"
        onClick={() => onOpenChange(false)}
      />
      <div className="ui-modal relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl p-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <CirclePlay className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <h2 id="video-tutorial-title" className="text-lg font-bold text-text">
              סרטון הדרכה
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-card-muted hover:text-text"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-black">
          <div className="relative aspect-video w-full">
            <iframe
              title="סרטון הדרכה — הגשת דוח דו-חודשי"
              src={embedSrc}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>

        <p className="border-t border-border bg-card px-4 py-3 text-center text-sm text-text-muted">
          כך תגישו את הדוח הדו-חודשי ב-60 שניות
        </p>
      </div>
    </div>
  );
}
