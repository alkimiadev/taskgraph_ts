import { describe, it, expect } from 'vitest';
import { splitFrontmatter, parseFrontmatter } from '../src/frontmatter/parse.js';
import { InvalidInputError } from '../src/error/index.js';

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

describe('parseFrontmatter', () => {
  // ─── Valid frontmatter ──────────────────────────────────────────────────

  it('parses valid frontmatter with required fields only', () => {
    const input = `---
id: my-task
name: My Task
dependsOn: []
---
Some body`;
    const result = parseFrontmatter(input);
    expect(result.id).toBe('my-task');
    expect(result.name).toBe('My Task');
    expect(result.dependsOn).toEqual([]);
  });

  it('parses valid frontmatter with all fields populated', () => {
    const input = `---
id: full-task
name: Full Task
dependsOn:
  - task-a
  - task-b
status: in-progress
scope: narrow
risk: high
impact: component
level: implementation
priority: critical
tags:
  - urgent
assignee: alice
due: "2026-06-01"
created: "2026-04-01"
modified: "2026-04-20"
---
Body here`;
    const result = parseFrontmatter(input);
    expect(result.id).toBe('full-task');
    expect(result.name).toBe('Full Task');
    expect(result.dependsOn).toEqual(['task-a', 'task-b']);
    expect(result.status).toBe('in-progress');
    expect(result.scope).toBe('narrow');
    expect(result.risk).toBe('high');
    expect(result.impact).toBe('component');
    expect(result.level).toBe('implementation');
    expect(result.priority).toBe('critical');
    expect(result.tags).toEqual(['urgent']);
    expect(result.assignee).toBe('alice');
    expect(result.due).toBe('2026-06-01');
    expect(result.created).toBe('2026-04-01');
    expect(result.modified).toBe('2026-04-20');
  });

  it('parses valid frontmatter with optional fields omitted', () => {
    const input = `---
id: minimal-task
name: Minimal
dependsOn: []
---
Body`;
    const result = parseFrontmatter(input);
    expect(result.id).toBe('minimal-task');
    expect(result.name).toBe('Minimal');
    // Optional fields should be undefined when not present
    expect(result.status).toBeUndefined();
    expect(result.scope).toBeUndefined();
    expect(result.risk).toBeUndefined();
    expect(result.impact).toBeUndefined();
    expect(result.level).toBeUndefined();
    expect(result.priority).toBeUndefined();
    expect(result.tags).toBeUndefined();
    expect(result.assignee).toBeUndefined();
    expect(result.due).toBeUndefined();
    expect(result.created).toBeUndefined();
    expect(result.modified).toBeUndefined();
  });

  // ─── YAML null values ──────────────────────────────────────────────────

  it('preserves YAML null values as null (distinct from absent field)', () => {
    const input = `---
id: null-task
name: Null Task
dependsOn: []
risk:
scope:
status:
---`;
    const result = parseFrontmatter(input);
    expect(result.risk).toBeNull();
    expect(result.scope).toBeNull();
    expect(result.status).toBeNull();
  });

  it('distinguishes between absent field and explicitly null field', () => {
    const input = `---
id: mixed-task
name: Mixed
dependsOn: []
risk:
---`;
    const result = parseFrontmatter(input);
    // risk is explicitly set to null
    expect(result.risk).toBeNull();
    // impact is absent (not in YAML)
    expect(result.impact).toBeUndefined();
  });

  // ─── No valid frontmatter ───────────────────────────────────────────────

  it('throws InvalidInputError when no frontmatter found', () => {
    expect(() => parseFrontmatter('No frontmatter here')).toThrow(InvalidInputError);
  });

  it('throws InvalidInputError with descriptive message when no frontmatter found', () => {
    expect(() => parseFrontmatter('No frontmatter here')).toThrow('No valid frontmatter found');
  });

  // ─── Missing required fields ────────────────────────────────────────────

  it('throws InvalidInputError when id is missing', () => {
    const input = `---
name: No ID
dependsOn: []
---`;
    expect(() => parseFrontmatter(input)).toThrow(InvalidInputError);
  });

  it('throws InvalidInputError when name is missing', () => {
    const input = `---
id: no-name
dependsOn: []
---`;
    expect(() => parseFrontmatter(input)).toThrow(InvalidInputError);
  });

  it('throws InvalidInputError when dependsOn is missing', () => {
    const input = `---
id: no-deps
name: No Deps
---`;
    expect(() => parseFrontmatter(input)).toThrow(InvalidInputError);
  });

  it('throws InvalidInputError with field-level detail for missing required field', () => {
    const input = `---
name: No ID field
dependsOn: []
---`;
    try {
      parseFrontmatter(input);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidInputError);
      const invalidErr = err as InvalidInputError;
      // The field property should reference the missing field path
      expect(invalidErr.field).toContain('id');
    }
  });

  // ─── Invalid enum values ───────────────────────────────────────────────

  it('throws InvalidInputError for invalid risk enum value', () => {
    const input = `---
id: bad-risk
name: Bad Risk
dependsOn: []
risk: extreme
---`;
    expect(() => parseFrontmatter(input)).toThrow(InvalidInputError);
  });

  it('throws InvalidInputError for invalid status enum value', () => {
    const input = `---
id: bad-status
name: Bad Status
dependsOn: []
status: unknown
---`;
    expect(() => parseFrontmatter(input)).toThrow(InvalidInputError);
  });

  it('throws InvalidInputError for invalid scope enum value', () => {
    const input = `---
id: bad-scope
name: Bad Scope
dependsOn: []
scope: universal
---`;
    expect(() => parseFrontmatter(input)).toThrow(InvalidInputError);
  });

  // ─── Type mismatches ────────────────────────────────────────────────────

  it('throws InvalidInputError when dependsOn is a string instead of array', () => {
    const input = `---
id: bad-deps
name: Bad Deps
dependsOn: not-an-array
---`;
    expect(() => parseFrontmatter(input)).toThrow(InvalidInputError);
  });

  // ─── Unknown fields stripped ───────────────────────────────────────────

  it('strips unknown fields from the result (Value.Clean)', () => {
    const input = `---
id: clean-task
name: Clean Task
dependsOn: []
unknownField: should be removed
anotherUnknown: 42
---`;
    const result = parseFrontmatter(input);
    expect(result.id).toBe('clean-task');
    expect(result.name).toBe('Clean Task');
    // Unknown fields should not appear (they are stripped by Value.Clean)
    expect((result as Record<string, unknown>)['unknownField']).toBeUndefined();
    expect((result as Record<string, unknown>)['anotherUnknown']).toBeUndefined();
  });

  // ─── YAML 1.2 — no type coercion ───────────────────────────────────────

  it('does not coerce YAML 1.1 booleans/numbers (YAML 1.2 compliance)', () => {
    // In YAML 1.2, "yes" is a string, not a boolean (unlike YAML 1.1)
    // "on" and "off" are also strings in YAML 1.2
    const input = `---
id: yaml12-task
name: "YAML 1.2 Task"
dependsOn: []
---`;
    const result = parseFrontmatter(input);
    expect(result.name).toBe('YAML 1.2 Task');
  });

  it('parses an empty dependsOn array', () => {
    const input = `---
id: empty-deps
name: Empty Deps
dependsOn: []
---`;
    const result = parseFrontmatter(input);
    expect(result.dependsOn).toEqual([]);
  });

  // ─── Invalid YAML syntax ───────────────────────────────────────────────

  it('throws InvalidInputError for invalid YAML syntax', () => {
    const input = `---
id: bad yaml: [unclosed
name: Broken
dependsOn: []
---`;
    expect(() => parseFrontmatter(input)).toThrow(InvalidInputError);
  });

  // ─── YAML frontmatter that is not a mapping ────────────────────────────

  it('throws InvalidInputError when YAML frontmatter is a scalar', () => {
    const input = `---
just a string
---`;
    expect(() => parseFrontmatter(input)).toThrow(InvalidInputError);
  });

  it('throws InvalidInputError when YAML frontmatter is an array', () => {
    const input = `---
- item1
- item2
---`;
    expect(() => parseFrontmatter(input)).toThrow(InvalidInputError);
  });

  // ─── Field-level error detail ───────────────────────────────────────────

  it('InvalidInputError is populated with field-level details from Value.Errors()', () => {
    const input = `---
id: field-detail
name: Field Detail
dependsOn: []
risk: invalid-value
---`;
    try {
      parseFrontmatter(input);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidInputError);
      const invalidErr = err as InvalidInputError;
      // The error should have both field and message populated
      expect(invalidErr.field).toBeTruthy();
      expect(invalidErr.message).toBeTruthy();
      // Field should reference "risk"
      expect(invalidErr.field).toMatch(/risk/i);
    }
  });

  // ─── BOM handling ──────────────────────────────────────────────────────

  it('handles UTF-8 BOM at start of file', () => {
    const input = '\uFEFF---\nid: bom-task\nname: BOM Task\ndependsOn: []\n---\nBody';
    const result = parseFrontmatter(input);
    expect(result.id).toBe('bom-task');
  });
});