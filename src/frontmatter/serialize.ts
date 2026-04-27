// TaskInput → markdown with YAML frontmatter

import { stringify as yamlStringify } from 'yaml';
import type { TaskInput as TaskInputType } from '../schema/task.js';

/**
 * Serialize a `TaskInput` object into a `---`-delimited markdown string.
 *
 * - Uses `yaml.stringify()` for the data portion (YAML 1.2 output).
 * - Includes all `TaskInput` fields in the YAML (per schema convention).
 * - Nullable fields set to `null` produce explicit `null` in YAML.
 * - Absent (undefined) fields are omitted from the YAML output.
 * - Appends optional body content (default: empty string) after the
 *   closing `---`.
 *
 * @param task — The `TaskInput` object to serialize
 * @param body — Optional markdown body content after the frontmatter
 * @returns A complete markdown string with frontmatter and optional body
 */
export function serializeFrontmatter(task: TaskInputType, body?: string): string {
  // Build a clean object: include all defined fields, omit undefined ones.
  // This ensures `yaml.stringify()` only writes keys that are present,
  // keeping the output compact and matching what `parseFrontmatter` expects.
  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(task)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }

  const yaml = yamlStringify(data, { lineWidth: 0 });
  const content = body ?? '';

  return `---\n${yaml}---\n${content}`;
}