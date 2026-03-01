#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-$(pwd)}"
AGENT_SLUG="${2:-${AGENT_SLUG:-}}"
TASK_SLUG="${3:-$(date +%Y%m%d-%H%M%S)}"

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

if [ -z "$AGENT_SLUG" ]; then
  echo "Missing agent slug. Usage: scripts/agent-git-preflight.sh <repo_dir> <agent_slug> [task_slug]" >&2
  exit 3
fi

# Always sync local master first
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "master" ]; then
  git checkout master
fi

git fetch origin --prune
git pull --ff-only origin master

# Enforce branch-per-agent workflow
TARGET_BRANCH="agent/${AGENT_SLUG}/${TASK_SLUG}"
if git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
  git checkout "$TARGET_BRANCH"
  git rebase master
else
  git checkout -b "$TARGET_BRANCH" master
fi

echo "OK: clean+synced on $(git rev-parse --short HEAD), branch=${TARGET_BRANCH}"
