import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseTaskFile, parseTaskDirectory } from '../src/frontmatter/file-io.js';
import { serializeFrontmatter } from '../src/frontmatter/serialize.js';
import { parseFrontmatter } from '../src/frontmatter/parse.js';
import type { TaskInput } from '../src/schema/task.js';
import { InvalidInputError } from '../src/error/index.js';

describe('parseTaskFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'taskgraph-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reads and parses a valid markdown file with frontmatter', async () => {
    const filePath = join(tempDir, 'task.md');
    const content = `---
id: file-task
name: File Task
dependsOn: []
---
Some body content`;
    await writeFile(filePath, content, 'utf-8');

    const result = await parseTaskFile(filePath);
    expect(result.id).toBe('file-task');
    expect(result.name).toBe('File Task');
    expect(result.dependsOn).toEqual([]);
  });

  it('reads and parses a file with all optional fields', async () => {
    const filePath = join(tempDir, 'full-task.md');
    const content = `---
id: full-file-task
name: Full File Task
dependsOn:
  - task-a
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
---
Body here`;
    await writeFile(filePath, content, 'utf-8');

    const result = await parseTaskFile(filePath);
    expect(result.id).toBe('full-file-task');
    expect(result.status).toBe('in-progress');
    expect(result.risk).toBe('high');
    expect(result.tags).toEqual(['urgent']);
  });

  it('throws ENOENT error for non-existent file', async () => {
    const filePath = join(tempDir, 'does-not-exist.md');
    await expect(parseTaskFile(filePath)).rejects.toThrow();
    try {
      await parseTaskFile(filePath);
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('ENOENT');
    }
  });

  it('throws InvalidInputError for file with no valid frontmatter', async () => {
    const filePath = join(tempDir, 'no-frontmatter.md');
    await writeFile(filePath, 'Just some markdown content\nNo frontmatter', 'utf-8');

    await expect(parseTaskFile(filePath)).rejects.toThrow(InvalidInputError);
  });

  it('throws InvalidInputError for file with invalid YAML frontmatter', async () => {
    const filePath = join(tempDir, 'invalid-yaml.md');
    await writeFile(filePath, `---
id: bad yaml: [unclosed
name: Broken
dependsOn: []
---`, 'utf-8');

    await expect(parseTaskFile(filePath)).rejects.toThrow(InvalidInputError);
  });

  it('handles UTF-8 BOM in file', async () => {
    const filePath = join(tempDir, 'bom-task.md');
    const content = '\uFEFF---\nid: bom-task\nname: BOM Task\ndependsOn: []\n---\nBody';
    await writeFile(filePath, content, 'utf-8');

    const result = await parseTaskFile(filePath);
    expect(result.id).toBe('bom-task');
  });
});

