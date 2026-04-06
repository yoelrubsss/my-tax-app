import { Suspense } from "react";
import HomeContent from "./HomeContent";

/** Home dashboard: stats, empty-state onboarding, bulk upload, drafts, and transaction manager live in `HomeContent`. */
export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"
            aria-hidden
          />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
