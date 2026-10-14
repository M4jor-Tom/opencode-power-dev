#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
cd "$ROOT"
node <<'JS'
const fs = require('node:fs');
const a = JSON.parse(fs.readFileSync('opencode.json'));
const s = JSON.parse(fs.readFileSync('skill-sources.json'));
const pins = {
  'claude-plugins-official': 'ed404106fcd80ba98ecb7c851e531dcb626d13b7',
  'ui-ux-pro-max-skill': '1307d97a72e6c1cda572cb65471ae5ce82995218',
  'awesome-gamedev-agent-skills': '9ca5296b219049c5b68494e1f3c274ead6d727b3',
  'claude-ontology-skill': '13bfe0ce8c46fbd3d77e9faf94ebeb6ba4f5bab3',
};
const expected = ['superpowers@git+https://github.com/obra/superpowers.git#b36e0829c6d0140e93cfef2ca599b1b07d4a7797', '@dietrichgebert/ponytail@git+https://github.com/DietrichGebert/ponytail.git#0a4dd63ad4541f4f655c4108a295916f3c1d8fda'];
const paths = {
  'claude-plugins-official': ['plugins/frontend-design/skills', 'plugins/claude-md-management/skills'],
  'ui-ux-pro-max-skill': ['.claude/skills'],
  'awesome-gamedev-agent-skills': ['skills', 'router'],
  'claude-ontology-skill': ['skills'],
};
const urls = {
  'claude-plugins-official': 'https://github.com/anthropics/claude-plugins-official.git',
  'ui-ux-pro-max-skill': 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git',
  'awesome-gamedev-agent-skills': 'https://github.com/gamedev-skills/awesome-gamedev-agent-skills.git',
  'claude-ontology-skill': 'https://github.com/M4jor-Tom/claude-ontology-skill.git',
};
if (a.$schema !== 'https://opencode.ai/config.json' || JSON.stringify(a.plugin) !== JSON.stringify(expected) || a.mcp.context7?.type !== 'remote' || a.mcp.context7?.url !== 'https://mcp.context7.com/mcp' || a.mcp.context7?.enabled !== true || s.length !== (fs.existsSync('agents') ? 4 : 2)) process.exit(1);
for (const x of s) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(x.name) || pins[x.name] !== x.rev || urls[x.name] !== x.url || JSON.stringify(paths[x.name]) !== JSON.stringify(x.paths) || !x.paths.every(p => a.skills.paths.includes(`{env:OPENCODE_CONFIG_DIR}/.vendor/${x.name}/${p}`))) process.exit(1);
}
JS
for file in skills/*/SKILL.md; do node -e 'const fs=require("node:fs"),s=fs.readFileSync(process.argv[1],"utf8").split("---",3)[1]||""; if(!/^\s*name:/m.test(s)||!/^description:/m.test(s)) process.exit(1)' "$file"; done
for name in graphify revise-agents-md simplify; do [ -f "commands/$name.md" ]; done
for path in .runtime/probe .vendor/probe node_modules/probe package.json bun.lock bun.lockb package-lock.json; do git check-ignore -q "$path"; done
sh -n scripts/setup.sh scripts/run.sh scripts/check.sh
node --test tests/*.test.ts