describe('parseTaskDirectory', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'taskgraph-dir-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('parses all .md files with valid frontmatter in a directory', async () => {
    await writeFile(join(tempDir, 'task-a.md'), `---
id: task-a
name: Task A
dependsOn: []
---`);
    await writeFile(join(tempDir, 'task-b.md'), `---
id: task-b
name: Task B
dependsOn:
  - task-a
---`);

    const results = await parseTaskDirectory(tempDir);
    expect(results).toHaveLength(2);
    const ids = results.map(r => r.id).sort();
    expect(ids).toEqual(['task-a', 'task-b']);
  });

  it('silently skips non-.md files', async () => {
    await writeFile(join(tempDir, 'task.md'), `---
id: task-1
name: Task 1
dependsOn: []
---`);
    await writeFile(join(tempDir, 'notes.txt'), 'Some notes');
    await writeFile(join(tempDir, 'config.json'), '{"key": "value"}');
    await writeFile(join(tempDir, 'script.js'), 'console.log("hi")');

    const results = await parseTaskDirectory(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('task-1');
  });

  it('silently skips .md files without valid frontmatter', async () => {
    await writeFile(join(tempDir, 'valid.md'), `---
id: valid-task
name: Valid
dependsOn: []
---`);
    await writeFile(join(tempDir, 'no-frontmatter.md'), 'Just some text\nNo frontmatter here');
    await writeFile(join(tempDir, 'invalid-schema.md'), `---
id: broken
name: Missing dependsOn
---`);

    const results = await parseTaskDirectory(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('valid-task');
  });

  it('recursively scans subdirectories', async () => {
    const subDir = join(tempDir, 'subdir');
    const deepDir = join(subDir, 'deep');
    await mkdir(subDir, { recursive: true });
    await mkdir(deepDir, { recursive: true });

    await writeFile(join(tempDir, 'root.md'), `---
id: root-task
name: Root
dependsOn: []
---`);
    await writeFile(join(subDir, 'sub.md'), `---
id: sub-task
name: Sub
dependsOn: []
---`);
    await writeFile(join(deepDir, 'deep.md'), `---
id: deep-task
name: Deep
dependsOn: []
---`);

    const results = await parseTaskDirectory(tempDir);
    expect(results).toHaveLength(3);
    const ids = results.map(r => r.id).sort();
    expect(ids).toEqual(['deep-task', 'root-task', 'sub-task']);
  });

  it('handles empty directory', async () => {
    const emptyDir = join(tempDir, 'empty');
    await mkdir(emptyDir);

    const results = await parseTaskDirectory(emptyDir);
    expect(results).toEqual([]);
  });

  it('throws ENOENT for non-existent directory', async () => {
    const badPath = join(tempDir, 'no-such-dir');
    await expect(parseTaskDirectory(badPath)).rejects.toThrow();
    try {
      await parseTaskDirectory(badPath);
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('ENOENT');
    }
  });

  it('handles mixed valid, invalid, and non-.md files in subdirectories', async () => {
    const subDir = join(tempDir, 'mixed');
    await mkdir(subDir);

    await writeFile(join(tempDir, 'root-valid.md'), `---
id: root
name: Root Task
dependsOn: []
---`);
    await writeFile(join(subDir, 'sub-valid.md'), `---
id: sub
name: Sub Task
dependsOn: []
---`);
    await writeFile(join(subDir, 'no-fm.md'), 'No frontmatter');
    await writeFile(join(subDir, 'data.csv'), 'a,b,c');

    const results = await parseTaskDirectory(tempDir);
    expect(results).toHaveLength(2);
    const ids = results.map(r => r.id).sort();
    expect(ids).toEqual(['root', 'sub']);
  });

  it('skips invalid YAML files (not valid frontmatter) silently', async () => {
    await writeFile(join(tempDir, 'valid.md'), `---
id: good
name: Good
dependsOn: []
---`);
    await writeFile(join(tempDir, 'bad-risk.md'), `---
id: bad-risk
name: Bad Risk
dependsOn: []
risk: extreme-invalid-value
---`);

    const results = await parseTaskDirectory(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('good');
  });
});

describe('serializeFrontmatter', () => {
  it('serializes a minimal TaskInput with required fields only', () => {
    const task: TaskInput = {
      id: 'minimal',
      name: 'Minimal Task',
      dependsOn: [],
    };

    const result = serializeFrontmatter(task);
    expect(result).toContain('---');
    expect(result).toContain('id: minimal');
    expect(result).toContain('name: Minimal Task');
  });

  it('serializes a TaskInput with all fields populated', () => {
    const task: TaskInput = {
      id: 'full',
      name: 'Full Task',
      dependsOn: ['task-a', 'task-b'],
      status: 'in-progress',
      scope: 'narrow',
      risk: 'high',
      impact: 'component',
      level: 'implementation',
      priority: 'critical',
      tags: ['urgent', 'backend'],
      assignee: 'alice',
      due: '2026-06-01',
      created: '2026-04-01',
      modified: '2026-04-20',
    };

    const result = serializeFrontmatter(task);
    expect(result).toContain('id: full');
    expect(result).toContain('status: in-progress');
    expect(result).toContain('risk: high');
    expect(result).toContain('assignee: alice');
  });

  it('omits undefined fields from YAML output', () => {
    const task: TaskInput = {
      id: 'partial',
      name: 'Partial Task',
      dependsOn: [],
      // status, scope, risk, etc. are undefined
    };

    const result = serializeFrontmatter(task);
    // The YAML should NOT contain keys for undefined fields
    expect(result).not.toContain('status:');
    expect(result).not.toContain('risk:');
    expect(result).not.toContain('scope:');
    expect(result).not.toContain('impact:');
    expect(result).not.toContain('tags:');
  });

  it('serializes explicit null values as null in YAML', () => {
    const task: TaskInput = {
      id: 'null-task',
      name: 'Null Task',
      dependsOn: [],
      risk: null,
      scope: null,
      status: null,
    };

    const result = serializeFrontmatter(task);
    // YAML null representation (empty value or explicit null)
    expect(result).toContain('risk:');
    expect(result).toContain('scope:');
    expect(result).toContain('status:');
  });

  it('starts with opening --- delimiter', () => {
    const task: TaskInput = {
      id: 'test',
      name: 'Test',
      dependsOn: [],
    };

    const result = serializeFrontmatter(task);
    expect(result.startsWith('---\n')).toBe(true);
  });

  it('includes closing --- delimiter before body', () => {
    const task: TaskInput = {
      id: 'test',
      name: 'Test',
      dependsOn: [],
    };

    const result = serializeFrontmatter(task);
    // The closing --- must appear after the YAML content
    const lines = result.split('\n');
    // Find the second --- (closing delimiter)
    const delimiterCount = lines.filter(l => l === '---').length;
    expect(delimiterCount).toBeGreaterThanOrEqual(2);
  });

  it('appends body content after closing delimiter', () => {
    const task: TaskInput = {
      id: 'body-test',
      name: 'Body Test',
      dependsOn: [],
    };

    const result = serializeFrontmatter(task, '# My Heading\n\nSome content.');
    expect(result).toContain('# My Heading');
    expect(result).toContain('Some content.');
  });

  it('default body is empty string', () => {
    const task: TaskInput = {
      id: 'no-body',
      name: 'No Body',
      dependsOn: [],
    };

    const result = serializeFrontmatter(task);
    // After the closing --- there should be just a trailing newline
    const closingIndex = result.lastIndexOf('---');
    const afterClosing = result.slice(closingIndex + 3).trim();
    expect(afterClosing).toBe('');
  });

  // ─── Round-trip tests: parseFrontmatter(serializeFrontmatter(task)) ≈ task ──

  describe('round-trip: parseFrontmatter(serializeFrontmatter(task))', () => {
    it('round-trips a minimal TaskInput', () => {
      const original: TaskInput = {
        id: 'rt-minimal',
        name: 'Round Trip Minimal',
        dependsOn: [],
      };

      const serialized = serializeFrontmatter(original);
      const parsed = parseFrontmatter(serialized);

      expect(parsed.id).toBe(original.id);
      expect(parsed.name).toBe(original.name);
      expect(parsed.dependsOn).toEqual(original.dependsOn);
    });

    it('round-trips a TaskInput with all fields', () => {
      const original: TaskInput = {
        id: 'rt-full',
        name: 'Round Trip Full',
        dependsOn: ['dep-a', 'dep-b'],
        status: 'in-progress',
        scope: 'narrow',
        risk: 'high',
        impact: 'component',
        level: 'implementation',
        priority: 'critical',
        tags: ['urgent'],
        assignee: 'bob',
        due: '2026-06-01',
        created: '2026-04-01',
        modified: '2026-04-20',
      };

      const serialized = serializeFrontmatter(original);
      const parsed = parseFrontmatter(serialized);

      expect(parsed.id).toBe(original.id);
      expect(parsed.name).toBe(original.name);
      expect(parsed.dependsOn).toEqual(original.dependsOn);
      expect(parsed.status).toBe(original.status);
      expect(parsed.scope).toBe(original.scope);
      expect(parsed.risk).toBe(original.risk);
      expect(parsed.impact).toBe(original.impact);
      expect(parsed.level).toBe(original.level);
      expect(parsed.priority).toBe(original.priority);
      expect(parsed.tags).toEqual(original.tags);
      expect(parsed.assignee).toBe(original.assignee);
      expect(parsed.due).toBe(original.due);
      expect(parsed.created).toBe(original.created);
      expect(parsed.modified).toBe(original.modified);
    });

    it('round-trips nullable fields set to null', () => {
      const original: TaskInput = {
        id: 'rt-null',
        name: 'Round Trip Null',
        dependsOn: [],
        risk: null,
        status: null,
        assignee: null,
      };

      const serialized = serializeFrontmatter(original);
      const parsed = parseFrontmatter(serialized);

      expect(parsed.id).toBe(original.id);
      expect(parsed.risk).toBeNull();
      expect(parsed.status).toBeNull();
      expect(parsed.assignee).toBeNull();
      // Fields that were undefined in original should be undefined after round-trip
      expect(parsed.scope).toBeUndefined();
      expect(parsed.impact).toBeUndefined();
    });

    it('round-trips with body content preserved separately', () => {
      const task: TaskInput = {
        id: 'rt-body',
        name: 'Round Trip Body',
        dependsOn: [],
      };
      const body = '# Implementation Notes\n\nSome details here.';

      const serialized = serializeFrontmatter(task, body);
      // The serialized string should contain the body
      expect(serialized).toContain('# Implementation Notes');

      // Parse only the frontmatter portion (parseFrontmatter ignores body)
      const parsed = parseFrontmatter(serialized);
      expect(parsed.id).toBe('rt-body');
    });

    it('round-trips with empty dependsOn array', () => {
      const original: TaskInput = {
        id: 'rt-empty-deps',
        name: 'Empty Deps',
        dependsOn: [],
      };

      const serialized = serializeFrontmatter(original);
      const parsed = parseFrontmatter(serialized);

      expect(parsed.dependsOn).toEqual([]);
    });

    it('round-trips with populated dependsOn array', () => {
      const original: TaskInput = {
        id: 'rt-deps',
        name: 'With Deps',
        dependsOn: ['alpha', 'beta', 'gamma'],
      };

      const serialized = serializeFrontmatter(original);
      const parsed = parseFrontmatter(serialized);

      expect(parsed.dependsOn).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('round-trips with tags array', () => {
      const original: TaskInput = {
        id: 'rt-tags',
        name: 'With Tags',
        dependsOn: [],
        tags: ['urgent', 'backend', 'security'],
      };

      const serialized = serializeFrontmatter(original);
      const parsed = parseFrontmatter(serialized);

      expect(parsed.tags).toEqual(['urgent', 'backend', 'security']);
    });
  });
});