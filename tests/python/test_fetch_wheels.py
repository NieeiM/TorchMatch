from scripts.fetch_wheels import (
    artifact_key,
    classify_platform,
    parse_build,
    parse_wheel_url,
    resolve_artifact,
)


def occurrence(filename: str, source: str, sha: str, host_path: str | None = None):
    path = host_path or f"whl/{source}/{filename}"
    item = parse_wheel_url(
        f"https://download-r2.pytorch.org/{path}#sha256={sha}",
        source,
    )
    assert item is not None
    return item


def test_untagged_aarch64_from_single_cuda_index_uses_index_evidence():
    item = occurrence(
        "torch-2.5.0-cp311-cp311-linux_aarch64.whl",
        "cu124",
        "a" * 64,
    )
    wheel = resolve_artifact([item])
    assert wheel is not None
    assert wheel["build"] == {
        "kind": "cuda",
        "tag": "cu124",
        "evidence": "official-index",
        "filenameDeclared": False,
        "major": 12,
        "minor": 4,
    }
    assert wheel["sourceIndexes"] == ["cu124"]


def test_decodes_and_parses_filename_declared_cuda_wheel():
    item = parse_wheel_url(
        f"https://download.pytorch.org/whl/torch-2.4.1%2Bcu124-cp38-cp38-manylinux2014_aarch64.whl#sha256={'b' * 64}",
        "cu124",
    )
    assert item is not None
    wheel = resolve_artifact([item])
    assert wheel is not None
    assert wheel["version"] == "2.4.1"
    assert wheel["build"]["kind"] == "cuda"
    assert wheel["build"]["tag"] == "cu124"
    assert wheel["build"]["evidence"] == "filename"
    assert wheel["build"]["filenameDeclared"] is True
    assert wheel["pythonTags"] == ["cp38"]
    assert wheel["architectures"] == ["aarch64"]


def test_cpu_membership_wins_when_same_artifact_is_reused_by_cuda_index():
    sha = "c" * 64
    filename = "torchvision-0.20.0-py3-none-any.whl"
    wheel = resolve_artifact([
        occurrence(filename, "cpu", sha, f"whl/{filename}"),
        occurrence(filename, "cu124", sha, f"whl/{filename}"),
    ])
    assert wheel is not None
    assert wheel["build"]["kind"] == "cpu"
    assert wheel["build"]["evidence"] == "shared-cpu-index"
    assert wheel["sourceIndexes"] == ["cpu", "cu124"]


def test_same_filename_with_different_hashes_stays_as_distinct_artifacts():
    filename = "torch-1.0.0-cp36-cp36m-linux_x86_64.whl"
    cpu = occurrence(filename, "cpu", "d" * 64)
    cuda = occurrence(filename, "cu100", "e" * 64)
    assert artifact_key(cpu) != artifact_key(cuda)
    assert resolve_artifact([cpu])["build"]["kind"] == "cpu"
    assert resolve_artifact([cuda])["build"]["tag"] == "cu100"


def test_untagged_artifact_shared_only_by_cuda_indexes_is_ambiguous():
    sha = "f" * 64
    filename = "torchaudio-2.5.0-cp311-cp311-linux_aarch64.whl"
    wheel = resolve_artifact([
        occurrence(filename, "cu121", sha, f"whl/{filename}"),
        occurrence(filename, "cu124", sha, f"whl/{filename}"),
    ])
    assert wheel is not None
    assert wheel["build"]["kind"] == "unknown"
    assert wheel["build"]["evidence"] == "ambiguous"


def test_macos_is_never_inferred_as_cuda_from_index_membership():
    item = occurrence(
        "torch-2.5.0-cp311-none-macosx_11_0_arm64.whl",
        "cu124",
        "1" * 64,
    )
    wheel = resolve_artifact([item])
    assert wheel is not None
    assert wheel["build"]["kind"] == "cpu"
    assert wheel["build"]["evidence"] == "platform-policy"


def test_filename_build_wins_and_reports_source_conflict():
    item = occurrence(
        "torch-2.5.0+cu121-cp311-cp311-linux_x86_64.whl",
        "cu124",
        "2" * 64,
    )
    wheel = resolve_artifact([item])
    assert wheel is not None
    assert wheel["build"]["tag"] == "cu121"
    assert wheel["build"]["evidence"] == "filename"
    assert wheel["warnings"]


def test_platform_mapping():
    assert classify_platform("win_amd64") == (["windows"], ["x86_64"])
    assert classify_platform("macosx_11_0_arm64") == (["macos"], ["arm64"])
    assert classify_platform("manylinux_2_17_aarch64") == (["linux"], ["aarch64"])


def test_unknown_local_build_is_not_guessed():
    assert parse_build("rocm6.1") == {"kind": "unknown", "tag": "rocm6.1"}
    assert parse_build(None) is None


def test_development_and_release_candidate_wheels_are_excluded():
    assert parse_wheel_url(
        "https://download.pytorch.org/whl/cu126/torch-2.13.0.dev20260610%2Bcu126-cp311-cp311-linux_x86_64.whl",
        "cu126",
    ) is None
    assert parse_wheel_url(
        "https://download.pytorch.org/whl/cu126/torch-2.13.0rc1%2Bcu126-cp311-cp311-linux_x86_64.whl",
        "cu126",
    ) is None


def test_post_release_wheel_is_retained_as_stable():
    item = parse_wheel_url(
        "https://download.pytorch.org/whl/cpu/torch-2.12.0.post1%2Bcpu-cp311-cp311-linux_x86_64.whl",
        "cpu",
    )
    assert item is not None
    assert item["version"] == "2.12.0.post1"
