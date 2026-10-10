---
description: "为 DeepSeek Legal fork 提供可选的合同修订工具。"
kind: "package-bundle"
---

# DeepSeek Legal 红线修订 bundle

[English](README.md) | 中文

## 概述

这个独立的 Harness bundle 保留 DOCX 原件，为每个 Session 维护一个工作副本，并以原生 Word 修订形式应用 ADEU 修改。可选的原生 Desktop 贡献通过经过身份验证的 Harness Gateway 从 DOCX 预览打开 Collabora。请求 agent 修改前，请保存并关闭编辑器。聊天前的自动捕获、审阅结果连续性和受管理导出属于后续阶段。

## 目录

- [构建与检查](#build-and-check)
- [文档工具](#document-tools)
- [本地编辑器适配器](#local-editor-adapter)
- [打包与上游更新](#packaging-and-upstream-updates)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="build-and-check"></a>
## 构建与检查

在构建固定版本的 Harness checkout 后，从仓库根目录运行以下命令。仅用于开发的链接解析其现有包；这些链接既不是生产依赖，也不会修改上游工作区。

```powershell
corepack pnpm --dir legal install --frozen-lockfile
corepack pnpm --dir legal run build
corepack pnpm --dir legal run typecheck
corepack pnpm --dir legal test
```

本包拥有独立的锁文件。`pnpm pack` 包含构建后的 Host、Client factory、生成的 Typert 贡献、声明、bundle 补丁和 README，并保留精确的 Harness peer 版本要求。生成的 `dist`、`lib`、依赖、覆盖率文件和 tarball 均被忽略。任一 face 修改后均需构建；重新构建可选 Client 产物后，请重启开发版 Desktop。

完成上述构建后，可从根目录选择运行无需密钥的法律 Session 重放。它固定法律工具头部和未打开合同的响应。标准 Harness snapshot 流程跳过这个独立构建的 bundle；法律 CI 验证属于分发阶段。

```powershell
$env:LEGAL_SNAPSHOT = '1'
corepack pnpm run test:snapshot snapshots/session/headless.snapshot.ts -t 'replays legal-editor-contract' --maxWorkers=1
```

真实编辑器测试需要运行中的 Docker Linux 引擎，并先通过 `docker compose -f legal/editor/compose.yml pull` 拉取固定镜像。必须显式启用此测试；当 Docker 可执行文件不在 `PATH` 中时，`LEGAL_DOCKER_BIN` 指定它的位置。以下路径对应本机的按用户安装的 Docker。

```powershell
$env:LEGAL_EDITOR_E2E = '1'
$env:LEGAL_DOCKER_BIN = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
corepack pnpm --dir legal run test:e2e
```

此测试创建并删除自己的 Compose 项目，使用分配的回环端口，并仅发送合成 DOCX 数据。它检查两次 CODE 编辑和 WOPI 保存、其间的一次 ADEU 修改、原始字节保留和指定文档特性。它独立于不需要密钥的单元测试，不能证明 Desktop 嵌入或自动聊天交接有效。

<a id="document-tools"></a>
## 文档工具

`contract_open` 接收 DOCX 路径，并为每个 Harness Session 创建一个持续使用的文档。打开另一个源文件需要新的 Session。重新打开同一源文件会返回持续使用的文档，不会重置修订。`contract_read` 返回当前内容标识、代次、原始标识和完整的带标记文本投影。`contract_redline` 接收当前标识和有序的字面文本替换，可附加 Word 批注。目标必须唯一；过期标识、含糊目标或修改失败都会拒绝整个批次。agent（智能体）修改使用配置的作者名称，默认是 `Commercial Agent`。

存储目录必须显式配置为应用自有的绝对路径。bundle 选择 `dshHomePath('legal-documents')`。DOCX 字节文件按内容寻址并以排他方式创建；原文不会被重新序列化或覆盖。原子替换的 head 选择已提交的工作字节文件。写入锁协调重叠操作；发布 head 前会检查取消状态。这些工具通过 Harness 读取源文件，永远不会写入源文件。发布 head 前会同步文件内容；断电恢复仍取决于文件系统和设备的行为。

可配置限制涵盖文件字节数、ZIP 展开字节数、ZIP 部件数、完整响应字节数和修改数量。超大投影会失败，不会被截断。引擎为每个批次加载新的 DOM，使用严格匹配和 `partial=false`，并在发布前重新解析输出。它不提供接受全部修订、安全绕过、正则编辑或不带修订的 URL 重新定向操作。

<a id="local-editor-adapter"></a>
## 本地编辑器适配器

在[可选补丁](editor/cordis.patch.yml)中，同一 Loader 条目的 `config.editor` 在[bundle 补丁](cordis.patch.yml)之后启用。原生 Desktop profile 提供 Host Web 服务器、Workspace Files lookup、经过身份验证的 Gateway 和现有 Client slots。默认 bundle 仍可无界面运行。每个 Loader 包贡献一个 Client factory；编辑器 Host provider 是文档插件的子插件。

在所选 Session 的工作区内打开 DOCX 预览，并选择**打开合同修订**。普通预览仍显示源文件；独立的**合同编辑器**标签页显示受管理工作副本。Gateway 解析 Session 的工作区，拒绝越界路径和目录链接，发现配置的回环编辑器，并取得其写入生命周期。原始源文件保持不变。在同一 Session 中重新打开同一源文件会继续使用已保存的工作副本。

使用**保存**创建显式检查点，或在 agent 修改前使用**保存并关闭**。标签页的关闭控件也会请求保存，并等待确认和写入权释放。保存失败或超时会保留面板并显示反馈；迟到的确认不会完成较新的保存请求。Collabora 提供编辑、批注和审阅控件。首次运行时的欢迎对话框可使用其关闭控件关闭。需要更多空间时，可使用现有侧栏全屏控件。退出 Desktop 前请保存；窗口关闭和应用重新加载不执行标签页的显式保存流程。

在整个编辑器生命周期内，适配器持有与 agent 修改相同的跨进程写入锁。在该生命周期结束前，其他写入方的操作会被拒绝。每次保存都会验证完整 DOCX 和投影、保留原文，并原子选择新的工作代次；相同字节保持原代次。现有 head 格式不变。关闭或卸载适配器会撤销访问权限、取消未完成的请求，并等待写入锁释放。聊天前的自动保存和交接尚未实现。

访问凭证标识一个文档生命周期，在配置的时长后过期，并且不携带工作区文件系统路径。Bearer 令牌仅供经过身份验证的编辑器调用方使用；不要记录启动数据或 WOPI 请求 URL。默认允许四个活动文档、每个文档八个待处理请求，访问凭证有效期为一小时。WOPI 锁在 30 分钟后过期，除非客户端刷新它。锁不匹配时返回 409 和当前锁；过期、重复或错误的访问令牌会被拒绝。上传使用配置的文档字节上限。向编辑器提供的审阅者名称默认为 `Human Reviewer`，与 agent 名称不同；父来源仅允许原生 Desktop 的 `dsh-app://app`。

[容器配置](editor/compose.yml)固定 CODE，仅发布回环端口 9980，并允许回调到 `host.docker.internal` 上的 Host 端口 19387。嵌入策略仅允许 `dsh-app://app`；Electron 的 sandbox（沙箱）、context isolation 和 Web 安全保持启用。`LEGAL_EDITOR_PORT` 和 `LEGAL_HOST_PORT` 可覆盖部署端口；请同步更新可选补丁中的 `editorOrigin` 和 `callbackOrigin`。Docker Desktop 的 Linux 引擎和 WSL2 是独立的先决条件；Harness 仍以原生 Windows 应用运行。打开编辑器前，请使用 `docker compose -p deepseek-legal-editor -f legal/editor/compose.yml up -d` 启动专用实例。

<a id="packaging-and-upstream-updates"></a>
## 打包与上游更新

法律功能位于 `legal/`，通过精确的 peer 版本导入 Harness 接口。三个小型上游扩展支持该功能：Typert 生成中的显式包目录、共享 Client 构建预设中的显式 manifest，以及可选的侧栏延迟关闭。普通调用方保持现有行为。agent-loop、聊天和 Desktop launcher 源码保持不变。不要将此 bundle 发布到 DeepSeek 的 npm 命名空间。

Harness 更新必须有意进行：选择上游发布版本，同时更新开发基线和精确的 DSH peer 版本，协调三个扩展，构建 Harness，然后运行此 bundle 的构建、检查、已记录 Session 回放、真实 CODE 往返测试和原生 Desktop 验收。不要在日常红线修订期间自动更新编辑器或文档引擎。让 `origin` 指向用户仓库，并将官方 Harness 视为单独的上游来源。

<a id="model-experience"></a>
## 模型体验

模型可见三个合同工具，并通过普通的、已记录的工具结果接收完整当前文本、修订、批注和字节标识。修改调用返回已提交的当前投影。选择合同可能将其内容发送到所选模型服务；本地存储不意味着聊天离线运行。DOCX 字节文件属于本地应用数据。编辑器启动数据和访问令牌不进入模型文本记录或持久化标签页参数；iframe 消息必须来自准确的源窗口和配置的来源。

<a id="kv-cache-effect"></a>
### KV Cache 影响

每个合同结果都会将完整当前投影添加到已记录的模型上下文中。后续读取和修改可能增加提示词大小；结果有上限，永远不会被静默截断。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

- 聊天前的自动保存、审阅结果连续性、受管理导出、Commercial Agent 预设和 playbook 属于[实施计划](../IMPLEMENTATION_PLAN.md)的后续阶段。
- 存储归 Session 所有；无法从多个 Session 协调编辑。
- 本阶段没有编辑器访问过期后的未保存草稿恢复功能。请在配置的有效期结束前保存并关闭，默认有效期为一小时；过期后请重新加载 Desktop，再打开最后保存的副本。
- ADEU 的投影不涵盖所有 Word 构造。合成 CODE 往返测试检查已有批注和 agent 批注、修订、粗体文本、页眉及嵌入 PNG 的精确字节；它不能证明任意合同的保真性或接受和拒绝修订的行为。
- 原生开发 profile 的编辑器打开、输入、保存、关闭和重新打开流程使用合成文档。签名安装和完整的自动人工–agent 流程仍未验证。恢复的标签页布局不保留启动令牌或文档导航；请再次打开同一 DOCX 预览以继续使用已保存副本。
- 没有独立的运行时不变量伴随入口，因为一个文档存储拥有 head 及其按内容寻址的文件。读取时会检查完整性。

<a id="dev-note"></a>
## 开发备注

固定的编辑器为 Collabora CODE 26.04.1.4。[实施计划](../IMPLEMENTATION_PLAN.md)记录原生环境证据和用户验收检查点。Docker 和编辑器镜像是独立的安装先决条件；此 bundle 不是 Windows 安装程序。
