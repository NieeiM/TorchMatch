#!/usr/bin/env python3
"""Fetch and normalize official stable PyTorch wheel indexes."""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qs, unquote, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from packaging.utils import InvalidWheelFilename, parse_wheel_filename

ROOT = "https://download.pytorch.org/whl/"
PACKAGES = ("torch", "torchvision", "torchaudio")
BUILD_RE = re.compile(r"^(cpu|cu\d{3})$")
CUDA_RE = re.compile(r"^cu(\d{2})(\d)$")
USER_AGENT = "TorchMatch/0.1 (+https://github.com/)"
ALLOWED_HOSTS = {"download.pytorch.org", "download-r2.pytorch.org"}


def classify_platform(platform: str) -> tuple[list[str], list[str]]:
    systems: set[str] = set()
    architectures: set[str] = set()
    if platform.startswith(("manylinux", "linux")):
        systems.add("linux")
    elif platform.startswith("win"):
        systems.add("windows")
    elif platform.startswith("macosx"):
        systems.add("macos")

    if platform.endswith(("x86_64", "amd64")):
        architectures.add("x86_64")
    elif platform.endswith("aarch64"):
        architectures.add("aarch64")
    elif platform.endswith("arm64"):
        architectures.add("arm64")
    elif platform.endswith("universal2"):
        architectures.update(("x86_64", "arm64"))
    return sorted(systems), sorted(architectures)


def parse_build(local: str | None) -> dict[str, Any] | None:
    """Parse only build information explicitly declared by the wheel version."""
    if not local:
        return None
    if local == "cpu":
        return {"kind": "cpu", "tag": "cpu"}
    match = CUDA_RE.fullmatch(local)
    if match:
        return {
            "kind": "cuda",
            "tag": local,
            "major": int(match.group(1)),
            "minor": int(match.group(2)),
        }
    return {"kind": "unknown", "tag": local}


def parse_wheel_url(url: str, source_directory: str) -> dict[str, Any] | None:
    filename = unquote(Path(urlparse(url).path).name)
    if not filename.endswith(".whl"):
        return None
    try:
        package, version, _build_tag, tags = parse_wheel_filename(filename)
    except InvalidWheelFilename:
        return None
    package = package.replace("-", "_")
    if package not in PACKAGES:
        return None

    python_tags = sorted({tag.interpreter for tag in tags})
    abi_tags = sorted({tag.abi for tag in tags})
    platform_tags = sorted({tag.platform for tag in tags})
    systems: set[str] = set()
    architectures: set[str] = set()
    for platform in platform_tags:
        found_systems, found_architectures = classify_platform(platform)
        systems.update(found_systems)
        architectures.update(found_architectures)

    fragment = parse_qs(urlparse(url).fragment)
    sha256 = fragment.get("sha256", [None])[0]
    if sha256 and not re.fullmatch(r"[0-9a-fA-F]{64}", sha256):
        sha256 = None
    return {
        "package": package,
        "version": version.public,
        "declaredBuild": parse_build(version.local),
        "pythonTags": python_tags,
        "abiTags": abi_tags,
        "platformTags": platform_tags,
        "os": sorted(systems),
        "architectures": sorted(architectures),
        "filename": filename,
        "url": url,
        "sha256": sha256.lower() if sha256 else None,
        "sourceIndex": source_directory,
    }


def artifact_key(occurrence: dict[str, Any]) -> str:
    if occurrence["sha256"]:
        return f"sha256:{occurrence['sha256']}"
    parsed = urlparse(occurrence["url"])
    return f"url:{urlunparse(parsed._replace(fragment=''))}"


def build_value(kind: str, tag: str, evidence: str, filename_declared: bool) -> dict[str, Any]:
    value: dict[str, Any] = {
        "kind": kind,
        "tag": tag,
        "evidence": evidence,
        "filenameDeclared": filename_declared,
    }
    match = CUDA_RE.fullmatch(tag)
    if match:
        value.update(major=int(match.group(1)), minor=int(match.group(2)))
    return value


