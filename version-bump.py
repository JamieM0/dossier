#!/usr/bin/env python3
import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
FILES = {
    "tauri.conf.json": ROOT / "apps/dossier-desktop/src-tauri/tauri.conf.json",
    "Cargo.toml":      ROOT / "apps/dossier-desktop/src-tauri/Cargo.toml",
    "package.json":    ROOT / "apps/dossier-desktop/package.json",
}


def read_current_version():
    content = FILES["tauri.conf.json"].read_text()
    m = re.search(r'"version":\s*"([^"]+)"', content)
    if not m:
        sys.exit("Could not read version from tauri.conf.json")
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
        sys.exit(f"Could not find version field in {path.name}")
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
        sys.exit("Could not find version in [package] section of Cargo.toml")
    path.write_text("".join(result))


def check_clean_working_tree():
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True, text=True, check=True,
    )
    dirty = [
        line for line in result.stdout.splitlines()
        if line and not line.startswith("??")  # ignore untracked files
    ]
    if dirty:
        print("Error: you have uncommitted changes. Commit them first, then re-run version-bump.")
        for line in dirty:
            print(f"  {line}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Bump the Dossier version across all 3 required files.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--major", action="store_true", help="Bump major version (X.0.0)")
    group.add_argument("--minor", action="store_true", help="Bump minor version (x.Y.0)")
    args = parser.parse_args()

    check_clean_working_tree()

    part = "major" if args.major else "minor" if args.minor else "patch"
    current = read_current_version()
    new_version = bump(current, part)

    print(f"{current} → {new_version}  ({part})")

    update_json(FILES["tauri.conf.json"], new_version)
    update_json(FILES["package.json"], new_version)
    update_cargo_toml(FILES["Cargo.toml"], new_version)

    print(f"Updated: tauri.conf.json, Cargo.toml, package.json")

    # Stage and commit the version changes
    version_files = [
        "apps/dossier-desktop/src-tauri/tauri.conf.json",
        "apps/dossier-desktop/src-tauri/Cargo.toml",
        "apps/dossier-desktop/package.json",
    ]
    subprocess.run(["git", "add"] + version_files, check=True)
    subprocess.run(
        ["git", "commit", "-m", f"Bump version to {new_version}"],
        check=True,
    )

    # Create the version tag
    tag_name = f"v{new_version}"
    subprocess.run(["git", "tag", tag_name], check=True)
    print(f"Created tag: {tag_name}")
    subprocess.run(["git", "push", "origin", "main", "--tags"], check=True)
    print(f"Pushed version changes and tag to origin")


if __name__ == "__main__":
    main()
