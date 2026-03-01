#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-$(pwd)}"
cd "$REPO_DIR"

if [ ! -d .git ]; then
  echo "Not a git repo: $REPO_DIR" >&2
  exit 1
fi

# fail fast on dirty tree
if [ -n "$(git status --porcelain)" ]; then
  echo "Repo is dirty. Commit/stash before proceeding." >&2
  git status --short
  exit 2
fi

# sync fast-forward only
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "master" ]; then
  git checkout master
fi

git fetch origin --prune
git pull --ff-only origin master

echo "OK: repo clean and synced at $(git rev-parse --short HEAD)"
