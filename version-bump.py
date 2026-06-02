#!/usr/bin/env python3
"""Bump the Dossier version, build + sign locally, and publish a GitHub release.

This is the single enforced release path. Everything is built on this machine —
no GitHub Actions. The script refuses to commit, tag, push, or publish unless a
local signed build succeeds first, so a broken build can never ship.

Flow:
  1. Pre-flight checks (branch, gh auth, signing key files, tooling).
  2. Bump the version across the 3 required files.
  3. Build + sign locally (tauri build, macOS aarch64).
  4. Collect artifacts into dist/ and generate latest.json.
  5. Commit, tag, push.
  6. Create a *published* GitHub release on the main dossier repo.

Releases are macOS-only (aarch64). Windows is no longer built.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
DESKTOP = ROOT / "apps/dossier-desktop"
TARGET_TRIPLE = "aarch64-apple-darwin"
RELEASE_REPO = "JamieM0/dossier"

FILES = {
    "tauri.conf.json": DESKTOP / "src-tauri/tauri.conf.json",
    "Cargo.toml":      DESKTOP / "src-tauri/Cargo.toml",
    "package.json":    DESKTOP / "package.json",
}
VERSION_FILES = [
    "apps/dossier-desktop/src-tauri/tauri.conf.json",
    "apps/dossier-desktop/src-tauri/Cargo.toml",
    "apps/dossier-desktop/package.json",
]

# Local minisign signing material (see ~/.tauri).
SIGNING_KEY_FILE = Path.home() / ".tauri/dossier-updater.key"
SIGNING_PASSWORD_FILE = Path.home() / ".tauri/dossier-updater.password.txt"

BUNDLE_DIR = DESKTOP / "src-tauri/target" / TARGET_TRIPLE / "release/bundle"
DIST = ROOT / "dist"
LATEST_JSON = ROOT / "latest.json"

# The no-install web build is the SvelteKit static output produced by the
# tauri build's beforeBuildCommand (adapter-static → apps/dossier-ui/build).
WEB_BUILD_DIR = ROOT / "apps/dossier-ui/build"

WEB_README = """\
Dossier — Web version (no install)
==================================

This is the lightweight, no-install version of Dossier. It runs entirely in
your browser as plain HTML/JS/CSS — nothing is installed and there is no
background process. Your library is encrypted with a passphrase you choose and
saved to a folder you pick on this device.

