---
status: draft
last_updated: 2026-04-26
---

# Frontmatter Parsing

Parsing and serialization of task markdown files with YAML frontmatter. Included in this package, not a separate module.

## Overview

The library provides frontmatter parsing so that file-based consumers (e.g., the future OpenCode plugin) can read task markdown files directly without depending on an external parser. This supports the same YAML frontmatter format as the Rust CLI.

## Public Functions

```typescript
function parseFrontmatter(markdown: string): TaskInput
function parseTaskFile(filePath: string): Promise<TaskInput>
function parseTaskDirectory(dirPath: string): Promise<TaskInput[]>
function serializeFrontmatter(task: TaskInput, body?: string): string
```

`parseFrontmatter` and `parseTaskFile` also run TypeBox validation on the parsed data before returning — invalid frontmatter throws `InvalidInputError` with field-level details.

### parseTaskDirectory Semantics

- **Recursive** — scans subdirectories recursively
- **File extension** — `.md` only
- **No frontmatter** — files without valid `---`-delimited frontmatter are silently skipped
- **I/O errors** — throws the underlying Node.js error (ENOENT, EACCES, etc.)

This is a convenience wrapper for the common case. Consumers that need different discovery semantics (non-recursive, different extensions, custom filtering) should implement their own file discovery and call `parseTaskFile` per file.

## No gray-matter — Self-contained Splitter + yaml

The library writes its own `---` delimited frontmatter splitter and uses `yaml` (by eemeli) as the sole YAML parser. **`gray-matter` is not a dependency.**

This is a deliberate supply-chain security decision:

- **`gray-matter` depends on `js-yaml@3.x`** — an old version with known code injection vulnerabilities (CVE-2025-64718 — prototype pollution via YAML merge key `<<`). Even with gray-matter's custom engine API, `js-yaml` is still *installed* in `node_modules` as a transitive dependency. The attack surface is the install, not the import.
- **gray-matter's full tree is 11 packages** (js-yaml, argparse, kind-of, section-matter, extend-shallow, is-extendable, strip-bom-string, etc.) — none of which we need.
- **Recent npm supply chain attacks** (April 2026: 18-package phishing compromise targeting chalk/debug/etc., the Shai-Hulud self-replicating worm hitting 500+ packages, the axios RAT incident) demonstrate that every dependency in the tree is potential attack surface.

### What we don't replicate from gray-matter

TOML/Coffee engines, JavaScript eval engine, `section-matter` (nested sections), in-memory cache. We don't use any of these.

### `yaml` package profile

- Zero dependencies, full YAML 1.2 spec compliance, no known CVEs
- Actively maintained, excellent TypeScript types
- Single-package blast radius — if compromised, tractable to fork (pure JS)

### WASM YAML parser — considered and rejected

A Rust YAML crate compiled to WASM was considered as an alternative, but it reintroduces complexity the napi→graphology pivot was designed to remove (Rust toolchain in CI, WASM compile target, cold-start latency, FFI boundary). The marginal security gain over `yaml` (already zero-dep) doesn't justify the added build complexity.

## Splitter Design

The frontmatter splitter is a simple `---` delimiter parser (~40 lines). It:

1. Checks for opening `---` delimiter (not `----`)
2. Finds closing `\n---` delimiter
3. Extracts the YAML data string and the markdown content body
4. Returns `{ data: string, content: string }` or `null` if no valid frontmatter

The actual YAML parsing is delegated to `yaml.parse()`. The serializer uses `yaml.stringify()` for the data portion.

## Constraints

- **No gray-matter, no js-yaml** — these are hard exclusions for supply chain security.
- **YAML 1.2 only** — the `yaml` package implements YAML 1.2, which is a superset of JSON and avoids the ambiguous type coercion issues of YAML 1.1.
- **Frontmatter is a parsing concern, not a graph concern** — parsed `TaskInput` objects are fed to `TaskGraph.fromTasks()`. The parser doesn't know about graphs; the graph doesn't know about files.
- **File I/O functions use Node.js `fs` APIs** — `parseTaskFile` and `parseTaskDirectory` depend on `node:fs/promises` and are only available in Node.js-compatible runtimes. `parseFrontmatter` (the pure parsing function) is runtime-agnostic. Consumers targeting Deno or Bun should use `parseFrontmatter` directly with their own file-reading mechanism, or import the file I/O functions from a separate entry point if a browser-compatible bundle is needed.

## References

- `yaml` package: https://github.com/eemeli/yaml
- CVE-2025-64718 (js-yaml prototype pollution via `<<` merge key): confirmed, patched in js-yaml 4.1.1 and 3.14.2, but gray-matter still depends on the vulnerable 3.x line