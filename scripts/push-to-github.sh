#!/bin/bash
# Push the workspace to GitHub with secrets stripped from history.
#
# The early history of this repo contains committed .env files (OpenAI, Resend
# and auth secrets) plus a GitHub token pasted into a commit message. GitHub's
# push protection rejects those, so we can't push the workspace history as-is.
#
# This script exports a scrubbed copy instead: clone to a temp dir, remove the
# .env files from every commit, redact secret patterns from commit messages,
# then force-push that to GitHub. The workspace repo and the Vibecode `origin`
# remote are never modified.
#
# Force-push is intentional: GitHub is a one-way mirror here, not a branch
# other people commit to. Rewriting produces new commit SHAs each run, so the
# remote branch has to be replaced rather than fast-forwarded.
#
# Usage: scripts/push-to-github.sh
set -o errexit
set -o nounset
set -o pipefail

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="main"
EXPORT_DIR="$(mktemp -d /tmp/gh-export.XXXXXX)"
trap 'rm -rf "${EXPORT_DIR}"' EXIT

# Credentials live in the `github` remote URL in .git/config (never committed).
REMOTE_URL="$(git -C "${WORKSPACE}" remote get-url github)"

echo "Cloning workspace..."
git clone --quiet --no-hardlinks --single-branch --branch "${BRANCH}" \
  "${WORKSPACE}" "${EXPORT_DIR}/repo"
cd "${EXPORT_DIR}/repo"

echo "Removing .env files from history..."
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --index-filter \
  'git rm --cached --ignore-unmatch -q backend/.env backend/.env.production mobile/.env mobile/.env.production' \
  --prune-empty -- "${BRANCH}" >/dev/null 2>&1

echo "Redacting secrets from commit messages..."
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter \
  'sed -E -e "s/github_pat_[A-Za-z0-9_]+/[redacted-github-token]/g" \
          -e "s/ghp_[A-Za-z0-9]+/[redacted-github-token]/g" \
          -e "s/re_[A-Za-z0-9]{8}_[A-Za-z0-9]+/[redacted-api-key]/g" \
          -e "s/sk-proj-[A-Za-z0-9_-]+/[redacted-api-key]/g" \
          -e "s/sk-ant-[A-Za-z0-9_-]+/[redacted-api-key]/g"' \
  -- "${BRANCH}" >/dev/null 2>&1

# Refuse to push if anything secret-shaped survived the rewrite. Scans every
# blob reachable from the branch plus all commit messages.
echo "Verifying no secrets remain..."
SECRET_RE='github_pat_[A-Za-z0-9_]{20}|ghp_[A-Za-z0-9]{20}|sk-proj-[A-Za-z0-9]|sk-ant-[A-Za-z0-9]|re_[A-Za-z0-9]{8}_[A-Za-z0-9]'
HITS=$(
  {
    git rev-list --objects "${BRANCH}" | cut -d' ' -f1 | git cat-file --batch --buffer 2>/dev/null
    git log "${BRANCH}" --pretty='%s%n%b'
  } | grep -acE "${SECRET_RE}" || true
)
ENV_FILES=$(git log "${BRANCH}" --pretty=format: --name-only | grep -cE '(^|/)\.env' || true)

if [[ "${HITS}" != "0" || "${ENV_FILES}" != "0" ]]; then
  echo "ABORTING: scrub incomplete (secret matches=${HITS}, env files=${ENV_FILES})" >&2
  exit 1
fi

echo "Pushing ${BRANCH} to GitHub ($(git rev-list --count "${BRANCH}") commits)..."
git push --force --quiet "${REMOTE_URL}" "${BRANCH}:${BRANCH}"
echo "Done."
