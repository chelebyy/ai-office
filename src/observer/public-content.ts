import { parse } from 'acorn';
import type { PendingQuestion, ToolAction } from '../shared/contract.ts';

type Data = Record<string, unknown>;
const object = (value: unknown): Data =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Data) : {};
const string = (value: unknown) => (typeof value === 'string' ? value : '');

/** Only explicitly public messages and bounded, allowlisted action fields cross this boundary. */
export function publicText(value: unknown, limit = 1200): string {
  return string(value)
    .replace(/<oai-mem-citation>[\s\S]*?<\/oai-mem-citation>/g, '')
    .replace(/(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{12,}/g, '[redacted]')
    .replace(/(bearer\s+)[A-Za-z0-9._~+\/-]{8,}/gi, '$1[redacted]')
    .replace(
      /((?:api[_-]?key|password|passwd|secret|access[_-]?token|authorization)["']?\s*[=:]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi,
      '$1[redacted]',
    )
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, limit);
}

export function jsonObject(value: unknown): Data {
  if (typeof value !== 'string' || value.length > 131072) return {};
  try {
    return object(JSON.parse(value));
  } catch {
    return {};
  }
}

export function questionsFromCall(name: string, args: unknown, callId: string): PendingQuestion[] {
  if (!/(?:^|[.:])(?:request_user_input|ask_user)(?:_async)?$/i.test(name)) return [];
  const questions = jsonObject(args).questions;
  if (!Array.isArray(questions)) return [];
  return questions.slice(0, 3).flatMap((value, index) => {
    const q = object(value);
    const title = publicText(q.question ?? q.title, 1600).trim();
    if (!title) return [];
    return [
      {
        id: `${callId}:${index}`,
        callId,
        index,
        title,
        options: (Array.isArray(q.options) ? q.options : [])
          .slice(0, 6)
          .map((option) => {
            const item = object(option);
            return publicText(typeof option === 'string' ? option : item.label, 400).trim();
          })
          .filter(Boolean),
        asynchronous: /_async$/i.test(name),
      },
    ];
  });
}

/** A plain follow-up retires the old async card; it does not prove an answer was given. */
export function isQuestionFollowup(message: string): boolean {
  const request = message
    .split(/^## My request:\s*$/m)
    .at(-1)!
    .replace(/<in-app-browser-context\b[^>]*>[\s\S]*?<\/in-app-browser-context>/gi, '')
    .trim();
  // Structured replies are handled by ID, including partial/malformed envelopes.
  // Context and attachment headers alone are not a new user instruction.
  return (
    !!request &&
    !request.startsWith('<') &&
    !/^# (?:Files (?:mentioned|pasted) by the user:|AGENTS\.md instructions)/.test(request)
  );
}

/** Match explicit answers by ID without interpreting their free-text meaning. */
export function answeredQuestionIds(message: string): Set<string> {
  const body = message.match(
    /^\s*<send_user_message_question_reply>\s*([\s\S]*?)\s*<\/send_user_message_question_reply>\s*$/,
  )?.[1];
  if (!body || body.length > 32768) return new Set();
  try {
    const replies: unknown = JSON.parse(body);
    if (!Array.isArray(replies)) return new Set();
    return new Set(
      replies.slice(0, 20).flatMap((value) => {
        const reply = object(value);
        if (typeof reply.answer !== 'string') return [];
        try {
          const id: unknown = JSON.parse(string(reply.questionItemId));
          return Array.isArray(id) &&
            /^(?:request_user_input|ask_user)(?:_async)?$/.test(string(id[0])) &&
            /^[\w.:-]{1,160}$/.test(string(id[1])) &&
            Number.isInteger(id[2]) &&
            id[2] >= 0 &&
            id[2] < 3
            ? [`${id[1]}:${id[2]}`]
            : [];
        } catch {
          return [];
        }
      }),
    );
  } catch {
    return new Set();
  }
}

function fileName(value: unknown) {
  return publicText(string(value).replace(/\\/g, '/').split('/').pop(), 120);
}

function actions(name: string, args: Data, raw?: string): ToolAction[] {
  if (/(?:^|[._:])(?:exec_command|run_command)$/.test(name)) {
    const detail = publicText(args.cmd ?? args.command, 600).trim();
    return [{ kind: 'command', toolName: name, ...(detail ? { detail } : {}) }];
  }
  if (/(?:^|[._:])apply_patch$/.test(name)) {
    return (raw ?? string(args.patch))
      .split('\n')
      .flatMap((line) => {
        const match = line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/);
        return match
          ? [
              {
                kind: ({ Add: 'create', Update: 'edit', Delete: 'delete' } as const)[
                  match[1] as 'Add'
                ],
                toolName: name,
                detail: fileName(match[2]),
              },
            ]
          : [];
      })
      .slice(0, 12);
  }
  if (
    /replace_content|replace_symbol|insert_before|insert_after|write_file|create_text_file/.test(
      name,
    )
  )
    return [
      {
        kind: /create|write_file/.test(name) ? 'create' : 'edit',
        toolName: name,
        detail: fileName(args.relative_path ?? args.path ?? args.file_path),
      },
    ];
  if (/read_file|read_text|read_thread_terminal|view_image/.test(name))
    return [
      {
        kind: 'read',
        toolName: name,
        detail: fileName(args.relative_path ?? args.path ?? args.file_path),
      },
    ];
  return [{ kind: 'tool', toolName: name }];
}

// No evaluation, string interpolation, variable resolution or raw script projection.
function literal(node: unknown): string | undefined {
  const n = object(node);
  if (n.type === 'Literal' && typeof n.value === 'string') return n.value;
  if (n.type === 'TemplateLiteral' && Array.isArray(n.expressions) && !n.expressions.length) {
    return (n.quasis as unknown[]).map((q) => string(object(object(q).value).cooked)).join('');
  }
  return undefined;
}
function literalObject(node: unknown): Data {
  const n = object(node);
  if (n.type !== 'ObjectExpression' || !Array.isArray(n.properties)) return {};
  const result: Data = {};
  for (const value of n.properties) {
    const p = object(value),
      key = object(p.key);
    if (p.type !== 'Property' || p.computed || p.method || p.kind !== 'init') continue;
    const name = string(key.name ?? key.value);
    if (['cmd', 'command', 'relative_path', 'path', 'file_path', 'patch'].includes(name))
      result[name] = literal(p.value);
  }
  return result;
}

export function toolActions(name: string, args: unknown, input: unknown): ToolAction[] {
  if (!/(?:^|[.:])exec$/.test(name))
    return actions(name, jsonObject(args), typeof input === 'string' ? input : undefined);
  const script = string(input);
  if (!script || script.length > 131072) return [];
  try {
    const tree = parse(script, { ecmaVersion: 'latest', sourceType: 'module' });
    const result: ToolAction[] = [];
    const queue: unknown[] = [tree];
    let visited = 0;
    while (queue.length && visited++ < 12000 && result.length < 12) {
      const n = object(queue.pop());
      // Deferred functions and conditional branches are not proof of invocation.
      if (
        [
          'FunctionExpression',
          'ArrowFunctionExpression',
          'FunctionDeclaration',
          'IfStatement',
          'ConditionalExpression',
        ].includes(string(n.type))
      )
        continue;
      if (n.type === 'CallExpression') {
        const callee = object(n.callee);
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          object(callee.object).name === 'tools'
        ) {
          const tool = string(object(callee.property).name);
          const arg = Array.isArray(n.arguments) ? n.arguments[0] : undefined;
          if (/^[\w.:-]{1,120}$/.test(tool))
            result.push(
              ...actions(tool, literalObject(arg), literal(arg)).map((a) => ({
                ...a,
                nested: true,
              })),
            );
        }
      }
      const children = Object.values(n)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value) => object(value).type);
      queue.push(...children.reverse());
    }
    return result.slice(0, 12);
  } catch {
    return [];
  }
}
