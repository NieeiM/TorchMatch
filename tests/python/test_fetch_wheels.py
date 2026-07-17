from scripts.fetch_wheels import classify_platform, parse_build, parse_wheel_url


def test_cuda_comes_from_filename_not_directory():
    wheel = parse_wheel_url(
        "https://download.pytorch.org/whl/cu121/torch-2.4.1-cp310-cp310-manylinux2014_x86_64.whl",
        "cu121",
    )
    assert wheel is not None
    assert wheel["build"] == {"kind": "cpu", "tag": "cpu"}
    assert wheel["sourceDirectory"] == "cu121"


def test_decodes_and_parses_cuda_wheel():
    wheel = parse_wheel_url(
        "https://download.pytorch.org/whl/torch-2.4.1%2Bcu124-cp38-cp38-manylinux2014_aarch64.whl",
        "cu124",
    )
    assert wheel is not None
    assert wheel["version"] == "2.4.1"
    assert wheel["build"] == {"kind": "cuda", "tag": "cu124", "major": 12, "minor": 4}
    assert wheel["pythonTags"] == ["cp38"]
    assert wheel["os"] == ["linux"]
    assert wheel["architectures"] == ["aarch64"]


def test_official_cdn_filename_is_parseable():
    wheel = parse_wheel_url(
        "https://download-r2.pytorch.org/whl/cu124/torch-2.4.1%2Bcu124-cp310-cp310-linux_x86_64.whl#sha256=abc",
        "cu124",
    )
    assert wheel is not None
    assert wheel["filename"].startswith("torch-2.4.1+cu124")


def test_platform_mapping():
    assert classify_platform("win_amd64") == (["windows"], ["x86_64"])
    assert classify_platform("macosx_11_0_arm64") == (["macos"], ["arm64"])
    assert classify_platform("manylinux_2_17_aarch64") == (["linux"], ["aarch64"])


def test_unknown_local_build_is_not_guessed():
    assert parse_build("rocm6.1") == {"kind": "unknown", "tag": "rocm6.1"}
