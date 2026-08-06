#!/usr/bin/env node
/**
 * claude-recovery session hook — reads Claude Code hook JSON from stdin.
 * Handles UserPromptSubmit, PreToolUse/PostToolUse (Bash), and SessionStart.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RECOVERY_DIR = '.claude/recovery';

function readStdin() {
  return readFileSync(0, 'utf8');
}

function recoveryRoot(cwd) {
  return join(cwd, RECOVERY_DIR);
}

function ensureRecoveryDir(cwd) {
  const root = recoveryRoot(cwd);
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

function appendJsonl(filePath, record) {
  appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function handleUserPromptSubmit(input) {
  const cwd = input.cwd;
  if (!cwd) return;
  ensureRecoveryDir(cwd);
  appendJsonl(join(recoveryRoot(cwd), 'prompts.jsonl'), {
    label: 'Observed evidence',
    timestamp: nowIso(),
    sessionId: input.session_id ?? null,
    prompt: input.prompt ?? '',
  });
}

function handlePreToolUse(input) {
  if (input.tool_name !== 'Bash') return;
  const cwd = input.cwd;
  if (!cwd) return;
  ensureRecoveryDir(cwd);
  const command = input.tool_input?.command ?? '';
  appendJsonl(join(recoveryRoot(cwd), 'commands.jsonl'), {
    label: 'Observed evidence',
    phase: 'pre',
    timestamp: nowIso(),
    sessionId: input.session_id ?? null,
    command,
    toolUseId: input.tool_use_id ?? null,
  });
}

function handlePostToolUse(input) {
  if (input.tool_name !== 'Bash') return;
  const cwd = input.cwd;
  if (!cwd) return;
  ensureRecoveryDir(cwd);
  const response = input.tool_response ?? {};
  appendJsonl(join(recoveryRoot(cwd), 'commands.jsonl'), {
    label: 'Observed evidence',
    phase: 'post',
    timestamp: nowIso(),
    sessionId: input.session_id ?? null,
    command: input.tool_input?.command ?? '',
    stdout: response.stdout ?? '',
    stderr: response.stderr ?? '',
    interrupted: response.interrupted ?? false,
    durationMs: input.duration_ms ?? null,
  });
}

function handleSessionStart(input) {
  const source = input.source ?? '';
  if (source !== 'startup') {
    return;
  }

  const cwd = input.cwd;
  if (!cwd) return;

  const pendingPath = join(cwd, RECOVERY_DIR, 'pending-contract.json');
  if (!existsSync(pendingPath)) {
    return;
  }

  let pending;
  try {
    pending = JSON.parse(readFileSync(pendingPath, 'utf8'));
  } catch {
    return;
  }

  if (!pending.approved) {
    return;
  }

  if (pending.injectedAt) {
    return;
  }

  const contractText = pending.contractText ?? pending.continuationContext ?? '';
  if (!contractText) {
    return;
  }

  pending.injectedAt = nowIso();
  pending.injectedFrom = pendingPath;
  writeFileSync(pendingPath, `${JSON.stringify(pending, null, 2)}\n`, 'utf8');

  const auditPath = join(recoveryRoot(cwd), 'injection-audit.jsonl');
  ensureRecoveryDir(cwd);
  appendJsonl(auditPath, {
    label: 'Observed evidence',
    timestamp: pending.injectedAt,
    event: 'SessionStart',
    source,
    pendingContractPath: pendingPath,
    sessionId: input.session_id ?? null,
  });

  const worktreeName =
    pending.worktreeName ??
    (pending.worktreePath ? String(pending.worktreePath).split(/[/\\]/).pop() : null);
  const sessionTitle = worktreeName ? `recovery: ${worktreeName}` : 'recovery: approved contract';

  const additionalContext = [
    `Session title: ${sessionTitle}`,
    'Recovery Contract (approved by developer — User decision):',
    contractText,
    '',
    'Label guide: Observed evidence = Git/commands/tests/timestamps only.',
    'User decision = developer keep/discard/change choices.',
    'Inferred suggestion = optional grouping, never fact.',
  ].join('\n');

  // Emit only documented hook fields for compatibility. Session title is carried
  // in additionalContext so older Claude Code builds ignore unknown keys safely.
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext,
      },
    })}\n`,
  );
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin());
  } catch {
    process.exit(0);
  }

  const event = input.hook_event_name ?? '';

  switch (event) {
    case 'UserPromptSubmit':
      handleUserPromptSubmit(input);
      break;
    case 'PreToolUse':
      handlePreToolUse(input);
      break;
    case 'PostToolUse':
      handlePostToolUse(input);
      break;
    case 'SessionStart':
      handleSessionStart(input);
      break;
    default:
      break;
  }

  process.exit(0);
}

main();
