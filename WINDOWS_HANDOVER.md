# DeepSeek Legal — continue on the personal Windows PC

Prepared 6 October 2026. This is a continuation guide for the user and the next Codex session. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) is the single current plan and records architecture, acceptance requirements and progress.

Stage 2A was implemented on 10 October after the user authorized execution through that checkpoint. Native open/type/save/close/reopen is verified; the user will now test on this PC. Read [the checkpoint and testing steps](IMPLEMENTATION_PLAN.md#stage-2a-checkpoint), then stop. Begin stage 3A only after user feedback and a new execution instruction. Stop again after 3A, 3B and each subsequent increment for the user's test.

Phase 1 native launch, repository selection, DOCX preview and live-model chat passed on `feat/windows-desktop-baseline`. The independent [legal bundle](legal/README.md) implements the tracked document engine, guarded storage, authenticated editor launch and native pane; real ADEU–Collabora round trips pass. The published branch is [feat/legal-redlining](https://github.com/sarturko-maker/deepseek-legal/tree/feat/legal-redlining), last verified on 9 October before this increment. Three narrow Harness extensions support the external bundle; the agent loop, Desktop launcher and root lockfile remain unchanged. Read [the remaining stages](IMPLEMENTATION_PLAN.md#next-stages) before the next execution instruction.

**Start directly in native Windows Harness Desktop.** The user has moved this project to their personal Windows PC. The earlier Web-first route and proposed Linux Desktop adaptation are superseded. Use the supported Windows application and its normal upstream development commands. Do not implement Linux targets, patch the Desktop launcher for Linux, set up Wine/Xvfb, or require a Web prototype before Desktop work.

## What this checkout contains

- Harness source pinned to upstream tag `dsh-v0.2.0-rc.2`, with upstream Git history and licence notices preserved, plus the three extensions documented in the stage-2A checkpoint.
- The discovery findings, proposed integration and phased plan, revised for Windows development and testing.
- This guide and a pointer in root `AGENTS.md`, so the next agent can recover the project without the previous chat. The root agent-document word budget is increased only to accommodate that pointer with the required headroom.

The optional legal bundle implements open/read/redline tools backed by ADEU 3.0.6 and an immutable original with guarded working generations. Its WOPI Host adapter reads and saves complete DOCX bytes under exclusive editor ownership. The native development profile loads the editor contribution; synthetic typing survives save/close/reopen. The legal suite passes 44 tests and the affected Harness suites pass 134. A keyless recorded Session pins the legal tool header and unopened-contract response. The Commercial Agent preset, playbook, automatic human–agent handover and full acceptance journey remain pending. The upstream root README remains unchanged.

The user authorized the handoff push to `https://github.com/sarturko-maker/deepseek-legal`. It was already public; its visibility was not changed. Product implementation was awaiting approval before the move. A new instruction such as “continue with implementation” authorizes the proposed incremental work; do not ask for that same permission again. Preserve existing permission controls and local changes.

## Open the project on Windows

Clone using native Windows Git in a Windows directory, then open the resulting `deepseek-legal` folder as the Codex project:

```powershell
git clone --branch feat/legal-redlining https://github.com/sarturko-maker/deepseek-legal.git
cd deepseek-legal
```

For an existing checkout, inspect its branch and local modifications before pulling; do not reset user work. Current integration work is on `feat/legal-redlining`; the fork's base branch is `main`, and official Harness uses `master`. `origin` must remain the user-designated repository. Add the official Harness URL as a separate `upstream` remote if useful; do not push to it or silently update the pinned baseline.

Suggested first instruction to the new Codex session:

> Read AGENTS.md, WINDOWS_HANDOVER.md and IMPLEMENTATION_PLAN.md. Review the user's stage-2A feedback before proposing the exact stage-3A file plan. Implement automatic handover on this personal Windows PC using the existing native editor and branch. Keep the single plan current, test the changed behavior, review the diff and stop after stage 3A for the user's test. Do not start stage 3B or restart the completed baseline.

## First actions for the continuing agent

1. Read the current plan and applicable upstream instructions. Discovery is complete; inspect the cited code as needed instead of restarting broad discovery or assuming the old temporary Linux checkouts exist.
2. Inspect native Windows version/architecture, Git, Node, pnpm and the available model connection. The pinned Desktop build target is `win-x64`; do not assume an untested native Windows ARM64 target. Keep the checkout, toolchain and installed dependencies in the same native Windows environment.
3. Reuse the recorded Desktop baseline and real-editor evidence. Rerun an affected check when a dependency changes or an observed failure invalidates it; do not repeat broad baseline discovery. Preview is not the interactive redlining editor.
4. Continue on `feat/legal-redlining`, retain the upstream lockfile and add the smallest integration through existing Client/Host plugin mechanisms. Propose the exact files before each implementation increment, run relevant checks and inspect the diff before continuing.
5. Complete the full Desktop journey and independent document-safety review. The user's personal test and fixes precede acceptance. Clean-checkout reproduction and any later corporate sandbox instructions follow.

Use the strongest suitable available model for architecture and verification; verify actual configuration. Bounded lower-cost delegation is useful where supported and authorized. The previous discovery used three development agents, not three legal product agents. This product has one Commercial Agent.

## Normal Windows baseline setup

The source references are [upstream setup](docs/development.md#setup-tutorial), [Desktop development](apps/desktop/README.md#develop), [root scripts](package.json), and [runtime lock](scripts/primary-runtime/lock.json). The [Windows baseline evidence](IMPLEMENTATION_PLAN.md#windows-baseline) records this checkout's executed setup commands, Electron download retry and successful native launch.

Use a supported native Node installation: the root engine permits `^22.19.0 || >=24.0.0`, and the checked-in runtime lock pins Node `24.21.0`. The repository pins pnpm `11.7.0`. This PC has supported Node `24.19.0`; `corepack enable` encountered a Windows access denial, while direct Corepack invocation successfully resolved `11.7.0`. The setup commands executed from the repository root are:

```powershell
node --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm run typecheck
corepack pnpm run dev:desktop
```

Use normal Windows setup for a missing prerequisite. Follow the actual upstream diagnostic if a native dependency needs build tools; do not add platform workarounds speculatively. The upstream development command builds the application and prepares its locked runtime. Initial setup may download dependencies. After a successful build, `pnpm run start:desktop` launches without rebuilding; rebuild after source changes.

The normal development launcher isolates application state and Electron data under the ignored `apps/desktop/.desktop-build/development/` tree. Use that default, not an existing personal Harness profile. No signed installer, signing certificate, updater deployment or Linux Harness setup is required for this experiment. Configure the existing model connection locally and keep credentials out of Git and tool output.

This checkout now has an ignored credential file at `apps/desktop/.desktop-build/development/home/.env`. The user populated the full DeepSeek key after `DEEPSEEK_API_KEY=` on line 2; Desktop was restarted and completed a live chat. For future key changes, edit that value, save the file and restart Desktop. This is the development Harness home supplied by the normal launcher; its existing credential loader reads the file. The [baseline evidence](IMPLEMENTATION_PLAN.md#windows-baseline) records Git-ignore verification, model selection, the existing session-log setting, completed checks and launch prerequisites.

## Integration work that still needs doing

The [staged implementation](IMPLEMENTATION_PLAN.md#staged-implementation) defines remaining handover and acceptance work. Preserve the independent bundle layout under `legal/` and qualify its three Harness extensions when updating the pinned baseline. Use the embedded Collabora CODE pane and keep future legal instructions in a reusable skill and editable Markdown playbook.

| Dependency or reference | Pinned discovery baseline | Windows action |
|---|---|---|
| Harness | Source included at `dsh-v0.2.0-rc.2` | Establish the normal native Desktop baseline. |
| ADEU | `@adeu/core` 3.0.6; source commit `965736d2d8ea32f42ed9a2a0a01b3c5a538f7f75` | Installed and locked in the separate legal bundle; real engine round-trip tests pass. |
| Collabora CODE | 26.04.1.4; image `collabora/code@sha256:75859dc9f9084d1877ce36cf96ec86600f495bade33289c9cbc27e0a0ee23b81` | Prepare a dedicated local instance and verify the actual running version and Windows host callbacks. |
| LQ fork | `sarturko-maker/lq-ai-fork` at `82904157a155ad2926e4ba64447087f7ef1cdb45` | Reference its iframe/WOPI/snapshot patterns; do not import the whole application or its local data. |

Collabora uses the dedicated [container configuration](legal/editor/compose.yml). The 9 October real editor test verifies CODE 26.04.1.4, Windows host callbacks and two edit/save rounds with an intervening ADEU amendment. Docker reports a running Linux engine at 29.8.2; Windows reports the hypervisor present. After a containerd metadata `SIGBUS`, the user freed disk space; a host CIM check then showed approximately 13.6 GB available. A normal Docker restart restored the engine, and the failed test's isolated Compose project was removed. The crash's cause is unconfirmed. No Docker purge, factory reset, machine-wide feature change or reboot was performed. WSL for the container backend does not move Harness into WSL. The old laptop's LQ container is not a dependency. Preserve branding/notices and check applicable terms before redistribution; do not bundle an editor image in Git.

Run the opt-in editor test using [the bundle's instructions](legal/README.md#build-and-check). It checks a synthetic document, separately from native UI evidence. The [stage-2A checkpoint](IMPLEMENTATION_PLAN.md#stage-2a-checkpoint) gives the user's current testing steps. Subsequent items cover automatic capture before chat, review continuity, the Commercial Agent and full native acceptance. [Later packaging](IMPLEMENTATION_PLAN.md#later-windows-packaging) plans startup management and a Windows installer after the MVP; neither is implemented. Use the plan's [execution checks](IMPLEMENTATION_PLAN.md#execution-checks) to select evidence for each increment.

Verify the editor's embedding origin, postMessage checks, HTTP/WebSocket access and WOPI callbacks against actual `dsh-app://app` Desktop behaviour. Never disable Electron sandboxing, context isolation or web security to make the iframe work. Normal Windows support should remain untouched unless an observed upstream defect requires a separately justified fix.

The highest-priority proofs are automatic capture of unsaved editor text/comments on the next chat instruction, reliable review-outcome continuity, protection against late/stale writes, and preservation through real ADEU–Collabora round trips. The full [verification matrix](IMPLEMENTATION_PLAN.md) defines those checks. A skill alone, disk watcher, PDF preview or manual save/refresh cannot satisfy them.

Keep the original intact and one continuing working document. Test at least three agent turns, with a substantive human edit, acceptance, rejection and comment before the dependent indemnity instruction. Export the latest state with outstanding tracked changes and reopen it. Do not claim the mandatory test passed until exercised in Desktop; identify steps needing the user's participation.

## Keep the handoff reproducible

Update the plan in place with decisions, actual commands/results and remaining work. Separate deterministic tests, real-engine/editor tests, live-model tests and manual GUI evidence. The inherited documentation gates need the supported Node/pnpm setup and installed dependencies; they were not completed on the old laptop during this handoff. Run relevant repository checks on Windows before feature work is committed. Documentation paths, source pins, whitespace and the absence of product-code changes are checked separately for the handoff.

Use synthetic contracts. Keep real contracts, credentials, local sessions, runtime data and generated outputs out of commits; add scoped ignores when introducing test/output directories. Preserve ordinary Harness sessions and permissions. Do not import memory, matter management, retrieval, email, extra legal agents, authentication or telemetry from LQ. Identify the model service receiving document content; a local Desktop shell does not make the agent offline.

The next test machine is personal Windows. Corporate Windows Sandbox, enterprise deployment and macOS qualification are later or untested environments, not prerequisites for the first complete Windows loop. Record their status accurately; do not carry forward the old requirement to validate the Web UI on the Linux laptop first.
