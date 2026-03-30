import { Suspense } from "react";
import HomeContent from "./HomeContent";

/** Home dashboard: stats, onboarding when there are no transactions, bulk upload, drafts, and transaction manager live in `HomeContent`. */
export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div></div>}>
      <HomeContent />
    </Suspense>
  );
}
