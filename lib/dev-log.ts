/**
 * Development-only logging. No output in production builds.
 * Use instead of console.log for debug/trace messages.
 */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
}