Requirements
------------
- A Chromium browser: Chrome, Edge, Brave, or Arc. (Firefox and Safari can't
  store the library — they don't support the File System Access API.)
- Node.js, to serve the files locally.

Run it
------
From inside this folder, start any static file server, for example:

    npx http-server -p 8080

then open the printed http://127.0.0.1:8080 address in a Chromium browser.
(Opening index.html directly with file:// will NOT work — it must be served
over http.)

You'll be asked to choose a folder for your library and set a passphrase, then
to paste your own TMDB API Read Access Token (v4). See:
https://www.themoviedb.org/settings/api

Want the full app?
------------------
The installed desktop app stores your credentials in the macOS Keychain (no
passphrase to remember) and runs without a browser. Download it from:
https://github.com/JamieM0/dossier/releases/latest

Your libraries are separate; use Settings → Library → Export / Import to move
data between the web version and the app.
"""


def die(msg):
    sys.exit(f"\n\033[31m✗ {msg}\033[0m")


def run(cmd, **kwargs):
    print(f"\033[2m$ {' '.join(cmd)}\033[0m")
    return subprocess.run(cmd, check=True, **kwargs)


# --------------------------------------------------------------------------- #
# Version file handling
# --------------------------------------------------------------------------- #
def read_current_version():
    content = FILES["tauri.conf.json"].read_text()
    m = re.search(r'"version":\s*"([^"]+)"', content)
    if not m:
        die("Could not read version from tauri.conf.json")
    return m.group(1)


def bump(version, part):
    major, minor, patch = map(int, version.split("."))
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def update_json(path, new_version):
    content = path.read_text()
    updated = re.sub(r'("version":\s*")[^"]+(")', rf'\g<1>{new_version}\2', content, count=1)
    if updated == content:
        die(f"Could not find version field in {path.name}")
    path.write_text(updated)


def update_cargo_toml(path, new_version):
    lines = path.read_text().splitlines(keepends=True)
    in_package = False
    replaced = False
    result = []
    for line in lines:
        if line.strip() == "[package]":
            in_package = True
        elif in_package and line.startswith("["):
            in_package = False
        if in_package and not replaced and re.match(r'^version\s*=\s*"', line):
            line = re.sub(r'"[^"]+"', f'"{new_version}"', line, count=1)
            replaced = True
        result.append(line)
    if not replaced:
        die("Could not find version in [package] section of Cargo.toml")
    path.write_text("".join(result))


def write_version(new_version):
    update_json(FILES["tauri.conf.json"], new_version)
    update_json(FILES["package.json"], new_version)
    update_cargo_toml(FILES["Cargo.toml"], new_version)
    print(f"Updated: tauri.conf.json, Cargo.toml, package.json")


# --------------------------------------------------------------------------- #
# Pre-flight
# --------------------------------------------------------------------------- #
def preflight():
    branch = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True, text=True,
    ).stdout.strip()
    if branch != "main":
        die(f"Releases must be cut from 'main' (currently on '{branch}').")

    for tool in ("git", "gh", "pnpm", "node"):
        if shutil.which(tool) is None:
            die(f"Required tool not found on PATH: {tool}")

    if subprocess.run(["gh", "auth", "status"], capture_output=True).returncode != 0:
        die("GitHub CLI is not authenticated. Run: gh auth login")

    if not SIGNING_KEY_FILE.exists():
        die(f"Updater signing key not found: {SIGNING_KEY_FILE}")
    if not SIGNING_PASSWORD_FILE.exists():
        die(f"Updater key password not found: {SIGNING_PASSWORD_FILE}")

    print("Pre-flight checks passed.")


# --------------------------------------------------------------------------- #
# Build + release
# --------------------------------------------------------------------------- #
def clean_stale_dmg_state():
    """Detach leftover updater/installer disk images and remove temp rw images.

    `bundle_dmg.sh` mounts a read-write staging image and arranges it via
    Finder. If a previous run failed mid-bundle it leaves that image mounted
    (and a `rw.*.dmg` temp file behind), which makes the next run fail. Clear
    both before building so a retry starts clean.
    """
    info = subprocess.run(["hdiutil", "info"], capture_output=True, text=True).stdout
    # Detach any mounted device whose backing image is one of our staging dmgs.
    current_dev = None
    for line in info.splitlines():
        line = line.strip()
        if line.startswith("/dev/disk"):
            current_dev = line.split()[0]
        if ("Dossier" in line or "rw." in line) and "image-path" in line and current_dev:
            subprocess.run(["hdiutil", "detach", current_dev, "-force"],
                           capture_output=True)
            print(f"Detached stale disk image: {current_dev}")

    macos_dir = BUNDLE_DIR / "macos"
    if macos_dir.exists():
        for tmp in macos_dir.glob("rw.*.dmg"):
            tmp.unlink()
            print(f"Removed leftover temp image: {tmp.name}")


def build_release():
    """Build and sign locally. Raises (aborting the release) on any failure."""
    env = os.environ.copy()
    env["TAURI_SIGNING_PRIVATE_KEY"] = SIGNING_KEY_FILE.read_text().strip()
    env["TAURI_SIGNING_PRIVATE_KEY_PASSWORD"] = SIGNING_PASSWORD_FILE.read_text().strip()

    clean_stale_dmg_state()
    run(["pnpm", "--filter", "@dossier/dossier-desktop", "run", "preflight:version"])
    run(
        [
            "pnpm", "--filter", "@dossier/dossier-desktop", "exec",
            "tauri", "build", "--target", TARGET_TRIPLE,
        ],
        env=env,
    )


def collect_artifacts():
    """Copy the macOS DMG + updater archive (and its signature) into dist/."""
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    patterns = ["dmg/*.dmg", "macos/*.app.tar.gz", "macos/*.app.tar.gz.sig"]
    collected = []
    for pattern in patterns:
        for src in BUNDLE_DIR.glob(pattern):
            dest = DIST / src.name
            shutil.copy2(src, dest)
            collected.append(dest.name)

    required_suffixes = (".dmg", ".app.tar.gz", ".app.tar.gz.sig")
    for suffix in required_suffixes:
        if not any(name.endswith(suffix) for name in collected):
            die(f"Build produced no '{suffix}' artifact under {BUNDLE_DIR}")

    print("Collected artifacts:")
    for name in collected:
        print(f"  - {name}")
    return collected


def build_web_zip(new_version):
    """Package the static web build + a README into a release zip. Reuses the
    SvelteKit output the tauri build already produced (no extra build)."""
    if not WEB_BUILD_DIR.is_dir():
        die(f"Web build not found at {WEB_BUILD_DIR} — the tauri build should have produced it.")

    staging = DIST / "_web-staging"
    if staging.exists():
        shutil.rmtree(staging)
    shutil.copytree(WEB_BUILD_DIR, staging)
    (staging / "README.txt").write_text(WEB_README)

    zip_base = DIST / f"Dossier-web-{new_version}"
    archive = shutil.make_archive(str(zip_base), "zip", root_dir=staging)
    shutil.rmtree(staging)
    print(f"Built web bundle: {Path(archive).name}")
    return archive


def generate_latest_json(tag):
    env = os.environ.copy()
    env.update({
        "TAG": tag,
        "ARTIFACTS_DIR": str(DIST),
        "OUTPUT": str(LATEST_JSON),
        "BUILDS_REPO": RELEASE_REPO,
    })
    run(["node", str(ROOT / ".github/scripts/generate-latest-json.mjs")], env=env)


def publish_release(tag):
    assets = [str(p) for p in DIST.iterdir()] + [str(LATEST_JSON)]
    run([
        "gh", "release", "create", tag,
        "--repo", RELEASE_REPO,
        "--title", f"Dossier {tag}",
        "--notes", f"Release assets for Dossier {tag}.",
        *assets,
    ])
    print(f"Published release {tag} on {RELEASE_REPO}.")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    parser = argparse.ArgumentParser(
        description="Bump the version, build + sign locally, and publish a GitHub release."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--major", action="store_true", help="Bump major version (X.0.0)")
    group.add_argument("--minor", action="store_true", help="Bump minor version (x.Y.0)")
    parser.add_argument(
        "message",
        nargs="?",
        help=(
            "Commit message. If given, ALL staged and unstaged changes are committed "
            "together with the version bump in a single commit using this message. "
            "If omitted, only the version files are committed as 'Bump version to X.Y.Z'."
        ),
    )
    args = parser.parse_args()

    part = "major" if args.major else "minor" if args.minor else "patch"

    preflight()

    current = read_current_version()
    new_version = bump(current, part)
    tag = f"v{new_version}"
    print(f"\n{current} → {new_version}  ({part})\n")

    # 1. Bump version on disk (not yet committed).
    write_version(new_version)

    # 2. Build + sign locally. This GATES the release — abort before any
    #    commit/tag/push if it fails.
    print("\n── Building locally (this can take a while) ─────────────────────")
    build_release()
    collect_artifacts()
    generate_latest_json(tag)
    # Built after latest.json so the updater manifest never sees the web zip.
    build_web_zip(new_version)

    # 3. Only now do we touch git / publish.
    print("\n── Build succeeded — committing and publishing ─────────────────")
    if args.message:
        run(["git", "add", "-A"])
        run(["git", "commit", "-m", args.message])
        print(f"Committed all changes with the version bump: {args.message!r}")
    else:
        run(["git", "add"] + VERSION_FILES)
        run(["git", "commit", "-m", f"Bump version to {new_version}"])

    run(["git", "tag", tag])
    run(["git", "push", "origin", "main", "--tags"])
    print(f"Pushed version changes and tag {tag}.")

    publish_release(tag)
    print(f"\n\033[32m✓ Dossier {tag} built locally and published to {RELEASE_REPO}.\033[0m")


if __name__ == "__main__":
    main()
