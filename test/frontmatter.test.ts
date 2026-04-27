import { describe, it, expect } from 'vitest';
import { splitFrontmatter } from '../src/frontmatter/parse.js';

describe('splitFrontmatter', () => {
  // ─── Standard frontmatter ────────────────────────────────────────────

  it('extracts YAML data and markdown content from standard frontmatter', () => {
    const input = `---
title: Hello
status: pending
---
# Heading

Some content here.
`;

    const result = splitFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.data).toBe('title: Hello\nstatus: pending');
    expect(result!.content).toBe('# Heading\n\nSome content here.\n');
  });

  it('handles multi-line YAML data', () => {
    const input = `---
title: My Task
depends_on:
  - task-a
  - task-b
---
Content here`;

    const result = splitFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.data).toBe('title: My Task\ndepends_on:\n  - task-a\n  - task-b');
    expect(result!.content).toBe('Content here');
  });

  // ─── Empty frontmatter ───────────────────────────────────────────────

  it('returns empty data and content for "---\\n---"', () => {
    const result = splitFrontmatter('---\n---');
    expect(result).not.toBeNull();
    expect(result!.data).toBe('');
    expect(result!.content).toBe('');
  });

  it('returns empty data with trailing content after empty frontmatter', () => {
    const result = splitFrontmatter('---\n---\nSome content');
    expect(result).not.toBeNull();
    expect(result!.data).toBe('');
    expect(result!.content).toBe('Some content');
  });

  // ─── No frontmatter ──────────────────────────────────────────────────

  it('returns null when there is no frontmatter at all', () => {
    const result = splitFrontmatter('Hello world\nNo frontmatter here');
    expect(result).toBeNull();
  });

  it('returns null when file starts with text (no opening ---)', () => {
    const result = splitFrontmatter('Some text\n---\nMore text');
    expect(result).toBeNull();
  });

  it('returns null when opening --- exists but no closing delimiter', () => {
    const result = splitFrontmatter('---\ntitle: Hello\nNo closing delimiter');
    expect(result).toBeNull();
  });

  // ─── 4+ dashes are NOT delimiters ────────────────────────────────────

  it('returns null when opening delimiter is 4+ dashes (----)', () => {
    const result = splitFrontmatter('----\ntitle: Hello\n----\nContent');
    expect(result).toBeNull();
  });

  it('does not treat ---- as a closing delimiter', () => {
    const input = `---
title: Hello
----
Content after four dashes`;
    const result = splitFrontmatter(input);
    // No valid closing delimiter found (---- doesn't count)
    expect(result).toBeNull();
  });

  it('does not treat 5 dashes as a closing delimiter', () => {
    const input = `---
title: Hello
-----
Content`;
    const result = splitFrontmatter(input);
    expect(result).toBeNull();
  });

  // ─── Dashes in content body (shouldn't be treated as delimiters) ─────

  it('ignores --- in the content body after valid frontmatter', () => {
    const input = `---
title: Hello
---
Some text

---
More text
`;

    const result = splitFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.data).toBe('title: Hello');
    expect(result!.content).toBe('Some text\n\n---\nMore text\n');
  });

  it('handles horizontal rule (---) in content', () => {
    const input = `---
title: Hello
---
Paragraph above

---

Paragraph below
`;

    const result = splitFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.data).toBe('title: Hello');
    expect(result!.content).toBe('Paragraph above\n\n---\n\nParagraph below\n');
  });

  // ─── BOM handling ─────────────────────────────────────────────────────

  it('handles UTF-8 BOM at start of file', () => {
    const input = '\uFEFF---\ntitle: Hello\n---\nContent';
    const result = splitFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.data).toBe('title: Hello');
    expect(result!.content).toBe('Content');
  });

  // ─── Edge cases ──────────────────────────────────────────────────────

  it('file with only "---\\n---"', () => {
    const result = splitFrontmatter('---\n---');
    expect(result).not.toBeNull();
    expect(result!.data).toBe('');
    expect(result!.content).toBe('');
  });

  it('content body starts after closing ---\\n', () => {
    const input = `---
key: value
---
Body starts here`;
    const result = splitFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.content).toBe('Body starts here');
  });

  it('content is empty string when closing --- is at end of file with no trailing newline', () => {
    const result = splitFrontmatter('---\nkey: value\n---');
    expect(result).not.toBeNull();
    expect(result!.data).toBe('key: value');
    expect(result!.content).toBe('');
  });

  it('handles leading whitespace on first line before ---', () => {
    const input = '  ---\ntitle: Hello\n---\nContent';
    const result = splitFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.data).toBe('title: Hello');
    expect(result!.content).toBe('Content');
  });

  it('returns null if only opening --- with no newline', () => {
    const result = splitFrontmatter('---');
    expect(result).toBeNull();
  });
});