def resolve_artifact(occurrences: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Combine index occurrences and resolve build information by evidence priority."""
    first = occurrences[0]
    source_indexes = sorted({item["sourceIndex"] for item in occurrences})
    declared = {
        (item["declaredBuild"]["kind"], item["declaredBuild"]["tag"])
        for item in occurrences
        if item["declaredBuild"] is not None
    }
    warnings: list[str] = []

    if any(kind == "unknown" for kind, _tag in declared):
        return None
    if len(declared) > 1:
        build = build_value("unknown", "unknown", "ambiguous", False)
        warnings.append("Conflicting build tags were declared for the same artifact")
    elif declared:
        kind, tag = next(iter(declared))
        build = build_value(kind, tag, "filename", True)
        if tag not in source_indexes:
            warnings.append(f"Filename declares {tag}, but source indexes are {', '.join(source_indexes)}")
    elif "macos" in first["os"]:
        build = build_value("cpu", "cpu", "platform-policy", False)
    elif "cpu" in source_indexes:
        evidence = "shared-cpu-index" if len(source_indexes) > 1 else "official-index"
        build = build_value("cpu", "cpu", evidence, False)
    else:
        cuda_indexes = [index for index in source_indexes if CUDA_RE.fullmatch(index)]
        platform_allows_cuda = bool(set(first["os"]) & {"linux", "windows"})
        if len(cuda_indexes) == 1 and platform_allows_cuda:
            build = build_value("cuda", cuda_indexes[0], "official-index", False)
        else:
            build = build_value("unknown", "unknown", "ambiguous", False)
            if len(cuda_indexes) > 1:
                warnings.append(f"Untagged artifact is shared by CUDA indexes: {', '.join(cuda_indexes)}")
            else:
                warnings.append("Untagged artifact has no unambiguous supported build source")

    urls = sorted(
        ({"url": url, "sourceIndex": source} for url, source in {
            (item["url"], item["sourceIndex"]) for item in occurrences
        }),
        key=lambda item: (item["sourceIndex"], item["url"]),
    )
    preferred = next((item for item in urls if item["sourceIndex"] == build["tag"]), urls[0])
    return {
        "package": first["package"],
        "version": first["version"],
        "build": build,
        "pythonTags": first["pythonTags"],
        "abiTags": first["abiTags"],
        "platformTags": first["platformTags"],
        "os": first["os"],
        "architectures": first["architectures"],
        "filename": first["filename"],
        "url": preferred["url"],
        "sha256": first["sha256"],
        "sourceIndexes": source_indexes,
        "urls": urls,
        "warnings": warnings,
    }


def get_html(session: requests.Session, url: str) -> str:
    response = session.get(url, timeout=(10, 45))
    response.raise_for_status()
    return response.text


def discover_builds(session: requests.Session) -> list[str]:
    soup = BeautifulSoup(get_html(session, ROOT), "html.parser")
    builds = set()
    for anchor in soup.select("a[href]"):
        path = urlparse(urljoin(ROOT, anchor["href"])).path.rstrip("/")
        name = unquote(Path(path).name)
        if BUILD_RE.fullmatch(name):
            builds.add(name)
    return sorted(builds, key=lambda item: (item != "cpu", item))


def fetch_wheels(session: requests.Session, builds: Iterable[str]) -> tuple[list[dict[str, Any]], list[str]]:
    occurrences: dict[str, list[dict[str, Any]]] = {}
    warnings: list[str] = []
    for build in builds:
        if not BUILD_RE.fullmatch(build):
            warnings.append(f"Skipped unsupported directory: {build}")
            continue
        for package in PACKAGES:
            index_url = urljoin(ROOT, f"{build}/{package}/")
            try:
                soup = BeautifulSoup(get_html(session, index_url), "html.parser")
            except requests.RequestException as exc:
                warnings.append(f"Could not fetch {index_url}: {exc}")
                continue
            for anchor in soup.select("a[href]"):
                url = urljoin(index_url, anchor["href"])
                if urlparse(url).hostname not in ALLOWED_HOSTS:
                    warnings.append(f"Skipped external URL: {url}")
                    continue
                record = parse_wheel_url(url, build)
                if record:
                    occurrences.setdefault(artifact_key(record), []).append(record)
    records = [resolve_artifact(items) for items in occurrences.values()]
    wheels = sorted(
        (record for record in records if record is not None),
        key=lambda w: (w["package"], w["version"], w["build"]["tag"], w["filename"]),
    )
    return wheels, warnings


def write_data(path: Path, wheels: list[dict[str, Any]]) -> None:
    if not wheels:
        raise ValueError("Refusing to replace wheel data with an empty result")
    found = {wheel["package"] for wheel in wheels}
    if found != set(PACKAGES):
        raise ValueError(f"Missing packages: {sorted(set(PACKAGES) - found)}")
    payload = {
        "schemaVersion": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": ROOT,
        "wheelCount": len(wheels),
        "wheels": wheels,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix="wheels-", suffix=".json", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, separators=(",", ":"))
            file.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("public/data/wheels.json"))
    parser.add_argument("--build", action="append", dest="builds", help="Limit to a build directory; repeatable")
    args = parser.parse_args()

    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    adapter = requests.adapters.HTTPAdapter(max_retries=3)
    session.mount("https://", adapter)
    builds = args.builds or discover_builds(session)
    wheels, warnings = fetch_wheels(session, builds)
    for warning in warnings:
        print(f"warning: {warning}")
    write_data(args.output, wheels)
    print(f"Wrote {len(wheels)} wheels from {len(builds)} build indexes to {args.output}")


if __name__ == "__main__":
    main()
