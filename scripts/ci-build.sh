#!/bin/sh
# Workers Builds build command (pnpm ci:build). Any failing check aborts the
# build, so nothing is deployed.
set -eu

# Workers Builds clones shallowly; "last updated" dates need full history.
if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  git fetch --quiet --unshallow
fi
echo "git history: full ($(git rev-list --count HEAD) commits)"

[ "${JDS_CI_HISTORY_ONLY:-}" = "1" ] && exit 0

# A Guide's `skill` reference is checked against the skills repo (ADR-0002).
rm -rf .skills
git clone --quiet --depth 1 https://github.com/joaodavidsilva/skills.git .skills

pnpm test
pnpm build
