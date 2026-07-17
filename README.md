# TorchMatch

TorchMatch 检索 PyTorch 官方稳定版 wheel，并根据目标 Python、CUDA、操作系统和机器架构生成可复制的 pip 安装或下载命令。

它不在浏览器里爬取官网。GitHub Actions 定期解析 `https://download.pytorch.org/whl/` 中的真实 wheel 文件名，生成 `public/data/wheels.json`，前端只读取这份静态数据，因此可直接部署到 GitHub Pages。

## 本地开发

要求 Node.js 20+、npm 和 Python 3.10+。

```bash
npm install
npm run dev
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

抓取器只接受 `cpu`、`cuNNN` 稳定版目录以及 `torch`、`torchvision`、`torchaudio` 三个包。CUDA build 仅由 wheel 文件名 local version（例如 `+cu124`）决定，绝不由索引目录猜测。

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
- 选择 `torch` 时，只有真实数据中同时存在兼容环境的 `torchvision` 与 `torchaudio`，才生成三件套命令。
- 无匹配时展示逐项差异最少的 wheel，但不会将其标为兼容。

更完整的设计与验收规则见 [PLAN.md](./PLAN.md)。

