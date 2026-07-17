[中文readme](README_zh.md)

# TorchMatch

TorchMatch searches official stable PyTorch wheels and generates copy-ready pip install and download commands for a target Python version, CUDA version, operating system, and machine architecture.

Try the deployed app at [nieeim.github.io/TorchMatch](https://nieeim.github.io/TorchMatch/).

## Local development

Requirements: Node.js 20+, npm, and Python 3.10+.

```bash
npm install
npm run dev
```

You can also start the development server with:

```bash
./serve.sh
```

Run frontend checks:

```bash
npm run lint
npm run test -- --run
npm run build
```

Run the crawler and Python tests:

```bash
python -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt pytest
.venv/bin/python -m pytest
.venv/bin/python scripts/fetch_wheels.py
```

The crawler accepts only stable `cpu` and `cuNNN` indexes and the `torch`, `torchvision`, and `torchaudio` packages. Build detection uses ranked evidence: a local version in the filename, such as `+cu124`, takes precedence. For unmarked files, artifacts are grouped by SHA256 and classified from their official index membership only when the source is unambiguous and the platform permits that inference. Ambiguous records are excluded from exact matches and command generation.

## GitHub Pages

The repository includes two workflows:

- `update-wheel-data.yml` refreshes official wheel data daily or on manual dispatch and commits it when the dataset changes.
- `deploy-pages.yml` tests, builds, and publishes the site when `main` changes or after the wheel-data workflow succeeds.

In repository **Settings → Pages**, set **Source** to **GitHub Actions**. The build automatically sets the Vite base path to the repository name; local development uses `/`.

## Matching behavior

- Every filter is optional.
- If an exact CUDA build is unavailable and CUDA fallback is enabled, TorchMatch prefers the nearest version in the same CUDA major release before considering another major release.
- CPU fallback is a separate option and is disabled by default.
- Fallback results clearly show the requested and actual CUDA builds.
- Selecting a `torch` wheel provides both a three-package PyTorch bundle command and a torch-only command. The bundle is generated only when compatible `torchvision` and `torchaudio` wheels exist in the real dataset; the torch-only command is always available.
- When no exact match exists, TorchMatch shows wheels with the fewest differences without marking them as compatible.

## Languages

The web interface is available in English and Simplified Chinese. English is the default; use the language button in the top navigation to switch. The preference is saved in the browser.
