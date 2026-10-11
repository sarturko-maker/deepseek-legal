---
kind: upgrade-guide
description: "The DeepSeek Legal editor patch configures the document plugin and requires explicit local editor addresses."
---

# Update the optional DeepSeek Legal editor configuration

English | [中文](guide.zh.md)

## Change

Revision display and human change recording now start enabled. Set `showTrackedChanges` or `recordChanges` to `false` under `config.editor` to change these initial settings; the editor's menus remain available during review.

The fork's optional editor patch enables `config.editor` on the existing `deepseek-legal-redlining` entry. It replaces the separate `deepseek-legal-editor` Loader entry so the package contributes one Client factory. Custom editor configurations now require `editorOrigin` and `callbackOrigin` alongside `parentOrigin`. Document storage and the default document-tool patch retain their existing behavior.

## Migration

Editor presentation defaults to the classic toolbar with the ruler and properties sidebar hidden. Optional `config.editor` fields `uiMode`, `showRuler`, `showPropertiesSidebar` and `paneWidthRatio` override these choices. The pane prefers `2/3` of the frame while preserving previous user drags and minimum chat space. CODE's dedicated Compose instance enables home mode (ten documents/twenty connections) and disables update popups; `LEGAL_EDITOR_HOME_MODE` and `LEGAL_EDITOR_UPDATE_POPUP` provide deployment overrides. Document data needs no migration.

1. Rebuild the independent [legal bundle](../../../../legal/README.md#build-and-check).
2. Apply [the document-tool patch](../../../../legal/cordis.patch.yml), followed by [the current editor patch](../../../../legal/editor/cordis.patch.yml). Remove a manually added `deepseek-legal-editor` Loader entry. Put its editor settings under `config.editor` on `deepseek-legal-redlining`.
3. Set `parentOrigin: dsh-app://app`, `editorOrigin: http://127.0.0.1:9980` and `callbackOrigin: http://host.docker.internal:19387`. Match custom ports to the [Compose configuration](../../../../legal/editor/compose.yml) and Host listener.
4. Restart the dedicated Compose instance and native Desktop. Open a DOCX preview and choose **Open for redlining**. Confirm that typing survives **Save and close**, then reopening the same document in the same Session.
