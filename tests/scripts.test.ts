import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync, chmodSync, renameSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const run = (root: string, script: string, env = process.env, ...args: string[]) => spawnSync('sh', [join(root, 'scripts', script), ...args], { env, encoding: 'utf8' });
test('setup pins, offline reuse, dirty/foreign/fetch failures and safe names', () => {
  const base = mkdtempSync(join(tmpdir(), 'profile scripts '));
  try {
    const origin = join(base, 'origin'); mkdirSync(origin); git(origin, 'init', '-q'); git(origin, 'config', 'user.email', 'test@example.com'); git(origin, 'config', 'user.name', 'Tester');
    mkdirSync(join(origin, 'skills', 'example'), { recursive: true }); writeFileSync(join(origin, 'skills', 'example', 'SKILL.md'), '---\nname: example\ndescription: example\n---\n');
    git(origin, 'add', '.'); git(origin, 'commit', '-qm', 'one'); const rev = git(origin, 'rev-parse', 'HEAD');
    const root = join(base, 'profile with spaces'); mkdirSync(join(root, 'scripts'), { recursive: true }); cpSync(join(scripts, 'setup.sh'), join(root, 'scripts', 'setup.sh'));
    const manifest = (name: string, url: string, hash: string) => writeFileSync(join(root, 'skill-sources.json'), JSON.stringify([{ name, url, rev: hash, paths: ['skills/example'] }]));
    manifest('example', origin, rev); assert.equal(run(root, 'setup.sh').status, 0); assert.equal(git(join(root, '.vendor', 'example'), 'rev-parse', 'HEAD'), rev);
    const renamed = join(base, 'offline'); renameSync(origin, renamed);
    assert.equal(run(root, 'setup.sh').status, 0);
    writeFileSync(join(root, '.vendor', 'example', 'skills', 'example', 'SKILL.md'), 'dirty');
    manifest('example', renamed, rev); assert.notEqual(run(root, 'setup.sh').status, 0);
    assert.equal(readFileSync(join(root, '.vendor', 'example', 'skills', 'example', 'SKILL.md'), 'utf8'), 'dirty');
    manifest('example', origin, 'a'.repeat(40)); assert.notEqual(run(root, 'setup.sh').status, 0);
    assert.equal(readFileSync(join(root, '.vendor', 'example', 'skills', 'example', 'SKILL.md'), 'utf8'), 'dirty');
    git(join(root, '.vendor', 'example'), 'checkout', '--', '.');
    manifest('example', renamed, rev); assert.notEqual(run(root, 'setup.sh').status, 0);
    assert.equal(git(join(root, '.vendor', 'example'), 'rev-parse', 'HEAD'), rev);
    for (const name of ['../escape', 'UPPER', 'newline\nbad', 'newline-trailing\n']) {
      manifest(name, renamed, rev);
      assert.notEqual(run(root, 'setup.sh').status, 0, `accepted unsafe name ${JSON.stringify(name)}`);
      assert.equal(existsSync(join(root, '.vendor', name)), false);
    }
    manifest('revision-newline', renamed, `${rev}\n`);
    assert.notEqual(run(root, 'setup.sh').status, 0, 'accepted trailing-newline revision');
    assert.equal(existsSync(join(root, '.vendor', 'revision-newline')), false);
    manifest('other', join(base, 'missing'), rev); assert.notEqual(run(root, 'setup.sh').status, 0); assert.equal(existsSync(join(root, '.vendor', 'other')), false);
    manifest('example', renamed, 'not-a-rev'); assert.notEqual(run(root, 'setup.sh').status, 0);
    manifest('new', renamed, 'a'.repeat(40)); assert.notEqual(run(root, 'setup.sh').status, 0); assert.equal(existsSync(join(root, '.vendor', 'new')), false);
    manifest('new', renamed, rev); writeFileSync(join(root, 'skill-sources.json'), JSON.stringify([{ name: 'new', url: renamed, rev, paths: ['../escape'] }]));
    assert.notEqual(run(root, 'setup.sh').status, 0); assert.equal(existsSync(join(root, '.vendor', 'new')), false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
test('setup refuses failed Git status and edits during fetch', () => {
  const base = mkdtempSync(join(tmpdir(), 'profile status '));
  try {
    const origin = join(base, 'origin'); mkdirSync(origin); git(origin, 'init', '-q'); git(origin, 'config', 'user.email', 'test@example.com'); git(origin, 'config', 'user.name', 'Tester');
    mkdirSync(join(origin, 'skills', 'example'), { recursive: true });
    const source = join(origin, 'skills', 'example', 'SKILL.md'); writeFileSync(source, 'first');
    git(origin, 'add', '.'); git(origin, 'commit', '-qm', 'first'); const first = git(origin, 'rev-parse', 'HEAD');
    writeFileSync(source, 'second'); git(origin, 'add', '.'); git(origin, 'commit', '-qm', 'second'); const second = git(origin, 'rev-parse', 'HEAD');
    const root = join(base, 'profile with spaces'); mkdirSync(join(root, 'scripts'), { recursive: true }); cpSync(join(scripts, 'setup.sh'), join(root, 'scripts', 'setup.sh'));
    const manifest = (rev: string) => writeFileSync(join(root, 'skill-sources.json'), JSON.stringify([{ name: 'example', url: origin, rev, paths: ['skills/example'] }]));
    manifest(first); assert.equal(run(root, 'setup.sh').status, 0);
    const dest = join(root, '.vendor', 'example'); const skill = join(dest, 'skills', 'example', 'SKILL.md');
    writeFileSync(skill, 'preserve corrupt-index edit'); writeFileSync(join(dest, '.git', 'index'), 'corrupt');
    manifest(second);
    assert.notEqual(run(root, 'setup.sh').status, 0, 'failed status accepted');
    assert.equal(readFileSync(skill, 'utf8'), 'preserve corrupt-index edit');
    assert.equal(git(dest, 'rev-parse', 'HEAD'), first);
    rmSync(join(dest, '.git', 'index')); git(dest, 'reset', '--hard', '--quiet');
    const bin = join(base, 'bin'); mkdirSync(bin);
    writeFileSync(join(bin, 'git'), `#!/bin/sh
if [ "$3" = fetch ]; then printf '%s' 'preserve fetch-time edit' > "$INJECT_SKILL"; fi
exec ${JSON.stringify(execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim())} "$@"
`); chmodSync(join(bin, 'git'), 0o755);
    const result = run(root, 'setup.sh', { ...process.env, PATH: `${bin}:${process.env.PATH}`, INJECT_SKILL: skill });
    assert.notEqual(result.status, 0, 'fetch-time edit was replaced');
    assert.equal(readFileSync(skill, 'utf8'), 'preserve fetch-time edit');
    assert.equal(git(dest, 'rev-parse', 'HEAD'), first);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
test('run forwards argv and isolates runtime while capturing caller XDG', () => {
  const base = mkdtempSync(join(tmpdir(), 'profile run '));
  try {
    const bin = join(base, 'bin'); mkdirSync(bin); writeFileSync(join(bin, 'opencode'), '#!/bin/sh\nnode -e "console.log(JSON.stringify({argv:process.argv.slice(1),env:process.env}))" -- "$@"\n'); chmodSync(join(bin, 'opencode'), 0o755);
    const roots = [join(base, 'first profile'), join(base, 'second profile')];
    const result = roots.map(root => {
      mkdirSync(join(root, 'scripts'), { recursive: true }); cpSync(join(scripts, 'setup.sh'), join(root, 'scripts', 'setup.sh')); cpSync(join(scripts, 'run.sh'), join(root, 'scripts', 'run.sh'));
      writeFileSync(join(root, 'skill-sources.json'), '[]');
      const r = run(root, 'run.sh', { ...process.env, PATH: `${bin}:${process.env.PATH}`, XDG_CONFIG_HOME: '/caller config', OPENCODE_CONFIG: '/wrong', OPENCODE_DB: '/wrong' }, 'debug', 'space arg');
      assert.equal(r.status, 0, r.stderr); const parsed = JSON.parse(r.stdout); assert.deepEqual(parsed.argv, ['debug', 'space arg']);
      assert.equal(parsed.env.OPENCODE_PROFILE_XDG_CONFIG_HOME, '/caller config'); assert.equal(parsed.env.OPENCODE_CONFIG, undefined); assert.equal(parsed.env.OPENCODE_DB, undefined);
      for (const part of ['CONFIG', 'DATA', 'STATE', 'CACHE']) assert.equal(parsed.env[`XDG_${part}_HOME`], join(root, '.runtime', part.toLowerCase()));
      return parsed.env.XDG_DATA_HOME;
    }); assert.notEqual(result[0], result[1]);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
