---
description: "Optional tracked-contract document tools for the DeepSeek Legal fork."
kind: "package-bundle"
---

# DeepSeek Legal redlining bundle

English | [中文](README.zh.md)

## Summary

This independent Harness bundle opens a DOCX into application-owned storage, preserves its original bytes, reads ADEU's marked-up text and comment appendix, and applies complete batches of native Word tracked amendments. It uses the existing Harness tool pipeline and composed filesystem for source reads. Interactive editing, accept/reject, export and automatic editor handover remain unimplemented; the existing Desktop DOCX pane is still a PDF preview.

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
corepack pnpm --dir legal test
```

The package has a separate lockfile. `pnpm pack` creates a tarball containing the built ESM plugin, bundle patch and README; installable artifacts retain exact Harness peer requirements. Generated `dist`, dependencies, coverage and tarballs are ignored. The existing built `dsh --profile headless --patch legal/cordis.patch.yml --dump-config` path accepted the overlay in an isolated test home; this is composition evidence, not live model or Desktop installation evidence.

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

The optional `./editor` entry provides WOPI metadata, complete DOCX reads, locked saves and lock management through Harness's existing Host web server. Its [optional patch](editor/cordis.patch.yml) requires the document-tool bundle and a Host web server. The default bundle patch activates only document tools. No client pane or authenticated launch operation issues editor capabilities yet; this adapter is exercised by focused integration tests.

An editor lifetime holds the same cross-process writer lock used by agent amendments. Other writers reject until that lifetime closes. Each save validates the complete DOCX and projection, preserves the original, and atomically selects a new working generation; identical bytes retain their generation. The existing head format remains unchanged. Closing or unloading the adapter revokes access, cancels incomplete requests and awaits writer-lock release. Automatic save-and-handover before chat is not implemented.

Capabilities identify one document lifetime, expire after the configured duration and carry no workspace filesystem paths. Bearer tokens stay private to the authenticated editor consumer; do not log launch data or WOPI request URLs. Defaults allow four active documents, eight pending requests per document and one-hour capabilities. WOPI locks expire after 30 minutes unless refreshed. Mismatched locks return 409 with the current lock; expired, duplicate or incorrect access tokens reject. Uploads use the configured document byte limit. The advertised reviewer name defaults to `Human Reviewer`, distinct from the agent name, and the parent origin is restricted to native Desktop's `dsh-app://app`.

The [container configuration](editor/compose.yml) pins the discovered CODE image, publishes only loopback port 9980 and permits callbacks to `host.docker.internal` on Host port 19387. `LEGAL_EDITOR_PORT` and `LEGAL_HOST_PORT` can override those deployment ports. Docker Desktop's Linux-container engine and WSL2 are prerequisites; Harness stays native Windows. Real CODE startup, Windows callbacks and editor saves pass the synthetic round-trip test; Desktop embedding remains unverified.

<a id="packaging-and-upstream-updates"></a>
## Packaging and upstream updates

The GitHub repository is a thin development fork: upstream application code stays unchanged, and this bundle lives under `legal/`. The runtime package imports supported Harness interfaces through exact peer versions. It can subsequently move to an independent repository without changing the agent loop or replacing chat. Do not publish it into DeepSeek's npm namespace.

Harness upgrades are deliberate: choose an upstream release, update the development baseline and exact DSH peers together, build Harness, then run this bundle's build and checks. After the editor is implemented, real ADEU–Collabora round trips and native Desktop editing acceptance must also pass. Never automatically upgrade an editor or document engine during ordinary redlining. Keep the fork's `origin` pointed at the user-designated GitHub repository and treat official Harness as a separate upstream source.

<a id="model-experience"></a>
## Model Experience

The model sees three contract tools and receives full current text, revisions, comments and byte identities through normal logged tool results. Amendment calls also return the committed current projection. Selecting a contract can send its content to the selected model service; local storage does not make chat offline. Original and working DOCX blobs are local application data, not session-log payloads.

<a id="kv-cache-effect"></a>
### KV Cache effect

Each contract result adds the complete current projection to logged model context. Subsequent reads and amendments can increase prompt size; results are bounded and never silently truncated.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- This stage has no interactive editor, export operation, review-outcome ledger, Commercial Agent preset, playbook, automatic turn admission or recorded-session scenario. Those are later stages in [the implementation plan](../IMPLEMENTATION_PLAN.md).
- Storage is session-owned; coordinated editing from multiple Sessions is unavailable.
- ADEU's projection does not cover every Word construct. The synthetic CODE round trip checks existing and agent comments, tracked changes, bold text, a header and exact embedded PNG bytes; it does not establish fidelity for arbitrary contracts or accept/reject behavior.
- Desktop installation and live-model use of these new tools are unverified. The source composition, both built entries and the optional editor's real Host HTTP routes are tested separately.
- No separate runtime invariant companion exists because one document store owns the head and its content-addressed files. Integrity is checked on reads.

<a id="dev-note"></a>
## Dev Note

The real editor test verifies Collabora CODE 26.04.1.4. The Windows engine reports Docker 29.8.2. After a containerd startup crash, the user freed disk space and a normal Docker restart restored the engine; the cause of the crash is unconfirmed. The synthetic round trip passes; complete native Desktop acceptance remains pending in [the implementation plan](../IMPLEMENTATION_PLAN.md).
