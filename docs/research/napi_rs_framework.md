# NAPI-RS Framework Research Report

> Comprehensive research on the napi-rs project based on the source at `/workspace/napi-rs`
> and supplementary documentation from https://napi.rs

---

## Table of Contents

1. [Project Structure and Key Packages/Crates](#1-project-structure-and-key-packagescrates)
2. [Setting Up a New napi-rs Project](#2-setting-up-a-new-napi-rs-project)
3. [Core Patterns for Exposing Rust to JavaScript](#3-core-patterns-for-exposing-rust-to-javascript)
4. [Result/Option Types and Error Propagation](#4-resultoption-types-and-error-propagation)
5. [Async Support (Promises, async functions)](#5-async-support-promises-async-functions)
6. [Build System Configuration](#6-build-system-configuration)
7. [@napi-rs/cli Tool and Multi-Platform Builds](#7-napi-rscli-tool-and-multi-platform-builds)
8. [Thread-Safe Function Patterns (tsfn)](#8-thread-safe-function-patterns-tsfn)
9. [Serde/Serialization with napi-rs Types](#9-serdeserialization-with-napi-rs-types)
10. [Version Compatibility Notes](#10-version-compatibility-notes)

---

## 1. Project Structure and Key Packages/Crates

The napi-rs repository at `/workspace/napi-rs` is a monorepo using **Cargo workspaces** (Rust) and **Yarn workspaces** (JavaScript). The root `Cargo.toml` defines the workspace members.

### Rust Crates (`/crates/`)

| Crate | Path | Version | Purpose |
|-------|------|---------|---------|
| **`napi`** | `crates/napi/` | 3.8.5 | Main runtime library. Provides the high-level Node-API bindings, type conversions, error types, async runtime, thread-safe functions, and all `bindgen_prelude` types. |
| **`napi-sys`** | `crates/sys/` | 3.2.1 | Low-level FFI bindings. Raw `napi_*` C function declarations and type definitions. Uses `libloading` for dynamic symbol resolution. |
| **`napi-derive`** | `crates/macro/` | 3.5.4 | Procedural macro crate. Provides the `#[napi]` attribute macro that is the primary way to expose Rust code to JavaScript. |
| **`napi-derive-backend`** | `crates/backend/` | 5.0.3 | Code generation backend for `napi-derive`. Handles AST parsing, Rust-to-JS codegen, and TypeScript type definition generation. |
| **`napi-build`** | `crates/build/` | 2.3.1 | Build script utilities. Called from `build.rs` to configure linker flags for each platform (macOS dynamic_lookup, Android, WASI, Windows GNU). |

### JavaScript Packages

| Package | Path | Version | Purpose |
|---------|------|---------|---------|
| **`@napi-rs/cli`** | `cli/` | 3.6.2 | CLI tool for scaffolding, building, packaging, and publishing napi-rs projects. |
| **`@examples/napi`** | `examples/napi/` | (private) | Comprehensive test suite showcasing all napi-rs features. |

### Key Source Files

- `/crates/napi/src/lib.rs` -- Main library entry; re-exports modules, defines `bindgen_prelude`
- `/crates/napi/src/error.rs` -- `Error<S>` struct, `Result<T, S>`, `JsError`/`JsTypeError`/`JsRangeError`
- `/crates/napi/src/threadsafe_function.rs` -- `ThreadsafeFunction` implementation (869 lines)
- `/crates/napi/src/tokio_runtime.rs` -- Tokio runtime management and `execute_tokio_future`
- `/crates/napi/src/task.rs` -- `Task` and `ScopedTask` traits for async work on libuv threads
- `/crates/napi/src/async_work.rs` -- `AsyncWorkPromise` for libuv-based async tasks
- `/crates/napi/src/bindgen_runtime/` -- Core trait implementations: `ToNapiValue`, `FromNapiValue`, `TypeName`, `ValidateNapiValue`, class registration, module registration, iterator support
- `/crates/backend/src/typegen.rs` -- TypeScript `.d.ts` generation logic (981 lines)
- `/crates/macro/src/lib.rs` -- `#[napi]`, `#[module_init]`, `#[module_exports]` proc macros
- `/crates/build/src/lib.rs` -- Platform-specific linker configuration

---

## 2. Setting Up a New napi-rs Project

### Recommended: `napi new` (Scaffolding)

The `@napi-rs/cli` provides a `new` command that generates a fully configured project:

```sh
napi new <path> [options]
```

**Available options:**

| Option | CLI Flag | Default | Description |
|--------|----------|---------|-------------|
| `path` | `<path>` | -- | Directory where project is created |
| `name` | `--name,-n` | directory name | Project name |
| `minNodeApiVersion` | `--min-node-api,-v` | 4 | Minimum N-API version |
| `packageManager` | `--package-manager` | yarn | Package manager (yarn 4.x only for now) |
| `license` | `--license,-l` | MIT | License |
| `targets` | `--targets,-t` | [] | Compilation targets |
| `enableDefaultTargets` | `--enable-default-targets` | true | Enable default platform targets |
| `enableAllTargets` | `--enable-all-targets` | false | Enable all platform targets |
| `enableTypeDef` | `--enable-type-def` | true | Auto-generate TypeScript definitions |
| `enableGithubActions` | `--enable-github-actions` | true | Generate GitHub Actions CI workflow |
| `testFramework` | `--test-framework` | ava | JS test framework (ava only for now) |

**Example:**

```sh
napi new ./my-addon --name my-addon --min-node-api 4
```

### Alternative: package-template

The GitHub repository [napi-rs/package-template](https://github.com/napi-rs/package-template) is the canonical template referenced in the README.

### Minimal Manual Setup

If not using scaffolding, a minimal napi-rs project requires:

1. **`Cargo.toml`** with `crate-type = ["cdylib"]`
2. **`build.rs`** calling `napi_build::setup()`
3. **`package.json`** with `@napi-rs/cli` devDependency and napi config
4. Rust source with `#[napi]` annotated functions

(See Section 6 for full configuration details.)

---

## 3. Core Patterns for Exposing Rust to JavaScript

### 3.1 Functions

The `#[napi]` attribute on functions exposes them as JavaScript functions:

```rust
use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub fn fibonacci(n: u32) -> u32 {
    match n {
        1 | 2 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}
```

**Key behaviors:**
- Function name is converted to camelCase in JavaScript (e.g., `fibonacci` stays `fibonacci`, `my_func` becomes `myFunc`)
- JSDoc comments (`///`) on Rust functions become TypeScript documentation
- The `#[napi(js_name = "...")]` attribute allows custom JavaScript naming

### 3.2 Structs as JavaScript Classes

There are two patterns for structs:

#### a) Struct with `#[napi]` -- JavaScript Class

```rust
#[napi]
pub struct Animal {
    #[napi(readonly)]
    pub kind: Kind,
    name: String,
    optional_value: Option<i32>,
}

#[napi]
impl Animal {
    #[napi(constructor)]
    pub fn new(kind: Kind, name: String) -> Self {
        Animal { kind, name, optional_value: None }
    }

    #[napi(factory)]
    pub fn with_kind(kind: Kind) -> Self {
        Animal { kind, name: "Default".to_owned(), optional_value: None }
    }

    #[napi(getter)]
    pub fn get_name(&self) -> &str { self.name.as_str() }

    #[napi(setter)]
    pub fn set_name(&mut self, name: String) { self.name = name; }

    #[napi(getter, js_name = "type")]
    pub fn kind(&self) -> Kind { self.kind }

    #[napi]
    pub fn whoami(&self) -> String { /* ... */ }

    #[napi]
    pub fn get_dog_kind() -> Kind { Kind::Dog }  // static method
}
```

**Key attributes on struct:**
- `#[napi(constructor)]` -- All public fields become constructor parameters; a default constructor is generated
- `#[napi(js_name = "Assets")]` -- Rename in JavaScript
- `#[napi(custom_finalize)]` -- Enable `ObjectFinalize` trait for custom cleanup

**Key attributes on impl methods:**
- `#[napi(constructor)]` -- Mark as constructor
- `#[napi(factory)]` -- Static factory method
- `#[napi(getter)]` / `#[napi(setter)]` -- Define getters/setters
- `#[napi(js_name = "type")]` -- Custom JS name
- `#[napi(ts_arg_type = "...")]` -- Override TypeScript arg type
- `#[napi(skip_typescript)]` -- Exclude from TypeScript definitions
- `#[napi(writable = false)]` -- Make property read-only in JS
- `#[napi(catch_unwind)]` -- Catch panics and convert to JS errors

#### b) Struct with `#[napi(object)]` -- JavaScript Plain Object (Interface)

```rust
#[napi(object)]
struct AllOptionalObject {
    pub name: Option<String>,
    pub age: Option<u32>,
}
```

**Key attributes:**
- `#[napi(object)]` -- Generate as a TypeScript interface, not a class
- `#[napi(object, object_to_js = false)]` -- Only deserialize from JS (input-only)
- `#[napi(object, object_from_js = false)]` -- Only serialize to JS (output-only)
- `#[napi(object, use_nullable = true)]` -- Generate `nullable` TypeScript types instead of `optional`
- `#[napi(ts_type = "object")]` -- Override TypeScript field type
- `#[napi(js_name = "customField")]` -- Rename field in JS

### 3.3 Enums

#### a) Numeric Enums (default)

```rust
#[napi]
#[derive(Debug, Clone, Copy)]
pub enum Kind {
    Dog,   // 0
    Cat,   // 1
    Duck,  // 2
}
```

Custom discriminant values with step resolution:

```rust
#[napi]
pub enum CustomNumEnum {
    One = 1,   // 1
    Two,       // 2
    Three = 3, // 3
    Four,      // 4
    Six = 6,
    Eight = 8,
    Nine,  // 9
    Ten,   // 10
}
```

#### b) String Enums

```rust
#[napi(string_enum)]
pub enum Status {
    Pristine,  // "Pristine"
    Loading,   // "Loading"
    Ready,     // "Ready"
}

#[napi(string_enum = "lowercase")]
pub enum StringEnum {
    VariantOne,   // "variantone"
    VariantTwo,   // "varianttwo"
}

#[napi(string_enum)]
pub enum CustomStringEnum {
    #[napi(value = "my-custom-value")]
    Foo,        // "my-custom-value"
    Bar,        // "Bar"
    Baz,        // "Baz"
}
```

#### c) Structured Enums (Tagged Unions)

```rust
#[napi(discriminant = "type2")]
pub enum StructuredKind {
    Hello,
    Greeting { name: String },
    Birthday { name: String, age: u8 },
    Tuple(u32, u32),
}

#[napi(discriminant_case = "lowercase")]
pub enum StructuredKindLowercase {
    Hello,           // { type2: "hello" }
    Greeting { name: String },  // { type2: "greeting", name: "..." }
}
```

### 3.4 Transparent Types

Newtype pattern that wraps an existing JS-compatible type:

```rust
#[napi(transparent)]
struct MyVec(Vec<Either<u32, String>>);

#[napi]
fn get_my_vec() -> MyVec {
    MyVec(vec![Either::A(42), Either::B("a string".to_owned())])
}
```

### 3.5 Constants

```rust
#[napi]
/// This is a const
pub const DEFAULT_COST: u32 = 12;

#[napi(skip_typescript)]
pub const TYPE_SKIPPED_CONST: u32 = 12;
```

### 3.6 Callbacks (Fn/FnMut/FnOnce traits)

```rust
#[napi]
pub fn get_cwd<T: Fn(String) -> Result<()>>(callback: T) {
    callback(std::env::current_dir().unwrap().to_string_lossy().to_string()).unwrap();
}

#[napi]
pub fn test_callback<T>(callback: T) -> Result<()>
where
    T: Fn(String) -> Result<()>,
{
    callback(std::env::current_dir()?.to_string_lossy().to_string())
}
```

### 3.7 TypeScript Customization

The `#[napi]` macro supports several attributes for TypeScript generation:

- `ts_args_type` -- Override all function argument types
- `ts_return_type` -- Override function return type
- `ts_generic_types` -- Add generic type parameters
- `ts_type` -- Override field type in objects
- `skip_typescript` -- Skip generation in `.d.ts`
- `js_name` -- Rename in JS/TS

```rust
#[napi(
    ts_generic_types = "T",
    ts_args_type = "functionInput: () => T | Promise<T>, callback: (err: Error | null, result: T) => void",
    ts_return_type = "T | Promise<T>"
)]
fn callback_return_promise<'env>(/* ... */) -> Result<Unknown<'env>> { /* ... */ }
```

### 3.8 Either Types

napi-rs provides `Either<A, B>`, `Either3<A, B, C>`, and `Either4<A, B, C, D>` for union types:

```rust
#[napi]
fn either_string_or_number(input: Either<String, u32>) -> u32 {
    match input {
        Either::A(s) => s.len() as u32,
        Either::B(n) => n,
    }
}

#[napi]
fn receive_class_or_number(either: Either<u32, &JsClassForEither>) -> u32 {
    match either {
        Either::A(n) => n + 1,
        Either::B(_) => 100,
    }
}

#[napi]
pub async fn promise_in_either(input: Either<u32, Promise<u32>>) -> Result<bool> {
    match input {
        Either::A(a) => Ok(a > 10),
        Either::B(b) => {
            let r = b.await?;
            Ok(r > 10)
        }
    }
}
```

### 3.9 Module Exports / Module Init

Custom module initialization can be done with `#[napi(module_exports)]` or `#[napi_derive::module_init]`:

```rust
#[napi(module_exports)]
pub fn exports(mut export: Object) -> Result<()> {
    let symbol = Symbol::for_desc("NAPI_RS_SYMBOL");
    export.set_named_property("NAPI_RS_SYMBOL", symbol)?;
    Ok(())
}

// For custom tokio runtime:
#[napi_derive::module_init]
fn init() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap();
    create_custom_tokio_runtime(rt);
}
```

---

## 4. Result/Option Types and Error Propagation

### 4.1 The `Result` Type

napi-rs defines its own `Result` type alias:

```rust
pub type Result<T, S = Status> = std::result::Result<T, Error<S>>;
```

Returning `Result<T>` from a `#[napi]` function causes errors to be thrown as JavaScript errors. Returning `Ok(value)` resolves normally.

### 4.2 The `Error` Struct

```rust
pub struct Error<S: AsRef<str> = Status> {
    pub status: S,
    pub reason: String,
    pub cause: Option<Box<Error>>,
    maybe_raw: sys::napi_ref,
    maybe_env: sys::napi_env,
}
```

**Creating errors:**

```rust
// Standard error with status code
Err(Error::new(Status::InvalidArg, "Manual Error".to_owned()))

// Error with cause (chained errors)
let mut err = Error::new(Status::GenericFailure, "Manual Error".to_owned());
err.set_cause(Error::new(Status::InvalidArg, "Inner Error".to_owned()));
Err(err)

// From a reason string (uses GenericFailure status)
Error::from_reason("something went wrong")
```

### 4.3 Error Type Variants

napi-rs provides specialized error types for different JavaScript error classes:

| Rust Type | JavaScript Equivalent |
|-----------|----------------------|
| `JsError` | `Error` |
| `JsTypeError` | `TypeError` |
| `JsRangeError` | `RangeError` |
| `JsSyntaxError` (napi9) | `SyntaxError` |

### 4.4 Custom Error Status

You can define custom error status types by implementing `AsRef<str>` and `From<Status>`:

```rust
pub enum CustomError {
    NapiError(Error<Status>),
    Panic,
}

impl AsRef<str> for CustomError {
    fn as_ref(&self) -> &str {
        match self {
            CustomError::Panic => "Panic",
            CustomError::NapiError(e) => e.status.as_ref(),
        }
    }
}

#[napi]
pub fn custom_status_code() -> Result<(), CustomError> {
    Err(Error::new(CustomError::Panic, "don't panic"))
}
```

### 4.5 Automatic Conversions from std::io::Error and Others

The `Error` struct implements `From` for common Rust error types:

- `From<std::io::Error>`
- `From<std::ffi::NulError>`
- `From<anyhow::Error>` (with `error_anyhow` feature)
- `From<serde_json::Error>` (with `serde-json` feature)

This allows using `?` operator to propagate standard Rust errors.

### 4.6 Catch Unwind

The `#[napi(catch_unwind)]` attribute catches Rust panics and converts them to JavaScript errors:

```rust
#[napi(catch_unwind)]
pub fn panic() {
    panic!("Don't panic");
}
```

### 4.7 Option Type Mapping

| Rust `Option<T>` | JavaScript |
|------------------|-----------|
| `Option<u32>` | `number \| undefined` |
| `Option<String>` | `string \| undefined` |
| `None` | `undefined` (or `null` depending on context) |
| `Option<Struct>` where Struct is a class | `Struct \| null` |

Null and Undefined are explicit types:

```rust
#[napi]
fn return_null() -> Null { Null }

#[napi]
fn return_undefined() -> Undefined {}
```

For objects, `#[napi(object, use_nullable = true)]` generates `nullable` TS types (e.g., `string | null`) instead of `optional` (e.g., `string | undefined`).

---

## 5. Async Support (Promises, async functions)

### 5.1 Async Functions (tokio-based)

With the `async` feature enabled, any `async fn` annotated with `#[napi]` returns a JavaScript `Promise`:

```rust
// Cargo.toml: napi = { version = "3", features = ["async"] }

#[napi]
async fn read_file_async(path: String) -> Result<Buffer> {
    Ok(tokio::fs::read(path).await?.into())
}

#[napi]
async fn async_multi_two(arg: u32) -> Result<u32> {
    tokio::task::spawn(async move { Ok(arg * 2) })
        .await
        .unwrap()
}
```

**Requirements:**
- Enable the `async` feature (which includes `tokio_rt`)
- napi-rs manages a Tokio runtime internally (multi-threaded by default)
- Async errors are properly propagated as rejected promises

### 5.2 Custom Tokio Runtime

You can provide a custom Tokio runtime configuration:

```rust
#[napi_derive::module_init]
fn init() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .thread_stack_size(32 * 1024 * 1024)
        .build()
        .unwrap();
    napi::bindgen_prelude::create_custom_tokio_runtime(rt);
}
```

### 5.3 `async_runtime` Attribute

Run a synchronous function inside the async runtime context:

```rust
#[napi(async_runtime)]
pub fn within_async_runtime_if_available() {
    tokio::spawn(async {
        println!("within_runtime_if_available");
    });
}
```

### 5.4 AsyncTask (libuv thread pool)

For CPU-intensive work that should run on the libuv thread pool rather than the Tokio runtime, use the `Task` trait:

```rust
pub struct DelaySum(u32, u32);

#[napi]
impl napi::Task for DelaySum {
    type Output = u32;
    type JsValue = u32;

    fn compute(&mut self) -> Result<Self::Output> {
        // Runs on libuv thread pool
        std::thread::sleep(std::time::Duration::from_millis(100));
        Ok(self.0 + self.1)
    }

    fn resolve(&mut self, _env: napi::Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }

    fn finally(self, _env: napi::Env) -> Result<()> {
        Ok(())
    }
}

#[napi]
pub fn with_abort_controller(a: u32, b: u32, signal: AbortSignal) -> AsyncTask<DelaySum> {
    AsyncTask::with_signal(DelaySum(a, b), signal)
}
```

**Task vs ScopedTask:**
- `Task` -- `resolve` takes `Env` by value; output and JsValue must be `'static`
- `ScopedTask<'task>` -- `resolve` takes `&'task Env`; JsValue can borrow from the env (e.g., `BufferSlice<'task>`, `Array<'task>`)

### 5.5 Promise and PromiseRaw

Work directly with JavaScript Promise objects:

```rust
// Await a Promise from JavaScript
#[napi]
pub async fn async_plus_100(p: Promise<u32>) -> Result<u32> {
    let v = p.await?;
    Ok(v + 100)
}

// Create resolved/rejected promises
#[napi]
pub fn create_resolved_promise<'env>(env: &'env Env, value: u32) -> Result<PromiseRaw<'env, u32>> {
    PromiseRaw::resolve(env, value)
}

#[napi]
pub fn create_rejected_promise<'env>(env: &'env Env, message: String) -> Result<PromiseRaw<'env, u32>> {
    PromiseRaw::reject(env, Error::from_reason(message))
}

// Chain .then/.catch/.finally
#[napi]
pub fn call_then_on_promise(input: PromiseRaw<u32>) -> Result<PromiseRaw<String>> {
    input.then(|v| Ok(format!("{}", v.value)))
}

#[napi]
pub fn call_catch_on_promise(input: PromiseRaw<'_, u32>) -> Result<PromiseRaw<'_, String>> {
    input.catch(|e: CallbackContext<String>| Ok(e.value))
}
```

### 5.6 Spawning Futures Manually

```rust
env.spawn_future(async move { Ok(some_value) })
env.spawn_future_with_callback(async move { Ok(some_value) }, |env, val| {
    env.create_string(format!("{}", val))
})
```

---

## 6. Build System Configuration

### 6.1 Cargo.toml

```toml
[package]
name = "my-addon"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
napi = { version = "3", features = ["napi4"] }  # or more features
napi-derive = "3"

[build-dependencies]
napi-build = "2"

[profile.release]
lto = true
```

**Critical:** `crate-type = ["cdylib"]` is required so cargo builds a C-style shared library that Node can dynamically load.

### 6.2 Feature Flags on `napi` Crate

| Feature | Requires | Description |
|---------|----------|-------------|
| `napi1` through `napi10` | incremental | Progressive N-API version support |
| `async` / `tokio_rt` | napi4 | Tokio runtime + async fn support |
| `serde-json` | -- | serde Serialize/Deserialize for JS <-> Rust |
| `serde-json-ordered` | serde-json | Preserves key order with `serde_json/preserve_order` |
| `latin1` | -- | Latin1 string decoding via `encoding_rs` |
| `chrono_date` | napi5 | `chrono::DateTime` support |
| `error_anyhow` | -- | `From<anyhow::Error>` for napi::Error |
| `web_stream` | napi4, tokio_rt | Web Streams API support |
| `deferred_trace` | napi4 | Deferred stack trace |
| `object_indexmap` | -- | `indexmap::IndexMap` support |
| `tracing` | -- | `tracing` crate integration |
| `dyn-symbols` | -- | Dynamic symbol resolution (default) |
| `compat-mode` | -- | Deprecated types/traits for v2 compatibility |
| `noop` | -- | Generate no-op code (for testing) |

**Common feature combinations:**
- Minimal: `napi = { version = "3", default-features = false, features = ["napi4"] }`
- With async: `napi = { version = "3", features = ["napi4", "async"] }`
- Full: `napi = { version = "3", features = ["full"] }` (includes napi10, async, serde-json, experimental, chrono_date, latin1)

### 6.3 napi-derive Features

| Feature | Description |
|---------|-------------|
| `type-def` (default) | Auto-generate TypeScript `.d.ts` definitions |
| `strict` (default) | Strict type checking in macro expansion |
| `compat-mode` | Deprecated attribute compatibility |
| `tracing` | Tracing in macro expansion |
| `noop` | Generate no-op code |

### 6.4 build.rs

Every napi-rs project must have a `build.rs` that calls `napi_build::setup()`:

```rust
fn main() {
    napi_build::setup();
}
```

**What `napi_build::setup()` does:**
1. Sets `cargo:rerun-if-env-changed` for various NAPI environment variables
2. On **macOS**: adds linker flags `-Wl,-undefined,dynamic_lookup` (needed because Node.js symbols are resolved at runtime, not link time)
3. On **Windows (GNU)**: configures GNU toolchain linker settings
4. On **Android/WASI**: platform-specific setup
5. On **GNU libc / FreeBSD**: adds `-Wl,-z,nodelete` to prevent DSO unloading issues with pthread_key_create destructors

### 6.5 package.json (napi config)

```json
{
  "name": "my-addon",
  "devDependencies": {
    "@napi-rs/cli": "^3.0.0"
  },
  "napi": {
    "name": "jarvis",
    "binaryName": "example",
    "wasm": {
      "initialMemory": 16384,
      "browser": { "fs": true, "buffer": true }
    },
    "dtsHeader": "type MaybePromise<T> = T | Promise<T>",
    "dtsHeaderFile": "./dts-header.d.ts",
    "targets": ["wasm32-wasip1-threads"]
  },
  "scripts": {
    "build": "napi build --release",
    "build:debug": "napi build",
    "build:platform": "napi build --platform"
  }
}
```

The `napi.name` / `napi.binaryName` field determines the output `.node` file name. The naming convention converts hyphens to underscores: `my-addon` -> `my_addon.node`.

---

## 7. @napi-rs/cli Tool and Multi-Platform Builds

### 7.1 CLI Version: 3.6.2

The `@napi-rs/cli` package (at `/workspace/napi-rs/cli/`) is the primary tooling for building, packaging, and releasing napi-rs projects.

### 7.2 Commands Overview

| Command | Description |
|---------|-------------|
| `napi new` | Create a new project with pre-configured boilerplate |
| `napi build` | Build the napi-rs project |
| `napi create-npm-dirs` | Create per-platform npm package directories |
| `napi artifacts` | Copy build artifacts from GitHub Actions |
| `napi rename` | Rename the project |
| `napi universalize` | Combine binaries into a universal binary (e.g., macOS arm64 + x64) |
| `napi version` | Update version across per-platform npm packages |
| `napi pre-publish` | Prepare packages for npm publish |

### 7.3 Build Command Details

```sh
napi build [--release] [--platform] [--target <triple>] [options]
```

**Key options:**

| Option | Description |
|--------|-------------|
| `--target,-t` | Target triple (passed to `cargo build --target`) |
| `--platform` | Add platform triple suffix (e.g., `.linux-x64-gnu.node`) |
| `--release,-r` | Build in release mode |
| `--js` | Path/filename for generated JS binding |
| `--no-js` | Disable JS binding generation |
| `--dts` | Path/filename for generated TypeScript definitions |
| `--strip,-s` | Strip debug symbols for minimum file size |
| `--cross-compile,-x` | Cross-compile using `cargo-xwin` / `cargo-zigbuild` |
| `--use-cross` | Use [cross](https://github.com/cross-rs/cross) instead of `cargo` |
| `--use-napi-cross` | Use `@napi-rs/cross-toolchain` for Linux ARM/ARM64/x64 GNU |
| `--watch,-w` | Watch and rebuild continuously |
| `--features,-F` | Space-separatedCargo features to activate |
| `--output-dir,-o` | Output directory for built files |
| `--esm` | Generate ESM JS binding instead of CJS |
| `--const-enum` | Generate const enums in TypeScript |

### 7.4 Multi-Platform Build Workflow

The typical cross-compilation workflow:

1. **Build** for each target:
   ```sh
   napi build --platform --target x86_64-unknown-linux-gnu
   napi build --platform --target aarch64-apple-darwin
   napi build --platform --target x86_64-pc-windows-msvc
   ```

2. **Universalize** (macOS only -- combine arm64 + x64 into a single universal binary):
   ```sh
   napi universalize
   ```

3. **Create npm directories** for per-platform packages:
   ```sh
   napi create-npm-dirs
   ```

4. **Artifacts** -- Collect `.node` files from GitHub Actions CI:
   ```sh
   napi artifacts --output-dir ./artifacts
   ```

5. **Pre-publish** -- Copy platform-specific `.node` files into per-platform npm packages:
   ```sh
   napi pre-publish --npm-dir npm
   ```

### 7.5 Supported Platforms

| Platform | Architectures | Variants |
|----------|---------------|----------|
| Windows | x64, x86, arm64 | MSVC, GNU |
| macOS | x64, aarch64 | - |
| Linux | x64, aarch64, arm, riscv64, s390x, ppc64le, loong64 | gnu, musl, gnueabihf, musleabihf |
| FreeBSD | x64 | - |
| Android | aarch64, armv7 | - |

---

## 8. Thread-Safe Function Patterns (tsfn)

Thread-safe functions (TSFNs) are the mechanism for calling JavaScript from background threads. They are the cornerstone of async and concurrent interop in napi-rs.

### 8.1 Basic Usage

```rust
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};

#[napi]
pub fn call_threadsafe_function(
    tsfn: Arc<ThreadsafeFunction<u32, UnknownReturnValue>>,
) -> Result<()> {
    for n in 0..100 {
        let tsfn = tsfn.clone();
        thread::spawn(move || {
            tsfn.call(Ok(n), ThreadsafeFunctionCallMode::NonBlocking);
        });
    }
    Ok(())
}
```

### 8.2 Type Parameters

```rust
ThreadsafeFunction<
    T: 'static,                    // Input type (what you send from Rust)
    Return: FromNapiValue,          // Return type from JS callback
    CallJsBackArgs: JsValuesTupleIntoVec,  // Arguments passed to JS callback
    ErrorStatus: AsRef<str> + From<Status>,  // Custom error status
    const CalleeHandled: bool,      // Whether callback follows (err, result) pattern
    const Weak: bool,               // Weak reference (won't prevent event loop exit)
    const MaxQueueSize: usize,       // Max queued calls (0 = unlimited)
>
```

### 8.3 Caller-Handled vs Callee-Handled

**Callee-handled** (`CalleeHandled = true`, default): Follows Node.js callback convention, prepending `null` as the first arg on success:

```rust
// Callee-handled: JS receives (null, value) on success, (error, undefined) on failure
let tsfn: ThreadsafeFunction<u32, UnknownReturnValue>;
tsfn.call(Ok(42), ThreadsafeFunctionCallMode::NonBlocking);
```

**Caller-handled** (`CalleeHandled = false`): No error-first argument. On error, calls `napi_fatal_exception`:

```rust
// Fatal mode: JS receives just (value), no error-first convention
let tsfn: ThreadsafeFunction<u32, (), u32, Status, false>;
tsfn.call(42, ThreadsafeFunctionCallMode::NonBlocking);
```

### 8.4 Async Call with Return Value

```rust
#[napi]
pub async fn tsfn_return_promise(func: ThreadsafeFunction<u32, Promise<u32>>) -> Result<u32> {
    let val = func.call_async(Ok(1)).await?.await?;
    Ok(val + 2)
}
```

### 8.5 Call with Return Value Callback

```rust
#[napi]
pub fn tsfn_call_with_callback(tsfn: ThreadsafeFunction<(), String>) -> napi::Result<()> {
    tsfn.call_with_return_value(
        Ok(()),
        ThreadsafeFunctionCallMode::NonBlocking,
        |value: Result<String>, _| {
            let value = value.expect("Failed to retrieve value from JS");
            println!("{}", value);
            Ok(())
        },
    );
    Ok(())
}
```

### 8.6 Building from a Function

The builder pattern allows customizing TSFN behavior:

```rust
#[napi]
pub fn build_threadsafe_function_from_function(
    callback: Function<FnArgs<(u32, u32)>, u32>,
) -> Result<()> {
    let tsfn = callback.build_threadsafe_function().build()?;
    let tsfn_fatal = callback
        .build_threadsafe_function()
        .callee_handled::<true>()
        .build()?;
    let tsfn_max_queue = callback
        .build_threadsafe_function()
        .max_queue_size::<1>()
        .build()?;
    let tsfn_weak = callback
        .build_threadsafe_function()
        .weak::<true>()
        .build()?;
    Ok(())
}
```

### 8.7 Custom Error Status

```rust
pub struct ErrorStatus(String);
impl AsRef<str> for ErrorStatus {
    fn as_ref(&self) -> &str { &self.0 }
}
impl From<Status> for ErrorStatus {
    fn from(value: Status) -> Self { ErrorStatus(value.to_string()) }
}

#[napi]
pub fn threadsafe_function_throw_error_with_status(
    cb: ThreadsafeFunction<bool, UnknownReturnValue, bool, ErrorStatus>,
) -> Result<()> {
    thread::spawn(move || {
        cb.call(
            Err(Error::new(ErrorStatus("CustomErrorStatus".to_string()), "ThrowFromNative".to_owned())),
            ThreadsafeFunctionCallMode::Blocking,
        );
    });
    Ok(())
}
```

### 8.8 Weak Threadsafe Functions

Weak TSFNs do not prevent the Node.js event loop from exiting:

```rust
#[napi]
pub async fn tsfn_weak(
    tsfn: ThreadsafeFunction<(), (), (), Status, false, true>,
) -> napi::Result<()> {
    tsfn.call_async(()).await
}
```

### 8.9 Tuple Arguments

```rust
#[napi]
pub fn accept_threadsafe_function_tuple_args(
    func: ThreadsafeFunction<FnArgs<(u32, bool, String)>>,
) {
    thread::spawn(move || {
        func.call(
            Ok((1, false, "NAPI-RS".into()).into()),
            ThreadsafeFunctionCallMode::NonBlocking,
        );
    });
}
```

---

## 9. Serde/Serialization with napi-rs Types

### 9.1 Feature Flag

Enable `serde-json` feature:
```toml
[dependencies]
napi = { version = "3", features = ["serde-json"] }
```

This adds:
- `impl ser::Error for Error` and `impl de::Error for Error`
- `impl From<serde_json::Error> for Error`
- `env.from_js_value()` and `env.to_js_value()` for serde types
- Automatic (de)serialization between `serde_json::Value` and JS values
- Automatic (de)serialization between `serde_json::Map` and JS objects

### 9.2 Using `#[napi(object)]` with Serde

```rust
#[napi(object)]
#[derive(Serialize, Deserialize, Debug)]
struct PackageJson {
    pub name: String,
    pub version: String,
    pub dependencies: Option<Map<String, Value>>,
    #[serde(rename = "devDependencies")]
    pub dev_dependencies: Option<Map<String, Value>>,
}

#[napi]
fn read_package_json() -> Result<PackageJson> {
    let raw = fs::read_to_string("package.json")?;
    let p: PackageJson = serde_json::from_str(&raw)?;
    Ok(p)
}
```

When a struct has both `#[napi(object)]` and `#[derive(Serialize, Deserialize)]`, napi-rs uses serde for bidirectional conversion. The struct acts as a TypeScript interface with automatic serialization from JS objects and deserialization to JS objects.

### 9.3 Direct serde_json::Value

```rust
#[napi]
fn test_serde_roundtrip(data: Value) -> Value {
    data  // serde_json::Value <-> JavaScript any
}

#[napi]
fn test_serde_big_number_precision(number: String) -> Value {
    let data = format!("{{\"number\":{}}}", number);
    serde_json::from_str(&data).unwrap()
}
```

### 9.4 Manual Serde with env.from_js_value / env.to_js_value

```rust
#[derive(Serialize, Debug, Deserialize)]
struct BytesObject {
    #[serde(with = "serde_bytes")]
    code: Vec<u8>,
}

#[napi]
fn test_serde_buffer_bytes(obj: Object, env: Env) -> napi::Result<usize> {
    let obj: BytesObject = env.from_js_value(obj)?;
    Ok(obj.code.len())
}
```

### 9.5 Class with Serde

```rust
#[napi]
struct PackageJsonReader {
    i: Value,
}

#[napi]
impl PackageJsonReader {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        let raw = fs::read_to_string("package.json")?;
        Ok(Self { i: serde_json::from_str(&raw)? })
    }

    #[napi]
    pub fn read(&self) -> &Value {
        &self.i
    }
}
```

### 9.6 serde_bytes Support

For `Vec<u8>` fields that should be serialized as binary data (Buffer in JS), use `serde_bytes`:

```rust
#[derive(Serialize, Deserialize)]
struct BytesObject {
    #[serde(with = "serde_bytes")]
    code: Vec<u8>,
}
```

### 9.7 Ordered JSON

Use `serde-json-ordered` feature to preserve JSON key insertion order:

```toml
napi = { version = "3", features = ["serde-json-ordered"] }
```

---

## 10. Version Compatibility Notes

### 10.1 Current Checkout Version

Based on git log and Cargo.toml files at `/workspace/napi-rs`:

| Component | Version |
|-----------|---------|
| **napi crate** | 3.8.5 |
| **napi-sys crate** | 3.2.1 |
| **napi-derive crate** | 3.5.4 |
| **napi-derive-backend crate** | 5.0.3 |
| **napi-build crate** | 2.3.1 |
| **@napi-rs/cli** | 3.6.2 |
| **Git tag** | `napi-v3.8.5` |
| **Rust MSRV** | 1.88.0 |

### 10.2 Versioning Scheme

napi-rs uses a monorepo with independent crate versioning. The major version of the `napi` crate (v3) and `napi-derive` (v3) should match. `napi-build` is v2.x. The npm CLI package follows its own SemVer (v3.6.x).

### 10.3 N-API Version Matrix

napi-rs supports N-API versions 1 through 10 via feature flags:

| Feature | N-API Version | Min Node.js | Key Capabilities |
|---------|---------------|-------------|------------------|
| `napi1` | 1 | v8.0.0 | Basic types, functions |
| `napi2` | 2 | v8.10.0 | Thread-safe functions (experimental) |
| `napi3` | 3 | v9.11.0 | Cleanup hooks |
| `napi4` | 4 | v10.6.0 | Thread-safe functions (stable), tokio_rt |
| `napi5` | 5 | v10.17.0 / v12.0.0 | Date |
| `napi6` | 6 | v10.7.0 / v12.0.0 | BigInt |
| `napi7` | 7 | v10.12.0 | Detached array buffers |
| `napi8` | 8 | v10.23+ / v12.23+ | Async cleanup hooks |
| `napi9` | 9 | v14.21+ / v16.17+ | SyntaxError, object property management |
| `napi10` | 10 | v18.17.0 | create_object_with_properties |

### 10.4 Type Conversion Table

From the README features table:

| Rust Type | JavaScript Type | N-API Version | Feature Flag |
|-----------|----------------|---------------|--------------|
| `u32` | Number | 1 | -- |
| `i32` / `i64` | Number | 1 | -- |
| `f64` | Number | 1 | -- |
| `bool` | Boolean | 1 | -- |
| `String` / `&str` | String | 1 | -- |
| `Latin1String` | String | 1 | `latin1` |
| `UTF16String` | String | 1 | -- |
| `Object` | Object | 1 | -- |
| `serde_json::Map` | Object | 1 | `serde-json` |
| `serde_json::Value` | any | 1 | `serde-json` |
| `Array` | Array<any> | 1 | -- |
| `Vec<T>` | Array<T> | 1 | -- |
| `Buffer` | Buffer | 1 | -- |
| `External<T>` | External<T> | 1 | -- |
| `Null` | null | 1 | -- |
| `Undefined` / `()` | undefined | 1 | -- |
| `T: Fn(...) -> Result<T>` | Function | 1 | -- |
| `Async/Future` | Promise<T> | 4 | `async` |
| `AsyncTask` | Promise<T> | 1 | -- |
| `JsGlobal` | global | 1 | -- |
| `JsSymbol` | Symbol | 1 | -- |
| `Int8Array`/`Uint8Array`... | TypedArray | 1 | -- |
| `JsFunction` | threadsafe function | 4 | `napi4` |
| `BigInt` | BigInt | 6 | `napi6` |

### 10.5 Electron Support

napi-rs works in Electron. The tokio runtime is designed to handle Electron renderer process environment recycling (Node env exits and recreates on window reload). The `start_async_runtime()` and `shutdown_async_runtime()` functions manage the runtime lifecycle.

### 10.6 WebAssembly Support

napi-rs has experimental WASM support via the `wasm32-wasip1-threads` target. Key notes:
- The `@napi-rs/wasm-runtime` and `@emnapi/runtime` packages provide the WASM runtime
- Build with: `napi build --platform --target wasm32-wasip1-threads`
- Some features (like `tokio/net`, file I/O) are conditionally compiled out for WASM
- `tokio_unstable` cfg is used for WASM-specific tokio configuration

### 10.7 Breaking Changes Notes

- Version 3.x uses declarative `#[ctor]` for module registration (as of commit `ba6597b3`)
- `compat-mode` feature enables deprecated v2 types/traits
- The `ThreadSafeCallContext` type was renamed to `ThreadsafeCallContext` (v2.17.0+)
- Manual `refer()`/`unref()`/`abort()` methods on ThreadsafeFunction are deprecated; use `Clone`/`Drop` instead

---

## Appendix: Type Conversion Quick Reference

### Primitive Types

| Rust | TypeScript |
|------|-----------|
| `u32`, `i32`, `f64` | `number` |
| `i64`, `u64` | `number` (or `BigInt` with `napi6`) |
| `bool` | `boolean` |
| `String`, `&str` | `string` |
| `()` | `void` |
| `Null` | `null` |
| `Undefined` | `undefined` |

### Compound Types

| Rust | TypeScript |
|------|-----------|
| `Vec<T>` | `Array<T>` |
| `Buffer` / `Uint8Array` | `Buffer` / `Uint8Array` |
| `Object` | `object` |
| `Option<T>` | `T \| undefined` (or `T \| null`) |
| `Either<A, B>` | `A \| B` |
| `Either3<A, B, C>` | `A \| B \| C` |
| `Either4<A, B, C, D>` | `A \| B \| C \| D` |
| `Result<T>` | throw/rethrow |
| `Promise<T>` | `Promise<T>` |
| `Function<Args, Return>` | `Function` |
| `serde_json::Value` | `any` |

### Class Patterns

| Rust Attribute | TypeScript |
|----------------|-----------|
| `#[napi] struct` | `class` |
| `#[napi(object)] struct` | `interface` |
| `#[napi(transparent)] struct` | same as inner type |
| `#[napi] enum` | numeric `enum` |
| `#[napi(string_enum)] enum` | string union type |
| `#[napi(discriminant = "type")] enum` | tagged union / discriminated union |

---

*Report generated from source at `/workspace/napi-rs` (commit `ba6597b3`, tag `napi-v3.8.5`) and https://napi.rs*
