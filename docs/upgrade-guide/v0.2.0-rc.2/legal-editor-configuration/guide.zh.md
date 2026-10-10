---
kind: upgrade-guide
description: "DeepSeek Legal 编辑器补丁改为配置文档插件，并要求显式指定本地编辑器地址。"
---

# 更新可选 DeepSeek Legal 编辑器配置

[English](guide.md) | 中文

## 变更

fork 的可选编辑器补丁在现有 `deepseek-legal-redlining` 条目中启用 `config.editor`。它替代独立的 `deepseek-legal-editor` Loader 条目，使本包只贡献一个 Client factory。自定义编辑器配置现在除 `parentOrigin` 外，还需要 `editorOrigin` 和 `callbackOrigin`。文档存储和默认文档工具补丁保持现有行为。

## 迁移

1. 重新构建独立的[法律 bundle](../../../../legal/README.zh.md#build-and-check)。
2. 先应用[文档工具补丁](../../../../legal/cordis.patch.yml)，再应用[当前编辑器补丁](../../../../legal/editor/cordis.patch.yml)。删除手动添加的 `deepseek-legal-editor` Loader 条目，将其编辑器设置放入 `deepseek-legal-redlining` 的 `config.editor` 下。
3. 设置 `parentOrigin: dsh-app://app`、`editorOrigin: http://127.0.0.1:9980` 和 `callbackOrigin: http://host.docker.internal:19387`。自定义端口须与[Compose 配置](../../../../legal/editor/compose.yml)及 Host 监听端口一致。
4. 重启专用 Compose 实例和原生 Desktop。打开 DOCX 预览，选择 **Open for redlining**。确认输入内容在 **Save and close** 后，于同一 Session 重新打开同一文档时仍然保留。
