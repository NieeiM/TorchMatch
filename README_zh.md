# TorchMatch

[English README](README.md)

TorchMatch 检索 PyTorch 官方稳定版 wheel，并根据目标 Python、CUDA、操作系统和机器架构生成可复制的 pip 安装或下载命令。

本项目已经部署在https://nieeim.github.io/TorchMatch/，可以直接使用

## 本地开发

要求 Node.js 20+、npm 和 Python 3.10+。

```bash
npm install
npm run dev
```

也可以使用启动脚本：

```bash
./serve.sh
```

运行前端检查：

```bash
npm run lint
npm run test -- --run
npm run build
```

运行抓取器和 Python 测试：

```bash
python -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt pytest
.venv/bin/python -m pytest
.venv/bin/python scripts/fetch_wheels.py
```

抓取器只接受 `cpu`、`cuNNN` 稳定版目录以及 `torch`、`torchvision`、`torchaudio` 三个包。build 识别采用分级证据：优先使用文件名 local version（例如 `+cu124`）；无标记时按 SHA256 聚合官方索引归属，只在来源唯一且平台允许时使用 build-specific 索引判定。歧义记录不会参与精确匹配或命令生成。

## GitHub Pages

仓库包含两个工作流：

- `update-wheel-data.yml` 每日或手动刷新官方 wheel 数据，并在内容变化时提交。
- `deploy-pages.yml` 在 `main` 更新后执行测试、构建并发布 Pages。

在仓库 Settings → Pages 中将 Source 设为 **GitHub Actions**。构建时会自动将 Vite base path 设为仓库名；本地默认使用 `/`。

## 匹配行为

- 所有筛选条件均可为空。
- 精确 CUDA 不存在且允许 fallback 时，优先同大版本内距离最近的 CUDA，再考虑其他大版本。
- CPU fallback 是独立开关，默认关闭。
- fallback 结果明确展示请求和实际 CUDA。
- 选择 `torch` 时同时提供三件套安装和仅安装 torch 两条命令；只有真实数据中存在兼容的 `torchvision` 与 `torchaudio` 时才生成三件套命令，单独安装命令始终可用。
- 无匹配时展示逐项差异最少的 wheel，但不会将其标为兼容。

## 界面语言

网页支持英文和简体中文，默认显示英文。可通过顶部导航栏的语言按钮切换，选择会保存在浏览器中。
