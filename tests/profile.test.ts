import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import profile from '../plugins/profile.ts';

const hooks = await profile();
const before = hooks['tool.execute.before'];
test('native bash guard rejects destroy including quotes, flags and apply; plan remains allowed', async () => {
  for (const command of ['terraform destroy', 'tofu -chdir=infra destroy', 'terraform "des""troy"', 'terraform apply -destroy'])
    await assert.rejects(before({ tool: 'bash' }, { args: { command } }), /denied/);
  const output = { args: { command: 'terraform plan -destroy' } };
  await before({ tool: 'bash' }, output);
  assert.match(output.args.command, /terraform plan -destroy$/);
});
test('rtk protocol, rewrite guard, fallback and non-bash', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rtk-test-'));
  const old = process.env.PATH;
  try {
    writeFileSync(join(dir, 'rtk'), '#!/bin/sh\ncat > "$RTK_INPUT"\nprintf "%s" "$RTK_OUTPUT"\n');
    chmodSync(join(dir, 'rtk'), 0o755);
    process.env.PATH = `${dir}:${old}`;
    process.env.RTK_INPUT = join(dir, 'input');
    process.env.RTK_OUTPUT = JSON.stringify({ hookSpecificOutput: { updatedInput: { command: 'rtk git status' } } });
    const output = { args: { command: 'git status' } };
    await before({ tool: 'bash' }, output);
    assert.equal(output.args.command, 'rtk git status');
    assert.deepEqual(JSON.parse((await import('node:fs')).readFileSync(process.env.RTK_INPUT, 'utf8')), { tool_name: 'Bash', tool_input: { command: 'git status' } });
    process.env.RTK_OUTPUT = JSON.stringify({ hookSpecificOutput: { updatedInput: { command: 'terraform destroy' } } });
    await assert.rejects(before({ tool: 'bash' }, { args: { command: 'git status' } }), /denied/);
    process.env.RTK_OUTPUT = '{broken';
    const unchanged = { args: { command: 'git status' } };
    await before({ tool: 'bash' }, unchanged);
    assert.equal(unchanged.args.command, 'git status');
    for (const reply of ['', JSON.stringify({ hookSpecificOutput: { updatedInput: { command: 'git status' } } })]) {
      process.env.RTK_OUTPUT = reply;
      const fallback = { args: { command: 'git status' } };
      await before({ tool: 'bash' }, fallback);
      assert.equal(fallback.args.command, 'git status');
    }
    process.env.PATH = dir;
    rmSync(join(dir, 'rtk'));
    const missing = { args: { command: 'git status' } };
    await before({ tool: 'bash' }, missing);
    assert.equal(missing.args.command, 'git status');
    const nonbash = { args: { command: 'terraform destroy' } };
    await before({ tool: 'read' }, nonbash);
    assert.equal(nonbash.args.command, 'terraform destroy');
  } finally { process.env.PATH = old; delete process.env.RTK_INPUT; delete process.env.RTK_OUTPUT; rmSync(dir, { recursive: true }); }
});
test('shell.env restores caller settings without replacing other variables', async () => {
  process.env.OPENCODE_PROFILE_XDG_CONFIG_HOME = '/caller/config';
  const output = { env: { OTHER: 'keep', XDG_CONFIG_HOME: '/profile/config' } };
  await hooks['shell.env']({}, output);
  assert.deepEqual(output.env, { OTHER: 'keep', XDG_CONFIG_HOME: '/caller/config' });
  delete process.env.OPENCODE_PROFILE_XDG_CONFIG_HOME;
});
