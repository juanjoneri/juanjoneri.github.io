#!/usr/bin/env bash
# Sign the encrypted output with this site's deploy key and force-push it to site/<slug> on the hub (no history).
# The hub's deploy workflow picks it up on its next scheduled run and verifies the signature against registry.json.
set -euo pipefail
: "${SLUG:?}" "${OUT:?}" "${HUB:?}"
[ -n "${HUB_DEPLOY_KEY:-}" ] || { echo "::error::HUB_DEPLOY_KEY secret is missing in this repo"; exit 1; }

mkdir -p ~/.ssh && chmod 700 ~/.ssh
printf '%s\n' "$HUB_DEPLOY_KEY" > ~/.ssh/hub && chmod 600 ~/.ssh/hub
# GitHub's published host key (SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU)
echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" > ~/.ssh/known_hosts
export GIT_SSH_COMMAND="ssh -i ~/.ssh/hub -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes"
REMOTE="git@github.com:$HUB.git"

# Signed manifest: the slug plus the sha256 of every file. The hub only deploys a site whose manifest was signed
# by the key registered for that slug, so one site's key cannot publish another site's pages.
cd "$OUT"
{ echo "slug: $SLUG"; find . -type f -name '*.html' | LC_ALL=C sort | xargs -d '\n' sha256sum; } > _site.manifest
ssh-keygen -Y sign -q -f ~/.ssh/hub -n juanjoneri-site _site.manifest
echo "signing key (public, for registry.json): $(ssh-keygen -y -f ~/.ssh/hub | cut -d' ' -f1-2)"

git init -q -b site && git add -A
git -c user.name=publish-bot -c user.email=publish-bot@users.noreply.github.com commit -q -m "$SLUG @ ${GITHUB_SHA:0:7}"
git push -qf "$REMOTE" "HEAD:refs/heads/site/$SLUG"
echo "pushed site/$SLUG (deployed by the hub within ~10 min)"
