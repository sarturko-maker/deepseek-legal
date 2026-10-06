# DeepSeek Legal — continue on the personal Windows PC

Prepared 6 October 2026. This is a continuation guide for the user and the next Codex session. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) is the single current plan and records architecture, acceptance requirements and progress.

**Start directly in native Windows Harness Desktop.** The user has moved this project to their personal Windows PC. The earlier Web-first route and proposed Linux Desktop adaptation are superseded. Use the supported Windows application and its normal upstream development commands. Do not implement Linux targets, patch the Desktop launcher for Linux, set up Wine/Xvfb, or require a Web prototype before Desktop work.

## What this checkout contains

- Unmodified Harness application source at upstream tag `dsh-v0.2.0-rc.2`, commit `639ed015397290b3745d163aafe02ffee4aa3f84`, with upstream Git history and licence notices preserved.
- The discovery findings, proposed integration and phased plan, revised for Windows development and testing.
- This guide and a pointer in root `AGENTS.md`, so the next agent can recover the project without the previous chat. The root agent-document word budget is increased only to accommodate that pointer with the required headroom.

No Commercial Agent integration, editor bridge, custom playbook or product tests have been implemented. No Windows launch or acceptance test has passed in this work. Windows Desktop is supported upstream; record actual results on this PC before claiming a baseline pass. The upstream root README remains unchanged.

The user authorized the handoff push to `https://github.com/sarturko-maker/deepseek-legal`. It was already public; its visibility was not changed. Product implementation was awaiting approval before the move. A new instruction such as “continue with implementation” authorizes the proposed incremental work; do not ask for that same permission again. Preserve existing permission controls and local changes.

## Open the project on Windows

Clone using native Windows Git in a Windows directory, then open the resulting `deepseek-legal` folder as the Codex project:

```powershell
git clone --branch main https://github.com/sarturko-maker/deepseek-legal.git
cd deepseek-legal
```

For an existing checkout, inspect its branch and local modifications before pulling; do not reset user work. This fork uses `main`; official Harness uses `master`. `origin` must remain the user-designated repository. Add the official Harness URL as a separate `upstream` remote if useful; do not push to it or silently update the pinned baseline.

Suggested first instruction to the new Codex session:

> Read AGENTS.md, WINDOWS_HANDOVER.md and IMPLEMENTATION_PLAN.md. Continue with implementation on this personal Windows PC. Start by verifying unmodified Harness Desktop through its normal Windows launch path, then implement and test the plan incrementally. Do not add Linux support or a required Web-first phase. Keep the implementation plan current and prove the complete human–agent editing loop in Desktop.

## First actions for the continuing agent

1. Read the current plan and applicable upstream instructions. Discovery is complete; inspect the cited code as needed instead of restarting broad discovery or assuming the old temporary Linux checkouts exist.
2. Inspect native Windows version/architecture, Git, Node, pnpm and the available model connection. The pinned Desktop build target is `win-x64`; do not assume an untested native Windows ARM64 target. Keep the checkout, toolchain and installed dependencies in the same native Windows environment.
3. Establish the unchanged Desktop baseline before modifying product source. Record actual GUI launch, workspace selection, current DOCX preview, model connection and any pre-existing failures in the plan. Preview is not the interactive redlining editor.
4. After implementation is authorized, create a feature branch, retain the upstream lockfile and add the smallest integration through existing client/host plugin mechanisms. Run relevant checks and inspect each increment before continuing.
5. Complete the full Desktop journey and independent document-safety review. The user's personal test and fixes precede acceptance. Clean-checkout reproduction and any later corporate sandbox instructions follow.

Use the strongest suitable available model for architecture and verification; verify actual configuration. Bounded lower-cost delegation is useful where supported and authorized. The previous discovery used three development agents, not three legal product agents. This product has one Commercial Agent.

## Normal Windows baseline setup

