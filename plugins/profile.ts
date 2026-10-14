import { denyReason, rtkRewrite } from '../lib/bash.ts';

export default async function profile() {
  return {
    'tool.execute.before': async (input: { tool: string }, output: { args: { command: string } }) => {
      if (input.tool !== 'bash') return;
      const reason = denyReason(output.args.command);
      if (reason) throw new Error(reason);
      const rewritten = rtkRewrite(output.args.command);
      if (!rewritten) return;
      const rewrittenReason = denyReason(rewritten);
      if (rewrittenReason) throw new Error(rewrittenReason);
      output.args.command = rewritten;
    },
    'shell.env': async (_input: unknown, output: { env: Record<string, string> }) => {
      for (const part of ['CONFIG', 'DATA', 'STATE', 'CACHE']) {
        const original = process.env[`OPENCODE_PROFILE_XDG_${part}_HOME`];
        if (original) output.env[`XDG_${part}_HOME`] = original;
      }
    },
  };
}
