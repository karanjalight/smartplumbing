export type Inline = { text: string; bold?: boolean; italic?: boolean };
export type Block =
  | { type: "paragraph"; runs: Inline[] }
  | { type: "bullet"; runs: Inline[] };

/** Parses `**bold**` and `*italic*` into inline runs. */
function parseInline(text: string): Inline[] {
  const runs: Inline[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) runs.push({ text: m[2], bold: true });
    else if (m[4] !== undefined) runs.push({ text: m[4], italic: true });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text: "" }];
}

export function parseClauseMarkdown(md: string): Block[] {
  const paragraphs = md.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const blocks: Block[] = [];
  for (const para of paragraphs) {
    const lines = para.split("\n");
    const allBullets = lines.every((l) => l.trim().startsWith("- "));
    if (allBullets) {
      for (const line of lines) {
        blocks.push({ type: "bullet", runs: parseInline(line.trim().slice(2)) });
      }
    } else {
      blocks.push({ type: "paragraph", runs: parseInline(para.replace(/\n/g, " ")) });
    }
  }
  return blocks;
}
