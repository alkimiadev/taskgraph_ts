// File I/O functions for frontmatter parsing.
//
// ⚠️ These functions depend on `node:fs/promises` and are only available in
// Node.js-compatible runtimes. Consumers targeting Deno, Bun, or browsers
// should use `parseFrontmatter` directly with their own file-reading mechanism.

import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { parseFrontmatter } from './parse.js';
import type { TaskInput as TaskInputType } from '../schema/task.js';

/**
 * Read a markdown file and parse its YAML frontmatter into a validated
 * `TaskInput` object.
 *
 * Delegates to `parseFrontmatter` for parsing and validation.
 * Throws the underlying Node.js error for I/O failures (ENOENT, EACCES, etc.).
 *
 * @param filePath — Absolute or relative path to a `.md` file
 * @returns Validated `TaskInput` object
 * @throws Node.js system errors for I/O failures
 * @throws {InvalidInputError} When frontmatter is missing or invalid
 *
 * @nodeOnly Uses `node:fs/promises.readFile`
 */
export async function parseTaskFile(filePath: string): Promise<TaskInputType> {
  const content = await readFile(filePath, 'utf-8');
  return parseFrontmatter(content);
}

/**
 * Recursively scan a directory for `.md` files and parse each one that
 * contains valid `---`-delimited YAML frontmatter.
 *
 * - Files without valid frontmatter are silently skipped (no error thrown,
 *   just omitted from the results).
 * - Non-`.md` files are ignored.
 * - Throws the underlying Node.js error for I/O failures (ENOENT, EACCES).
 * - Uses `parseTaskFile` per file.
 *
 * @param dirPath — Absolute or relative path to a directory
 * @returns Array of validated `TaskInput` objects (one per valid file)
 * @throws Node.js system errors for I/O failures
 *
 * @nodeOnly Uses `node:fs/promises.readdir` and `node:fs/promises.stat`
 */
export async function parseTaskDirectory(dirPath: string): Promise<TaskInputType[]> {
  const results: TaskInputType[] = [];
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectories
      const subResults = await parseTaskDirectory(fullPath);
      results.push(...subResults);
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      // Only process .md files; skip others silently
      try {
        const task = await parseTaskFile(fullPath);
        results.push(task);
      } catch (err) {
        // Silently skip files without valid frontmatter (InvalidInputError
        // from parseFrontmatter means no valid --- delimiters found, or
        // the YAML/schema is invalid). Rethrow I/O errors.
        if (err instanceof Error && err.name === 'InvalidInputError') {
          continue;
        }
        throw err;
      }
    }
    // Non-.md files and other entry types are silently skipped
  }

  return results;
}