The source references are [upstream setup](docs/development.md#setup-tutorial), [Desktop development](apps/desktop/README.md#develop), [root scripts](package.json), and [runtime lock](scripts/primary-runtime/lock.json). These commands are source-verified instructions for the Windows session; they have not been executed on Windows during this handoff. The continuing agent owns that verification.

Use a supported native Node installation: the root engine permits `^22.19.0 || >=24.0.0`, and the checked-in runtime lock pins Node `24.21.0`. The repository pins pnpm `11.7.0`. With Node and Corepack available, use the standard sequence from the repository root:

```powershell
node --version
corepack enable
pnpm --version
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run dev:desktop
```

Use normal Windows setup for a missing prerequisite. Follow the actual upstream diagnostic if a native dependency needs build tools; do not add platform workarounds speculatively. The upstream development command builds the application and prepares its locked runtime. Initial setup may download dependencies. After a successful build, `pnpm run start:desktop` launches without rebuilding; rebuild after source changes.

The normal development launcher isolates application state and Electron data under the ignored `apps/desktop/.desktop-build/development/` tree. Use that default, not an existing personal Harness profile. No signed installer, signing certificate, updater deployment or Linux Harness setup is required for this experiment. Configure the existing model connection locally and keep credentials out of Git and tool output.

## Integration work that still needs doing

Windows removes the need for a Linux Desktop adaptation. It does not supply the interactive contract integration. Use the plan's shared Harness plugins, an embedded Collabora CODE editor and the ADEU Node SDK; keep legal instructions in a reusable skill and editable Markdown playbook.

| Dependency or reference | Pinned discovery baseline | Windows action |
|---|---|---|
| Harness | Source included at `639ed015397290b3745d163aafe02ffee4aa3f84` | Establish the normal native Desktop baseline. |
| ADEU | `@adeu/core` 3.0.6; source commit `965736d2d8ea32f42ed9a2a0a01b3c5a538f7f75` | Add the pinned SDK during implementation; inspect the source/tests as needed. Not installed in this handoff. |
| Collabora CODE | 26.04.1.4; image `collabora/code@sha256:75859dc9f9084d1877ce36cf96ec86600f495bade33289c9cbc27e0a0ee23b81` | Prepare a dedicated local instance and verify the actual running version and Windows host callbacks. |
| LQ fork | `sarturko-maker/lq-ai-fork` at `82904157a155ad2926e4ba64447087f7ef1cdb45` | Reference its iframe/WOPI/snapshot patterns; do not import the whole application or its local data. |

Collabora can use Docker Desktop's Linux-container backend on Windows, subject to its normal prerequisites. WSL used by that backend does not mean running Harness in WSL. No container launcher or configuration is supplied yet; implement only what the editor integration needs. The old laptop's LQ container is not a dependency. Preserve branding/notices and check applicable terms before redistribution; do not bundle an editor image in Git.

Verify the editor's embedding origin, postMessage checks, HTTP/WebSocket access and WOPI callbacks against actual `dsh-app://app` Desktop behaviour. Never disable Electron sandboxing, context isolation or web security to make the iframe work. Normal Windows support should remain untouched unless an observed upstream defect requires a separately justified fix.

The highest-priority proofs are automatic capture of unsaved editor text/comments on the next chat instruction, reliable review-outcome continuity, protection against late/stale writes, and preservation through real ADEU–Collabora round trips. The full [verification matrix](IMPLEMENTATION_PLAN.md) defines those checks. A skill alone, disk watcher, PDF preview or manual save/refresh cannot satisfy them.

Keep the original intact and one continuing working document. Test at least three agent turns, with a substantive human edit, acceptance, rejection and comment before the dependent indemnity instruction. Export the latest state with outstanding tracked changes and reopen it. Do not claim the mandatory test passed until exercised in Desktop; identify steps needing the user's participation.

## Keep the handoff reproducible

Update the plan in place with decisions, actual commands/results and remaining work. Separate deterministic tests, real-engine/editor tests, live-model tests and manual GUI evidence. The inherited documentation gates need the supported Node/pnpm setup and installed dependencies; they were not completed on the old laptop during this handoff. Run relevant repository checks on Windows before feature work is committed. Documentation paths, source pins, whitespace and the absence of product-code changes are checked separately for the handoff.

Use synthetic contracts. Keep real contracts, credentials, local sessions, runtime data and generated outputs out of commits; add scoped ignores when introducing test/output directories. Preserve ordinary Harness sessions and permissions. Do not import memory, matter management, retrieval, email, extra legal agents, authentication or telemetry from LQ. Identify the model service receiving document content; a local Desktop shell does not make the agent offline.

The next test machine is personal Windows. Corporate Windows Sandbox, enterprise deployment and macOS qualification are later or untested environments, not prerequisites for the first complete Windows loop. Record their status accurately; do not carry forward the old requirement to validate the Web UI on the Linux laptop first.
