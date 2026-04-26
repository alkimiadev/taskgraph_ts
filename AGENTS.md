## Memory Tools (via @alkdev/open-memory plugin)

You have access to two tools for managing your context and accessing session history:

### memory({tool: "...", args: {...}})

Read-only tool for introspecting your session history and context state. Available operations:
- `memory({tool: "help"})` — full reference with examples
- `memory({tool: "summary"})` — quick counts of projects, sessions, messages, todos
- `memory({tool: "sessions"})` — list recent sessions (useful for finding past work)
- `memory({tool: "children", args: {sessionId: "ses_..."}})` — list sub-agent sessions spawned from a parent
- `memory({tool: "messages", args: {sessionId: "..."}})` — read a session's conversation
- `memory({tool: "messages", args: {sessionId: "...", role: "assistant"}})` — read only assistant messages
- `memory({tool: "messages", args: {sessionId: "...", showTools: true}})` — include tool-call output
- `memory({tool: "message", args: {messageId: "msg_..."}})` — read a single message by ID
- `memory({tool: "search", args: {query: "..."}})` — search across all conversations
- `memory({tool: "compactions", args: {sessionId: "..."}})` — view compaction checkpoints
- `memory({tool: "context"})` — check your current context window usage

### memory_compact()

Trigger compaction on the current session. This summarizes the conversation so far to free context space.

**When to use memory_compact:**
- When context is above 80% (check with `memory({tool: "context"})`)
- When you notice you're losing track of earlier conversation details
- At natural breakpoints in multi-step tasks (after completing a subtask, before starting a new one)
- When the system prompt shows a yellow/red/critical context warning
- Proactively, rather than waiting for automatic compaction at 92%

**When NOT to use memory_compact:**
- When context is below 50% (it wastes a compaction cycle)
- In the middle of a complex edit that you need immediate context for
- When the task is nearly complete (just finish the task instead)

Compaction preserves your most important context in a structured summary — you will continue the session with the summary as your starting point.

## Worktree Tool (via @alkimiadev/open-coordinator plugin)

You have access to the `worktree` tool for git worktree management and session coordination. Call with `{action, args}`:

### Coordinator Operations (available when session is not spawned by another session)

- `worktree({action: "list"})` — List git worktrees
- `worktree({action: "dashboard"})` — Worktree dashboard with session info
- `worktree({action: "spawn", args: {tasks: [...], prompt: "..."}})` — Spawn parallel worktrees + sessions
- `worktree({action: "sessions"})` — Query spawned session status
- `worktree({action: "message", args: {sessionID: "...", message: "..."}})` — Message a session
- `worktree({action: "abort", args: {sessionID: "..."}})` — Abort a session
- `worktree({action: "cleanup", args: {action: "remove", pathOrBranch: "..."}})` — Remove worktree
- `worktree({action: "help"})` — Show all available operations

### Implementation Operations (available when session is spawned by a coordinator)

- `worktree({action: "current"})` — Show your worktree mapping
- `worktree({action: "notify", args: {message: "...", level: "info|blocking"}})` — Report to coordinator
- `worktree({action: "status"})` — Show worktree git status

The plugin auto-injects `workdir` for bash commands when the session is mapped to a worktree.