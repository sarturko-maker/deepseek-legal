---
description: "为 DeepSeek Legal fork 提供可选的合同修订工具。"
kind: "package-bundle"
---

# DeepSeek Legal 红线修订 bundle

[English](README.md) | 中文

## 概述

这个独立的 Harness bundle 将 DOCX 打开到应用自有存储中，保留原始字节，读取 ADEU 的带标记文本和批注附录，并以原生 Word 修订形式应用完整的修改批次。它通过现有的 Harness 工具管道和组合文件系统读取源文件。交互式编辑、接受或拒绝修订、导出和自动编辑器交接尚未实现；现有 Desktop DOCX 面板仍然是 PDF 预览。

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
corepack pnpm --dir legal test
```

本包拥有独立的锁文件。`pnpm pack` 创建包含构建后的 ESM 插件、bundle 补丁和 README 的 tarball；可安装产物保留精确的 Harness peer 版本要求。生成的 `dist`、依赖、覆盖率文件和 tarball 均被忽略。现有的构建后 `dsh --profile headless --patch legal/cordis.patch.yml --dump-config` 路径已在隔离的测试 home 中接受此覆盖配置；这只能证明组合配置有效，不能证明真实模型调用或 Desktop 安装有效。

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

可选的 `./editor` 入口通过 Harness 现有的 Host Web 服务器提供 WOPI 元数据、完整 DOCX 读取、带锁保存和锁管理。它的[可选补丁](editor/cordis.patch.yml)需要文档工具 bundle 和 Host Web 服务器。默认 bundle 补丁仅激活文档工具。目前尚无客户端面板或经过身份验证的启动操作来签发编辑器访问凭证；此适配器由专门的集成测试验证。

在整个编辑器生命周期内，适配器持有与 agent 修改相同的跨进程写入锁。在该生命周期结束前，其他写入方的操作会被拒绝。每次保存都会验证完整 DOCX 和投影、保留原文，并原子选择新的工作代次；相同字节保持原代次。现有 head 格式不变。关闭或卸载适配器会撤销访问权限、取消未完成的请求，并等待写入锁释放。聊天前的自动保存和交接尚未实现。

访问凭证标识一个文档生命周期，在配置的时长后过期，并且不携带工作区文件系统路径。Bearer 令牌仅供经过身份验证的编辑器调用方使用；不要记录启动数据或 WOPI 请求 URL。默认允许四个活动文档、每个文档八个待处理请求，访问凭证有效期为一小时。WOPI 锁在 30 分钟后过期，除非客户端刷新它。锁不匹配时返回 409 和当前锁；过期、重复或错误的访问令牌会被拒绝。上传使用配置的文档字节上限。向编辑器提供的审阅者名称默认为 `Human Reviewer`，与 agent 名称不同；父来源仅允许原生 Desktop 的 `dsh-app://app`。

[容器配置](editor/compose.yml)固定已发现的 CODE 镜像，仅发布回环端口 9980，并允许回调到 `host.docker.internal` 上的 Host 端口 19387。`LEGAL_EDITOR_PORT` 和 `LEGAL_HOST_PORT` 可以覆盖这些部署端口。Docker Desktop 的 Linux 容器引擎和 WSL2 是先决条件；Harness 仍然以原生 Windows 应用运行。真实 CODE 启动、Windows 回调和编辑器保存已通过合成文档往返测试；Desktop 嵌入尚未验证。

<a id="packaging-and-upstream-updates"></a>
## 打包与上游更新

GitHub 仓库是一个保留少量本地修改的开发 fork：上游应用代码保持不变，此 bundle 位于 `legal/`。运行时包通过精确的 peer 版本导入受支持的 Harness 接口。以后可将它移至独立仓库，无需更改 agent loop（智能体循环）或替换聊天。不要将它发布到 DeepSeek 的 npm 命名空间。

Harness 更新必须有意进行：选择上游发布版本，同时更新开发基线和精确的 DSH peer 版本，构建 Harness，然后运行此 bundle 的构建和检查。编辑器实现后，还必须通过真实 ADEU–Collabora 往返测试和原生 Desktop 编辑验收。不要在日常红线修订期间自动更新编辑器或文档引擎。让 fork 的 `origin` 指向用户指定的 GitHub 仓库，并将官方 Harness 视为单独的上游来源。

<a id="model-experience"></a>
## 模型体验

模型可见三个合同工具，并通过普通的、已记录的工具结果接收完整当前文本、修订、批注和字节标识。修改调用也会返回已提交的当前投影。选择合同可能将其内容发送到所选模型服务；本地存储不意味着聊天离线运行。原始 DOCX 和工作 DOCX 字节文件属于本地应用数据，不是 Session 日志载荷。

<a id="kv-cache-effect"></a>
### KV Cache 影响

每个合同结果都会将完整当前投影添加到已记录的模型上下文中。后续读取和修改可能增加提示词大小；结果有上限，永远不会被静默截断。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

- 此阶段没有交互式编辑器、导出操作、审阅结果记录、Commercial Agent 预设、playbook、自动轮次接纳或已记录 Session 场景。这些属于[实施计划](../IMPLEMENTATION_PLAN.md)的后续阶段。
- 存储归 Session 所有；无法从多个 Session 协调编辑。
- ADEU 的投影不涵盖所有 Word 构造。合成 CODE 往返测试检查已有批注和 agent 批注、修订、粗体文本、页眉及嵌入 PNG 的精确字节；它不能证明任意合同的保真性或接受和拒绝修订的行为。
- Desktop 安装和真实模型对这些新工具的使用尚未验证。源代码组合、两个构建后的入口和可选编辑器的真实 Host HTTP 路由分别进行测试。
- 没有独立的运行时不变量伴随入口，因为一个文档存储拥有 head 及其按内容寻址的文件。读取时会检查完整性。

<a id="dev-note"></a>
## 开发备注

真实编辑器测试验证了 Collabora CODE 26.04.1.4。Windows 引擎报告 Docker 29.8.2。containerd 启动崩溃后，用户释放磁盘空间，正常重启 Docker 恢复了引擎；崩溃原因尚未确认。合成文档往返测试通过；完整的原生 Desktop 验收仍在[实施计划](../IMPLEMENTATION_PLAN.md)中列为待完成。
