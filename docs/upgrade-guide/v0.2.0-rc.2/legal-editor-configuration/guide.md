---
kind: upgrade-guide
description: "The DeepSeek Legal editor patch configures the document plugin and requires explicit local editor addresses."
---

# Update the optional DeepSeek Legal editor configuration

English | [中文](guide.zh.md)

## Change

The fork's optional editor patch enables `config.editor` on the existing `deepseek-legal-redlining` entry. It replaces the separate `deepseek-legal-editor` Loader entry so the package contributes one Client factory. Custom editor configurations now require `editorOrigin` and `callbackOrigin` alongside `parentOrigin`. Document storage and the default document-tool patch retain their existing behavior.

## Migration

1. Rebuild the independent [legal bundle](../../../../legal/README.md#build-and-check).
2. Apply [the document-tool patch](../../../../legal/cordis.patch.yml), followed by [the current editor patch](../../../../legal/editor/cordis.patch.yml). Remove a manually added `deepseek-legal-editor` Loader entry. Put its editor settings under `config.editor` on `deepseek-legal-redlining`.
3. Set `parentOrigin: dsh-app://app`, `editorOrigin: http://127.0.0.1:9980` and `callbackOrigin: http://host.docker.internal:19387`. Match custom ports to the [Compose configuration](../../../../legal/editor/compose.yml) and Host listener.
4. Restart the dedicated Compose instance and native Desktop. Open a DOCX preview and choose **Open for redlining**. Confirm that typing survives **Save and close**, then reopening the same document in the same Session.
