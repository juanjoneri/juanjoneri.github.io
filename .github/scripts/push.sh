#!/usr/bin/env bash
# Force-push encrypted output to site/<slug> on the hub (no history), then record it in sites.lock.json on master
# (that commit is what triggers the hub's deploy workflow).
set -euo pipefail
: "${SLUG:?}" "${OUT:?}" "${HUB:?}"
[ -n "${HUB_DEPLOY_KEY:-}" ] || { echo "::error::HUB_DEPLOY_KEY secret is missing in this repo"; exit 1; }

mkdir -p ~/.ssh && chmod 700 ~/.ssh
printf '%s\n' "$HUB_DEPLOY_KEY" > ~/.ssh/hub && chmod 600 ~/.ssh/hub
# GitHub's published host key (SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU)
echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" > ~/.ssh/known_hosts
export GIT_SSH_COMMAND="ssh -i ~/.ssh/hub -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes"
git config --global user.name "publish-bot"
git config --global user.email "publish-bot@users.noreply.github.com"
REMOTE="git@github.com:$HUB.git"
SRC_SHA=${GITHUB_SHA:0:7}

( cd "$OUT" && git init -q -b site && git add -A && git commit -qm "$SLUG @ $SRC_SHA" && git push -qf "$REMOTE" "HEAD:refs/heads/site/$SLUG" )
echo "pushed site/$SLUG"

for attempt in 1 2 3 4 5; do
  rm -rf .hub-stamp
  git clone -q --depth 1 --branch master "$REMOTE" .hub-stamp
  ( cd .hub-stamp
    [ -f sites.lock.json ] || echo '{}' > sites.lock.json
    jq --arg s "$SLUG" --arg c "$SRC_SHA" --arg t "$(date -u +%FT%TZ)" '.[$s] = {source_commit: $c, published_at: $t}' sites.lock.json > l && mv l sites.lock.json
    git add sites.lock.json && git commit -qm "publish: $SLUG @ $SRC_SHA" && git push -q origin master ) && { echo "stamped master"; exit 0; }
  sleep $((attempt * 3))
done
echo "::error::could not update sites.lock.json on master"; exit 1
