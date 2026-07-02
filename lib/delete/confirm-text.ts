/** Case-insensitive, trimmed comparison for type-to-confirm guards. */
export function matchesConfirmText(input: string, target: string): boolean {
  return input.trim().toLowerCase() === target.trim().toLowerCase();
}
