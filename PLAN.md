# TorchMatch 编码计划

## 1. 项目目标与首版边界

TorchMatch 是一个可独立部署到 GitHub Pages 的静态网页工具。它通过 GitHub Actions 定期抓取 PyTorch 官方 wheel 索引，生成静态 JSON；浏览器只读取该 JSON，完成筛选、CUDA fallback、结果解释和 pip 命令生成。

首版支持：

- 官方稳定版源：`https://download.pytorch.org/whl/`
- 包：`torch`、`torchvision`、`torchaudio`
- CPU 与文件名中明确标识的 CUDA build
- Linux、Windows、macOS
- `x86_64`、`aarch64`、`arm64`
- CPython wheel（例如 `cp38`、`cp310`）
- 安装命令、跨平台 wheel 下载命令、wheel 直链
- GitHub Pages 静态部署与每日数据更新

首版不支持 conda、ROCm、nightly、Jetson 第三方 wheel、源码自动编译、登录和后端数据库。

## 2. 核心准确性约束

1. CUDA/CPU build 必须从规范化后的 wheel 文件名版本字段解析，不能根据 wheel 所在目录推断。
2. 例如索引目录为 `cu121`，但文件名版本没有 `+cu121`，则该目录信息只作为来源元数据保存，不将 wheel 标记为 CUDA 12.1。
3. 抓取时对 URL 百分号编码解码（例如 `%2Bcu121`），再解析文件名；保存下载 URL 时仍使用官方原始绝对 URL。
4. 使用 `packaging.utils.parse_wheel_filename` 和 `packaging.version.Version` 做标准解析，另以受控规则解析 PyTorch local version（如 `+cu118`、`+cpu`）。未知 local build 不猜测，标记为 `unknown` 并默认不进入 CPU/CUDA 精确结果。
5. 一个 wheel 可能包含多个兼容 tag；数据层保留所有 tag，前端匹配任一 tag 即可，避免仅取第一个 tag 导致漏报。
6. “精确匹配”表示所有已选择条件均满足；未选择的条件不参与判定。CUDA fallback 结果必须与精确结果分组并显示请求值、实际值和 fallback 原因。

## 3. 建议目录结构

