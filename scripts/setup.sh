#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
[ ! -L "$ROOT/.vendor" ] || { echo 'Foreign .vendor symlink' >&2; exit 1; }
mkdir -p "$ROOT/.vendor"
jq -e 'type == "array" and all(.[]; (.name|type)=="string" and (.url|type)=="string" and (.rev|type)=="string" and (.paths|type)=="array" and all(.paths[]; type=="string"))' "$ROOT/skill-sources.json" >/dev/null
owned_clean() {
  [ ! -L "$dest" ] && [ -d "$dest/.git" ] &&
    [ "$(git -C "$dest" remote get-url origin)" = "$url" ] &&
    status=$(git -C "$dest" status --porcelain) && [ -z "$status" ]
}
jq -c '.[]' "$ROOT/skill-sources.json" | while IFS= read -r row; do
  printf '%s' "$row" | jq -e '.name | test("\\A[a-z0-9][a-z0-9-]*\\z")' >/dev/null || { echo 'Unsafe checkout name' >&2; exit 1; }
  printf '%s' "$row" | jq -e '.rev | test("\\A[0-9a-f]{40}\\z")' >/dev/null || { echo 'Invalid revision' >&2; exit 1; }
  name=$(printf '%s' "$row" | jq -r '.name')
  url=$(printf '%s' "$row" | jq -r '.url')
  rev=$(printf '%s' "$row" | jq -r '.rev')
  printf '%s' "$row" | jq -e 'all(.paths[]; . != "" and (startswith("/")|not) and (contains("\n")|not) and (split("/")|all(.[]; . != ".." and . != "." and . != "")))' >/dev/null
  dest="$ROOT/.vendor/$name"
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    owned_clean || { echo "Foreign or dirty checkout: $dest" >&2; exit 1; }
    if [ "$(git -C "$dest" rev-parse HEAD)" = "$rev" ]; then
      printf '%s' "$row" | jq -r '.paths[]' | while IFS= read -r path; do [ -e "$dest/$path" ] || exit 1; done
      continue
    fi
  fi
  stage=$(mktemp -d "$ROOT/.vendor/.stage.XXXXXX")
  if ! (git clone -q --no-checkout "$url" "$stage/repo" && git -C "$stage/repo" fetch -q origin "$rev" && git -C "$stage/repo" checkout -q --detach "$rev" && [ "$(git -C "$stage/repo" rev-parse HEAD)" = "$rev" ] && printf '%s' "$row" | jq -r '.paths[]' | while IFS= read -r path; do [ -e "$stage/repo/$path" ] || exit 1; done); then
    rm -rf -- "$stage"; echo "Unable to install $name at $rev" >&2; exit 1
  fi
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    owned_clean || { rm -rf -- "$stage"; echo "Foreign or dirty checkout: $dest" >&2; exit 1; }
    mv -- "$dest" "$stage/previous"
  fi
  mv -- "$stage/repo" "$dest"
  rm -rf -- "$stage"
done
