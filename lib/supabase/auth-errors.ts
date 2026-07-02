/** User-facing message when Supabase auth cannot be reached from the browser. */
export function supabaseAuthErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network request failed")
    ) {
      return (
        "Could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL in .env.local — " +
        "the project may be paused, deleted, or the URL may be wrong. " +
        "See docs/SUPABASE.md, then restart npm run dev."
      );
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Sign-in failed. Try again in a moment.";
}
