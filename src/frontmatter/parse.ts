// YAML/frontmatter parsing + typebox validation

import { parse as yamlParse } from 'yaml';
import { Value } from '@alkdev/typebox/value';
import { TaskInput, type TaskInput as TaskInputType } from '../schema/task.js';
import { InvalidInputError } from '../error/index.js';

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

/**
 * Parse a markdown string with `---`-delimited YAML frontmatter into a
 * validated `TaskInput` object.
 *
 * Pipeline:
 * 1. Call `splitFrontmatter()` to extract the YAML data string
 * 2. Throw `InvalidInputError` if no valid frontmatter found
 * 3. Parse YAML string with `yaml.parse()` (YAML 1.2 — no type coercion)
 * 4. Run `Value.Clean()` to strip unknown properties from untrusted input
 * 5. Run `Value.Check()` — if fails, collect errors via `Value.Errors()` and
 *    throw `InvalidInputError` with field-level details
 * 6. Return the validated `TaskInput`
 *
 * @throws {InvalidInputError} When frontmatter is missing, YAML is invalid,
 *         or schema validation fails
 */
export function parseFrontmatter(markdown: string): TaskInputType {
  // Step 1: Split frontmatter
  const split = splitFrontmatter(markdown);
  if (split === null) {
    throw new InvalidInputError('', 'No valid frontmatter found');
  }

  // Step 3: Parse YAML (YAML 1.2 by default from the `yaml` package)
  let parsed: unknown;
  try {
    parsed = yamlParse(split.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new InvalidInputError('', `YAML parse error: ${message}`);
  }

  // Guard: parsed YAML must be a plain object (not a string, number, null, etc.)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new InvalidInputError('', 'YAML frontmatter must be a mapping (object), not a scalar or array');
  }

  // Step 3.5: Normalize known snake_case aliases to camelCase.
  // The YAML format uses snake_case (e.g., `depends_on`) but our schema
  // expects camelCase (e.g., `dependsOn`). Without this, `Value.Clean()`
  // would strip the unknown snake_case key and the field would be silently
  // lost — causing empty dependency lists and broken graphs.
  const record = parsed as Record<string, unknown>;
  if ('depends_on' in record && !('dependsOn' in record)) {
    record.dependsOn = record.depends_on;
    delete record.depends_on;
  }

  // Step 4: Clean — strip unknown properties from untrusted input
  const cleaned = Value.Clean(TaskInput, parsed);

  // Step 5: Validate — check against schema, collect errors if invalid
  if (!Value.Check(TaskInput, cleaned)) {
    // Collect all field-level errors from TypeBox's Value.Errors()
    const errors = [...Value.Errors(TaskInput, cleaned)];
    // Use the first error to populate InvalidInputError (provides most actionable detail)
    if (errors.length > 0) {
      throw InvalidInputError.fromTypeBoxError(errors[0]!);
    }
    // Fallback if no errors were reported (shouldn't happen, but defensive)
    throw new InvalidInputError('', 'Schema validation failed');
  }

  // Step 6: Return validated TaskInput
  return cleaned as TaskInputType;
}

