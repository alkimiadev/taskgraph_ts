// YAML/frontmatter parsing + typebox validation

/**
 * Split a markdown string with `---`-delimited YAML frontmatter into its
 * data and content parts.
 *
 * Rules (per architecture spec):
 * 1. Opening `---` must appear at the very start of the string (optional BOM
 *    or leading whitespace on line 1 is stripped first, but the opening
 *    delimiter must still be the first non-whitespace content).
 * 2. Only exactly three dashes (`---`) qualify as a delimiter — four or more
 *    (`----`) are NOT delimiters.
 * 3. The closing delimiter must be `\n---` (i.e. a newline followed by three
 *    dashes). A closing `---` without a preceding newline is not valid.
 * 4. Content body begins after the closing `---` plus its trailing newline.
 *
 * @returns `{ data, content }` when valid frontmatter is found, or `null`
 *          when the input has no valid frontmatter block.
 */
export function splitFrontmatter(
  markdown: string,
): { data: string; content: string } | null {
  // Strip optional UTF-8 BOM
  const input = markdown.replace(/^\uFEFF/, '');

  // Opening delimiter: must be `---` at start of string (after BOM removal),
  // optionally preceded by whitespace on the first line. The `---` must be
  // exactly 3 dashes — 4+ dashes are NOT a valid opening.
  const openingMatch = /^[ \t]*(---)(?!\-)/.exec(input);
  if (!openingMatch) return null;

  // The opening delimiter ends at the end of its line (consume the newline)
  const afterOpening = input.indexOf('\n', openingMatch.index + openingMatch[0].length);
  if (afterOpening === -1) return null;

  // Search for closing delimiter: `\n---` with exactly 3 dashes (not 4+).
  // The data section starts right after the opening delimiter's newline.
  const dataStart = afterOpening + 1;

  // Helper: check if `pos` starts a valid closing `---` line (exactly 3 dashes,
  // not 4+), and if so, return the parsed result.
  const tryClosing = (closingPos: number, dataEnd: number): { data: string; content: string } | null => {
    if (
      input[closingPos] === '-' &&
      input[closingPos + 1] === '-' &&
      input[closingPos + 2] === '-' &&
      input[closingPos + 3] !== '-'
    ) {
      const data = input.slice(dataStart, dataEnd);
      // Content starts after the closing `---` plus its trailing newline.
      // If there's no trailing newline, content is empty.
      const afterClosing = input.indexOf('\n', closingPos + 3);
      const content = afterClosing === -1 ? '' : input.slice(afterClosing + 1);
      return { data, content };
    }
    return null;
  };

  // Check immediately after opening newline (handles `---\n---` with empty data)
  const immediate = tryClosing(dataStart, dataStart);
  if (immediate !== null) return immediate;

  // Scan for newlines and check each as a potential closing delimiter
  for (let i = dataStart; i < input.length; i++) {
    if (input[i] !== '\n') continue;

    const lineStart = i + 1;
    const result = tryClosing(lineStart, i);
    if (result !== null) return result;
  }

  // No valid closing delimiter found
  return null;
}

export function parseFrontmatter(_input: string): unknown {
  // Stub — implementation pending
  return {};
}

export function parseTaskFile(_input: string): unknown {
  // Stub — implementation pending
  return {};
}

export function parseTaskDirectory(_dir: string): unknown[] {
  // Stub — implementation pending
  return [];
}