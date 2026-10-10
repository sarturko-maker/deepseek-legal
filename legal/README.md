---
description: "Optional tracked-contract document tools for the DeepSeek Legal fork."
kind: "package-bundle"
---

# DeepSeek Legal redlining bundle

English | [中文](README.zh.md)

## Summary

This independent Harness bundle preserves a DOCX original, maintains one working copy per Session, and applies ADEU amendments as native Word tracked changes. Its optional native Desktop contribution opens Collabora from a DOCX preview through the authenticated Harness Gateway. Save and close the editor before requesting agent amendments. Automatic capture before chat, review-outcome continuity and managed export belong to later stages.

## Table of Contents

- [Build and check](#build-and-check)
- [Document tools](#document-tools)
- [Local editor adapter](#local-editor-adapter)
- [Packaging and upstream updates](#packaging-and-upstream-updates)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

<a id="build-and-check"></a>
## Build and check

Run these commands from the repository root after building the pinned Harness checkout. The development-only links resolve its existing packages; they are not production dependencies or modifications to the upstream workspace.

```powershell
corepack pnpm --dir legal install --frozen-lockfile
corepack pnpm --dir legal run build
corepack pnpm --dir legal run typecheck
corepack pnpm --dir legal test
```

The package has a separate lockfile. `pnpm pack` includes the built Host, Client factory, generated Typert contributions, declarations, bundle patches and README. Exact Harness peer requirements are retained. Generated `dist`, `lib`, dependencies, coverage and tarballs are ignored. Build after changing either face; restart development Desktop after rebuilding the optional Client artifact.

After that build, opt in to the keyless legal Session replay from the root. It pins the legal tool header and unopened-contract response. The standard Harness snapshot lane skips this separately built bundle; legal CI qualification belongs to the distribution stage.

```powershell
$env:LEGAL_SNAPSHOT = '1'
corepack pnpm run test:snapshot snapshots/session/headless.snapshot.ts -t 'replays legal-editor-contract' --maxWorkers=1
```

The real editor test needs a running Docker Linux engine and the pinned image pulled with `docker compose -f legal/editor/compose.yml pull`. Enable it explicitly; `LEGAL_DOCKER_BIN` selects the Docker executable when it is absent from `PATH`. The following path matches this PC's per-user Docker installation.

```powershell
$env:LEGAL_EDITOR_E2E = '1'
$env:LEGAL_DOCKER_BIN = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
corepack pnpm --dir legal run test:e2e
```

This test creates and removes its own Compose project, uses allocated loopback ports and sends only synthetic DOCX data. It checks two CODE edits and WOPI saves with an intervening ADEU amendment, original-byte preservation and selected document features. It is separate from the keyless unit suite and does not establish Desktop embedding or automatic chat handover.

<a id="document-tools"></a>
## Document tools

`contract_open` takes a DOCX path and creates one continuing document per Harness Session. Another source requires a new Session. Reopening the same source returns the continuing document instead of resetting amendments. `contract_read` returns the current content identity, generation, original identity and complete marked-up projection. `contract_redline` takes that current identity and ordered literal replacements, with optional Word comments. A target must be unique; a stale identity, ambiguous target or failed amendment rejects the batch. Agent amendments use the configured author, defaulting to `Commercial Agent`.

The storage directory must be explicitly configured as an absolute application-owned path. The bundle selects `dshHomePath('legal-documents')`. DOCX blobs are content-addressed and exclusively created; the original is never reserialized or overwritten. An atomically replaced head selects the committed working blob. Writer locks coordinate overlapping operations; cancellation is checked before head publication. Source files are read through Harness and never written by these tools. File contents are synced before head publication; filesystem and device behavior still govern power-loss recovery.

Configurable limits cover file bytes, expanded ZIP bytes, ZIP part count, complete response bytes and amendment count. Oversized projections fail instead of being truncated. The engine loads a fresh DOM for every batch, uses strict matching and `partial=false`, and reparses output before publication. It exposes no accept-all operation, safety override, regex edit or untracked URL retargeting.

<a id="local-editor-adapter"></a>
## Local editor adapter

The [optional patch](editor/cordis.patch.yml), applied after [the bundle patch](cordis.patch.yml), enables `config.editor` on the same Loader entry. The native Desktop profile supplies the Host web server, Workspace Files lookup, authenticated Gateway and existing Client slots. The default bundle remains headless-capable. One Loader package contributes one Client factory; the editor Host provider is a child of the document plugin.

Open a DOCX preview inside the selected Session's workspace and choose **Open for redlining**. The normal preview still displays the source; the separate **Contract editor** tab displays the managed working copy. The Gateway resolves the Session's workspace, rejects escaping paths and directory links, discovers the configured loopback editor and acquires its writer lifetime. The original source remains untouched. Reopening the same source in the same Session resumes the saved working copy.

Use **Save** for an explicit checkpoint or **Save and close** before an agent amendment. The tab's close control also requests a save and waits for acknowledgement and writer release. Failed or timed-out saves retain the pane and show feedback; a late acknowledgement cannot settle a newer save. Collabora supplies editing, comments and Review controls. Its own first-run welcome dialog can be dismissed with its close control. Use the existing sidebar fullscreen control for more room. Save before quitting Desktop; window shutdown and application reload do not perform this tab's explicit save procedure.

An editor lifetime holds the same cross-process writer lock used by agent amendments. Other writers reject until that lifetime closes. Each save validates the complete DOCX and projection, preserves the original, and atomically selects a new working generation; identical bytes retain their generation. The existing head format remains unchanged. Closing or unloading the adapter revokes access, cancels incomplete requests and awaits writer-lock release. Automatic save-and-handover before chat is not implemented.

Capabilities identify one document lifetime, expire after the configured duration and carry no workspace filesystem paths. Bearer tokens stay private to the authenticated editor consumer; do not log launch data or WOPI request URLs. Defaults allow four active documents, eight pending requests per document and one-hour capabilities. WOPI locks expire after 30 minutes unless refreshed. Mismatched locks return 409 with the current lock; expired, duplicate or incorrect access tokens reject. Uploads use the configured document byte limit. The advertised reviewer name defaults to `Human Reviewer`, distinct from the agent name, and the parent origin is restricted to native Desktop's `dsh-app://app`.

The [container configuration](editor/compose.yml) pins CODE, publishes only loopback port 9980 and permits callbacks to `host.docker.internal` on Host port 19387. Its framing policy permits exactly `dsh-app://app`; Electron's sandbox, context isolation and web security stay enabled. `LEGAL_EDITOR_PORT` and `LEGAL_HOST_PORT` override deployment ports; update the optional patch's `editorOrigin` and `callbackOrigin` to match. Docker Desktop's Linux engine and WSL2 are separate prerequisites; Harness stays native Windows. Start the dedicated instance with `docker compose -p deepseek-legal-editor -f legal/editor/compose.yml up -d` before opening the editor.

<a id="packaging-and-upstream-updates"></a>
## Packaging and upstream updates

The legal implementation lives under `legal/` and imports Harness interfaces through exact peer versions. Three small upstream extensions support it: explicit package directories in Typert generation, an explicit manifest in the shared Client build preset, and opt-in deferred sidebar close. Ordinary callers retain their existing behavior. Agent-loop, chat and Desktop launcher source are unchanged. Do not publish the bundle into DeepSeek's npm namespace.

Harness upgrades are deliberate: select an upstream release, update the development baseline and exact DSH peers together, reconcile the three extensions, build Harness, then run this bundle's build, checks, recorded-session replay, real CODE round trips and native Desktop acceptance. Never automatically upgrade an editor or document engine during ordinary redlining. Keep `origin` pointed at the user's repository and official Harness as a separate upstream source.

<a id="model-experience"></a>
## Model Experience

The model sees three contract tools and receives full current text, revisions, comments and byte identities through normal logged tool results. Amendment calls return the committed current projection. Selecting a contract can send its content to the selected model service; local storage does not make chat offline. DOCX blobs are local application data. Editor launch data and access tokens stay outside the model transcript and persisted tab parameters; iframe messages require the exact source window and configured origin.

<a id="kv-cache-effect"></a>
### KV Cache effect

Each contract result adds the complete current projection to logged model context. Subsequent reads and amendments can increase prompt size; results are bounded and never silently truncated.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- Automatic save before chat, review-outcome continuity, managed export, the Commercial Agent preset and playbook are later stages in [the implementation plan](../IMPLEMENTATION_PLAN.md).
- Storage is session-owned; coordinated editing from multiple Sessions is unavailable.
- Expired editor access has no unsaved-draft recovery in this stage. Save and close before the configured lifetime ends, default one hour; reload Desktop to reopen the last saved copy after expiry.
- ADEU's projection does not cover every Word construct. The synthetic CODE round trip checks existing and agent comments, tracked changes, bold text, a header and exact embedded PNG bytes; it does not establish fidelity for arbitrary contracts or accept/reject behavior.
- The native development profile's editor open/type/save/close/reopen journey uses synthetic documents. Signed installation and the complete automatic human–agent journey remain unverified. Restored tab layout does not retain launch tokens or document navigation; open the same DOCX preview again to resume the saved copy.
- No separate runtime invariant companion exists because one document store owns the head and its content-addressed files. Integrity is checked on reads.

<a id="dev-note"></a>
## Dev Note

The pinned editor is Collabora CODE 26.04.1.4. [The implementation plan](../IMPLEMENTATION_PLAN.md) records native evidence and the user's acceptance checkpoints. Docker and the editor image are separate setup prerequisites; this bundle is not a Windows installer.