```text
TorchMatch/
├── .github/workflows/
│   ├── update-wheel-data.yml
│   └── deploy-pages.yml
├── public/data/
│   └── wheels.json
├── scripts/
│   ├── fetch_wheels.py
│   └── requirements.txt
├── src/
│   ├── components/
│   ├── data/
│   ├── domain/
│   │   ├── types.ts
│   │   ├── matcher.ts
│   │   ├── fallback.ts
│   │   ├── companions.ts
│   │   └── commands.ts
│   ├── hooks/
│   ├── App.tsx
│   └── main.tsx
├── tests/python/
├── src/**/*.test.ts
├── index.html
├── package.json
├── tailwind.config.*
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 4. 静态数据抓取与 JSON 生成

### 4.1 抓取范围

从官方根索引发现允许的稳定版目录，再抓取目标包索引。抓取器采用显式 allowlist：

- 包名只接受 `torch`、`torchvision`、`torchaudio`
- build 目录只接受 `cpu` 和 `cu<数字>`
- 排除 `nightly`、`test`、`rocm*` 以及第三方目录
- 若官方索引结构变化，记录警告并令严格校验失败，避免静默产出错误数据

抓取器设置明确的 User-Agent、连接/读取超时、有限重试和指数退避。对链接去重，并限制为 `download.pytorch.org` 域名。

### 4.2 wheel 解析字段

每条 wheel 记录至少包含：

```json
{
  "package": "torch",
  "version": "2.4.1",
  "build": { "kind": "cuda", "tag": "cu124", "major": 12, "minor": 4 },
  "pythonTags": ["cp38"],
  "abiTags": ["cp38"],
  "platformTags": ["manylinux2014_aarch64"],
  "os": ["linux"],
  "architectures": ["aarch64"],
  "filename": "torch-2.4.1+cu124-cp38-cp38-manylinux2014_aarch64.whl",
  "url": "https://download.pytorch.org/...",
  "sourceDirectory": "cu124"
}
```

补充顶层元数据：

```json
{
  "schemaVersion": 1,
  "generatedAt": "ISO-8601 UTC timestamp",
  "source": "https://download.pytorch.org/whl/",
  "wheelCount": 0,
  "wheels": []
}
```

### 4.3 OS 与架构归一化

- `win_amd64` → Windows / `x86_64`
- `manylinux*_*x86_64`、`linux_x86_64` → Linux / `x86_64`
- `manylinux*_aarch64`、`linux_aarch64` → Linux / `aarch64`
- `macosx*_*x86_64` → macOS / `x86_64`
- `macosx*_arm64` → macOS / `arm64`
- `universal2` 若出现则保留为多架构兼容信息，不强行缩减为单一架构
- 未识别平台写入解析报告；不将其错误归类

生成流程使用临时文件完成全部校验后再原子替换 `public/data/wheels.json`。输出按包名、版本、build、Python tag、平台和文件名稳定排序，以得到可审查的 diff。

## 5. 前端领域模型与匹配算法

### 5.1 查询模型

所有筛选项均为可空值：包类型、Torch/包版本、Python 版本、CUDA/CPU、操作系统、架构；另有“允许 CUDA fallback”和“允许 fallback 到 CPU”两个独立开关。后者默认关闭，以满足不自动回退 CPU 的规则。

筛选选项从 JSON 中动态推导，避免前端硬编码过期版本。选项之间可做联动提示，但不隐藏潜在候选，用户仍可构造无匹配查询并得到解释。

### 5.2 精确匹配

匹配顺序：

1. 包名与版本
2. Python tag（`3.10` 映射为 `cp310`）
3. OS 和架构
4. build 类型与 CUDA tag
5. 对相同展示项按 wheel URL 去重

ABI 不作为单独 UI 筛选项，但必须随 Python/下载命令匹配并展示。若 Python tag 为 `cp310`，优先使用对应 CPython ABI；兼容 ABI（如 `abi3`、`none`）依据 wheel tag 真实值处理，不凭经验改写。

### 5.3 CUDA fallback 排序

仅当用户选择了具体 CUDA 版本、开启 fallback 且没有精确 CUDA 结果时启用：

1. 收集仍满足包、版本、Python、OS、架构的 CUDA wheel。
2. 同 CUDA 大版本优先。
3. 同大版本内按小版本绝对距离升序。
4. 距离相同时优先较新的小版本。
5. 同大版本不存在时，对其他大版本按大版本距离、再按小版本距离排序。
6. 默认排除 CPU；只有“允许 fallback 到 CPU”显式开启后，CPU 才作为 CUDA 候选全部失败后的最后一级结果。
7. 展示最优 fallback 组，同时允许展开“其他接近结果”。

每个结果附加前端计算字段：`matchType`（`exact`、`same-major-fallback`、`cross-major-fallback`、`cpu-fallback`）、`requestedBuild`、`actualBuild`、`fallbackReason`。

## 6. 包选择与命令生成

### 6.1 单 wheel 选择

用户在结果列表选中一个真实 wheel 后才生成命令。结果卡展示包名、基础版本、Python、ABI、CPU/CUDA、OS、架构、文件名、下载链接、精确/fallback 状态。

### 6.2 `torch` 伴随包解析

选择 `torch` 时，安装命令必须包含 `torchvision` 和 `torchaudio`。不能用硬编码版本对照表，应从同一份真实 wheel 数据寻找伴随版本：

1. 与已选 torch 的 build、Python、OS、架构完全一致。
2. 候选 wheel 必须真实存在。
3. `torchaudio` 优先选与 torch 基础版本相同者。
4. `torchvision` 从满足同一环境且与该 torch 发布组合共存的候选中选择；数据生成阶段额外产出经过真实 wheel 交集验证的 `releaseSets`，避免只按版本号猜配套关系。
5. 若无法无歧义地确定完整三件套，不生成可能错误的安装命令；明确列出缺失包，并提供已选 torch 的单 wheel 下载命令和直链。

`torchvision` 或 `torchaudio` 被选中时，安装命令只包含所选包，不自动加入 torch。

### 6.3 安装命令

- 使用基础版本约束（例如 `torch==2.4.1`）配合官方 `--index-url`。
- index URL 根据已选 wheel 的文件名 build 得出，例如 `cu124` 或 `cpu`，不得使用来源目录替代解析结果。
- 若 build 无法映射到受支持官方 index，不生成 index 安装命令，改为 wheel 直链安装建议。
- 页面同时给出单行命令和适合阅读的多行命令；复制时使用当前平台可执行的单行形式，避免 shell 续行符跨平台问题。

### 6.4 下载命令

生成 `python -m pip download`，包含所选包版本、正确 index URL、`--python-version`、`--implementation cp`、真实 ABI、真实 platform tag、`--only-binary=:all:`、`--no-deps`。若 wheel 含多个 platform tag，默认采用与本次匹配一致的具体 tag，并允许用户查看直链作为最确定的下载方式。

## 7. 无匹配诊断

无结果时运行“逐条件消融”诊断：保持其他条件不变，每次放宽一个条件，统计可恢复的候选数。页面据此说明哪些条件造成冲突，而不是只显示“未找到”。

建议按可恢复候选数和改动幅度排序：

- 开启或扩大 CUDA fallback
- 放宽 Python 版本
- 显式切换 CPU
- 更换 OS 或架构
- 查看按条件差异数排序的最近 wheel
- 若官方源确实无目标平台，提示可能需要源码编译或设备厂商 wheel，并明确这些不属于 TorchMatch 首版支持范围

“最近 wheel”的距离由不匹配条件数、CUDA 距离、Python 次版本距离组成，并逐项展示差异，不能标为兼容或可安装。

## 8. 页面与交互实现

使用 React、TypeScript、Vite、Tailwind CSS：

1. 顶部：项目名、用途、仅官方稳定源说明。
2. 筛选卡：响应式下拉框，所有项提供“任意”；CUDA fallback 开关旁显示规则说明。
3. 搜索状态：首次加载、数据错误、搜索中、结果计数。
4. 结果区：精确结果优先，fallback 使用醒目但非错误式提示；移动端卡片、桌面端紧凑列表。
5. 选择详情：展示请求与实际 build、完整 wheel 元数据。
6. 命令区：安装、下载两个代码块及独立复制按钮；复制后提供可访问的状态反馈。
7. 页脚：JSON 更新时间、记录数量、官方源链接、数据可能滞后的提示。

可访问性要求：表单有 label、键盘可操作、焦点清晰、状态使用 `aria-live`、颜色不作为唯一状态标识、代码块可横向滚动。

Vite 的 `base` 根据 GitHub Pages 仓库路径配置（默认 `/TorchMatch/`，也允许通过环境变量覆盖）；数据 URL 使用 `import.meta.env.BASE_URL` 拼接，保证项目页和自定义域名都可工作。

## 9. 测试计划

### 9.1 pytest

- URL 解码与 wheel 文件名解析
- `+cu118`、`+cu121`、`+cpu`、未知/无 local build
- 目录名与文件名 build 冲突时，以文件名为准
- CPython、ABI、多 platform tag
- Windows/Linux/macOS 与三种目标架构映射
- 非 wheel、损坏文件名、重复链接、域外链接
- JSON schema、稳定排序和 release set 生成
- 使用小型 HTML fixture，测试索引结构变化与抓取发现逻辑

网络抓取测试使用 fixture/mock，不依赖实时官网；可增加一个非阻塞或手动的线上 smoke test。

### 9.2 Vitest + Testing Library

- 空筛选与每个单独筛选项
- 多条件精确匹配
- 同大版本、跨大版本、CPU fallback 的优先级和开关行为
- 文件名未声明 CUDA 时不匹配 CUDA
- 无结果原因与最近结果排序
- torch 三件套配对成功/失败
- torchvision、torchaudio 命令不附加 torch
- 安装/下载命令的 index、Python、ABI、platform 参数
- 数据加载失败、空数据、复制按钮交互

### 9.3 构建验收

- `pytest`
- `npm run lint`
- `npm run test -- --run`
- `npm run build`
- 检查构建产物在子路径下能加载 JSON 和静态资源

## 10. GitHub Actions

### 10.1 数据更新工作流

- 触发：每天一次 `schedule` + `workflow_dispatch`
- 安装锁定版本的 Python 依赖
- 运行抓取器与 pytest
- 校验 wheel 数量非零、三个包均存在、schema 正确、异常比例未超阈值
- 仅当 JSON 变化时提交到专用分支或直接创建自动更新 PR
- 使用最小权限：默认 `contents: read`，需要提交步骤时仅授予 `contents: write` 或 PR 所需权限
- 设置 concurrency，避免定时任务重叠

推荐自动创建 PR，而不是未经审查直接覆盖主分支；部署仍使用主分支中最后一份通过测试的数据。

### 10.2 Pages 部署工作流

- 触发：`main` push 和手动触发
- 运行 Python/前端测试
- 构建 Vite
- 上传 `dist` 为 Pages artifact
- 使用官方 Pages actions 部署
- 设置 `pages: write`、`id-token: write` 和 deployment environment

## 11. 分阶段实施顺序

### 阶段 A：工程骨架

- 初始化 Vite React TypeScript、Tailwind、ESLint、Vitest。
- 配置 Pages base path、脚本和基础 README。
- 建立 Python 抓取器环境与测试目录。

完成标准：空壳页面可构建，Python 与前端测试命令可运行。

### 阶段 B：真实数据管线

- 实现索引发现、抓取、URL 规范化、wheel 解析、平台归一化。
- 定义并校验 schema，生成 `wheels.json` 与 release sets。
- 建立 fixture 和 pytest 覆盖异常情况。

完成标准：从官方源生成非空、可复现、可校验的静态数据，CUDA 不依赖目录推断。

### 阶段 C：搜索与 fallback 领域逻辑

- 实现纯 TypeScript 匹配函数、fallback 排序、最近结果和无结果诊断。
- 实现伴随包选择与命令生成。
- 先用 Vitest 固定规则，再接 UI。

完成标准：需求中的精确、fallback、禁止隐式 CPU fallback 和命令示例均有自动化测试。

### 阶段 D：响应式 UI

- 实现筛选、结果、详情、命令、复制和错误状态。
- 补充移动端布局与可访问性。

完成标准：用户可从筛选到复制命令完成完整流程，fallback 信息透明。

### 阶段 E：自动化与上线

- 配置数据更新和 Pages 部署工作流。
- 在 GitHub Pages 子路径做冒烟测试。
- 补充维护、数据更新时间、已知限制说明。

完成标准：主分支通过全部检查后自动部署，每日任务可生成可审查的数据更新。

## 12. 首版验收清单

- [ ] 所有筛选条件允许为空。
- [ ] 搜索依据真实 wheel 文件名及 tag。
- [ ] CUDA build 不从目录名推断。
- [ ] 精确结果与 fallback 结果明确区分。
- [ ] CUDA fallback 排序符合大版本和距离规则。
- [ ] 未显式允许时绝不 fallback 到 CPU。
- [ ] 结果展示全部要求字段和真实下载直链。
- [ ] 选择 torch 时安装命令含三个经过真实数据验证的包。
- [ ] 选择 torchvision/torchaudio 时不自动添加 torch。
- [ ] 下载命令使用真实 Python、ABI 和 platform tag。
- [ ] 无匹配时展示原因、最近候选和可执行建议。
- [ ] 静态 JSON 含更新时间和来源信息。
- [ ] pytest、Vitest、lint、build 全部通过。
- [ ] GitHub Pages 子路径和移动端可正常使用。
- [ ] 定时更新失败不会覆盖上一份有效数据。

## 13. 实施时需验证的官方源细节

编码阶段应先用少量真实索引样本验证以下假设并固化为 fixture：

- 根目录及包索引的实际链接层级和分页形式。
- local version 在链接文本、href 中的编码差异。
- macOS wheel 是否带 CPU local tag；若文件名没有 `+cpu`，应将其记为“无加速 build 标识”，再基于产品规则决定是否归入 CPU，而不是根据目录猜测。
- 官方稳定索引中是否存在重复 wheel URL 或同文件多目录引用。
- `torch`、`torchvision`、`torchaudio` 可验证 release set 的覆盖情况；若仅靠 wheel 交集仍有歧义，需要引入一份由官方 previous versions 页面生成并带来源的静态兼容映射，但不能在前端硬编码猜测。

这些验证属于阶段 B 的阻断项：在数据语义确认之前，不应宣称命令生成已达到可直接安装的准确性。
