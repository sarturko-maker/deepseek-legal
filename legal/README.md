---
description: "Optional tracked-contract document tools for the DeepSeek Legal fork."
kind: "package-bundle"
---

# DeepSeek Legal redlining bundle

## Summary

This independent Harness bundle opens a DOCX into application-owned storage, preserves its original bytes, reads ADEU's marked-up text and comment appendix, and applies complete batches of native Word tracked amendments. It uses the existing Harness tool pipeline and composed filesystem for source reads. Interactive editing, accept/reject, export and automatic editor handover remain unimplemented; the existing Desktop DOCX pane is still a PDF preview.

## Table of Contents

- [Build and check](#build-and-check)
- [Document tools](#document-tools)
- [Packaging and upstream updates](#packaging-and-upstream-updates)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Build and check

Run these commands from the repository root after building the pinned Harness checkout. The development-only links resolve its existing packages; they are not production dependencies or modifications to the upstream workspace.

```powershell
corepack pnpm --dir legal install --frozen-lockfile
corepack pnpm --dir legal run build
corepack pnpm --dir legal test
```

The package has a separate lockfile. `pnpm pack` creates a tarball containing the built ESM plugin, bundle patch and README; installable artifacts retain exact Harness peer requirements. Generated `dist`, dependencies, coverage and tarballs are ignored. The existing built `dsh --profile headless --patch legal/cordis.patch.yml --dump-config` path accepted the overlay in an isolated test home; this is composition evidence, not live model or Desktop installation evidence.

## Document tools

`contract_open` takes a DOCX path and creates one continuing document per Harness Session. Another source requires a new Session. Reopening the same source returns the continuing document instead of resetting amendments. `contract_read` returns the current content identity, generation, original identity and complete marked-up projection. `contract_redline` takes that current identity and ordered literal replacements, with optional Word comments. A target must be unique; a stale identity, ambiguous target or failed amendment rejects the batch. Agent amendments use the configured author, defaulting to `Commercial Agent`.

The storage directory must be explicitly configured as an absolute application-owned path. The bundle selects `dshHomePath('legal-documents')`. DOCX blobs are content-addressed and exclusively created; the original is never reserialized or overwritten. An atomically replaced head selects the committed working blob. Writer locks coordinate overlapping operations; cancellation is checked before head publication. Source files are read through Harness and never written by these tools. File contents are synced before head publication; filesystem and device behavior still govern power-loss recovery.

Configurable limits cover file bytes, expanded ZIP bytes, ZIP part count, complete response bytes and amendment count. Oversized projections fail instead of being truncated. The engine loads a fresh DOM for every batch, uses strict matching and `partial=false`, and reparses output before publication. It exposes no accept-all operation, safety override, regex edit or untracked URL retargeting.

## Packaging and upstream updates

The GitHub repository is a thin development fork: upstream application code stays unchanged, and this bundle lives under `legal/`. The runtime package imports supported Harness interfaces through exact peer versions. It can subsequently move to an independent repository without changing the agent loop or replacing chat. Do not publish it into DeepSeek's npm namespace.

Harness upgrades are deliberate: choose an upstream release, update the development baseline and exact DSH peers together, build Harness, then run this bundle's build and checks. After the editor is implemented, real ADEU–Collabora round trips and native Desktop editing acceptance must also pass. Never automatically upgrade an editor or document engine during ordinary redlining. Keep the fork's `origin` pointed at the user-designated GitHub repository and treat official Harness as a separate upstream source.

## Model Experience

The model sees three contract tools and receives full current text, revisions, comments and byte identities through normal logged tool results. Amendment calls also return the committed current projection. Selecting a contract can send its content to the selected model service; local storage does not make chat offline. Original and working DOCX blobs are local application data, not session-log payloads.

### KV Cache effect

Each contract result adds the complete current projection to logged model context. Subsequent reads and amendments can increase prompt size; results are bounded and never silently truncated.

## Known Limitations and Deferred Work

- This stage has no interactive editor, export operation, review-outcome ledger, Commercial Agent preset, playbook, automatic turn admission or recorded-session scenario. Those are later stages in [the implementation plan](../IMPLEMENTATION_PLAN.md).
- Storage is session-owned; coordinated editing from multiple Sessions is unavailable.
- ADEU's projection does not cover every Word construct. The focused fixture checks a human comment, bold text, a header and opaque image bytes; it does not establish fidelity for arbitrary contracts or real Collabora saves.
- Desktop installation and live-model use of these new tools are unverified. Source composition and the built entry are tested separately.
- No separate runtime invariant companion exists because one document store owns the head and its content-addressed files. Integrity is checked on reads.

## Dev Note

The pinned editor prerequisite remains Collabora CODE 26.04.1.4 in a dedicated local container. Docker was not found in the usual Windows install locations, and this PC's WSL launcher did not report a modern version. Harness stays native Windows; the editor's container backend is separate.
