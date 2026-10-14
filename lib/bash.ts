import { execFileSync } from 'node:child_process';

// ponytail: string matching, not shell parsing; aliases/indirection bypass it. Use constrained credentials for real protection.
const TOOL = '(?:terraform|tofu)';
const BEFORE = '(^|[\\s;&|(`])';
const AFTER = '(?=[\\s;&|)`]|$)';
const DENIED = [
  new RegExp(`${BEFORE}${TOOL}(?: -\\S+)* destroy${AFTER}`),
  new RegExp(`${BEFORE}${TOOL}(?: -\\S+)* apply(?: [^\\s;&|]+)* -destroy\\b`),
];
export function denyReason(command: string): string | undefined {
  const normalized = command.replace(/["'\\]/g, '').replace(/\s+/g, ' ');
  for (const pattern of DENIED) {
    const hit = pattern.exec(normalized);
    if (hit) return `${/(?:terraform|tofu)/.exec(hit[0])?.[0]} destroy is denied by this profile. Run it yourself if intended.`;
  }
}
export function rtkRewrite(command: string): string | undefined {
  try {
    const stdout = execFileSync('rtk', ['hook', 'claude'], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
      encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'],
    });
    const rewritten = JSON.parse(stdout)?.hookSpecificOutput?.updatedInput?.command;
    return typeof rewritten === 'string' && rewritten !== command ? rewritten : undefined;
  } catch { return undefined; }
}
