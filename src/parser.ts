import type { NormalizedEvent, SegmentCategory } from "./types.ts";
import {
  assertRecord,
  isRecord,
  optionalString,
  requiredString,
  stringifyStable
} from "./validation.ts";

type HookKind = "PreToolUse" | "PostToolUse";

interface ParserState {
  nextTurn: number;
  source: "transcript" | "hook";
  toolNamesByUseId: Map<string, string>;
}

const FILE_PAYLOAD_FIELDS = [
  "content",
  "new_string",
  "old_string",
  "file_content",
  "patch"
] as const;

export function parseJsonlTranscript(input: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const state: ParserState = {
    nextTurn: 1,
    source: "transcript",
    toolNamesByUseId: new Map()
  };

  input
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (line.trim().length === 0) {
        return;
      }
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSON on line ${index + 1}: ${detail}`);
      }
      events.push(...normalizeTranscriptRecord(value, state));
    });

  return events;
}

export function normalizeHookPayload(
  kind: HookKind,
  payload: unknown
): NormalizedEvent[] {
  const state: ParserState = {
    nextTurn: 1,
    source: "hook",
    toolNamesByUseId: new Map()
  };
  const record = assertRecord(payload, `${kind} payload`);
  const toolName = readToolName(record);
  const timestamp = new Date().toISOString();

  if (kind === "PreToolUse") {
    const input = readRecordField(record, ["tool_input", "input"], "tool input");
    const events = [
      makeEvent(state, {
        timestamp,
        role: "assistant",
        category: "tool-args",
        content: argsWithoutLargePayload(input),
        toolName,
        metadata: { hook: kind }
      })
    ];
    const payloadEvent = filePayloadEvent(state, timestamp, toolName, input, kind);
    if (payloadEvent !== undefined) {
      events.push(payloadEvent);
    }
    return events;
  }

  const response =
    record.tool_response ?? record.response ?? record.tool_result ?? record.result ?? record;
  return [
    makeEvent(state, {
      timestamp,
      role: "tool",
      category: categoryForToolResult(toolName),
      content: resultToText(response),
      toolName,
      metadata: { hook: kind }
    })
  ];
}

function normalizeTranscriptRecord(
  value: unknown,
  state: ParserState
): NormalizedEvent[] {
  const record = assertRecord(value, "transcript record");
  const timestamp = optionalString(record.timestamp, "timestamp") ?? new Date(0).toISOString();

  if (typeof record.type === "string" && record.type.includes("ToolUse")) {
    return normalizeHookPayload(
      record.type === "PreToolUse" ? "PreToolUse" : "PostToolUse",
      record
    ).map((event) => ({
      ...event,
      turn: state.nextTurn++,
      source: "transcript",
      timestamp
    }));
  }

  const message = isRecord(record.message) ? record.message : record;
  if (message === record && record.role === undefined) {
    return [];
  }

  const role = requiredString(message.role, "role");
  if (!["system", "user", "assistant", "tool"].includes(role)) {
    throw new Error(`role must be one of system, user, assistant, or tool`);
  }

  const rawContent = message.content;
  const events: NormalizedEvent[] = [];

  if (typeof rawContent === "string") {
    events.push(
      makeEvent(state, {
        timestamp,
        role: role as NormalizedEvent["role"],
        category: categoryForRole(role),
        content: rawContent,
        metadata: {}
      })
    );
  } else if (Array.isArray(rawContent)) {
    for (const block of rawContent) {
      events.push(...normalizeContentBlock(block, role, timestamp, state));
    }
  } else if (rawContent !== undefined) {
    events.push(
      makeEvent(state, {
        timestamp,
        role: role as NormalizedEvent["role"],
        category: categoryForRole(role),
        content: stringifyStable(rawContent),
        metadata: {}
      })
    );
  }

  for (const call of arrayField(message, "tool_calls")) {
    events.push(...normalizeToolCall(call, timestamp, state));
  }
  for (const result of arrayField(message, "tool_results")) {
    events.push(normalizeToolResult(result, timestamp, state));
  }

  return events;
}

function normalizeContentBlock(
  block: unknown,
  role: string,
  timestamp: string,
  state: ParserState
): NormalizedEvent[] {
  if (typeof block === "string") {
    return [
      makeEvent(state, {
        timestamp,
        role: role as NormalizedEvent["role"],
        category: categoryForRole(role),
        content: block,
        metadata: {}
      })
    ];
  }

  const record = assertRecord(block, "content block");
  const type = optionalString(record.type, "content block type");
  if (type === "text") {
    return [
      makeEvent(state, {
        timestamp,
        role: role as NormalizedEvent["role"],
        category: categoryForRole(role),
        content: requiredString(record.text, "text content"),
        metadata: { blockType: type }
      })
    ];
  }
  if (type === "tool_use") {
    return normalizeToolCall(record, timestamp, state);
  }
  if (type === "tool_result") {
    return [normalizeToolResult(record, timestamp, state)];
  }

  return [
    makeEvent(state, {
      timestamp,
      role: role as NormalizedEvent["role"],
      category: categoryForRole(role),
      content: stringifyStable(record),
      metadata: { blockType: type ?? "unknown" }
    })
  ];
}

function normalizeToolCall(
  call: unknown,
  timestamp: string,
  state: ParserState
): NormalizedEvent[] {
  const record = assertRecord(call, "tool call");
  const toolName = readToolName(record);
  const toolUseId = optionalString(record.id, "tool use id");
  if (toolUseId !== undefined && toolName !== undefined) {
    state.toolNamesByUseId.set(toolUseId, toolName);
  }
  const input = readRecordField(record, ["input", "tool_input", "arguments"], "tool input");
  const metadata = { toolUseId };
  const events = [
    makeEvent(state, {
      timestamp,
      role: "assistant",
      category: "tool-args",
      content: argsWithoutLargePayload(input),
      toolName,
      metadata
    })
  ];
  const payloadEvent = filePayloadEvent(state, timestamp, toolName, input, "transcript");
  if (payloadEvent !== undefined) {
    events.push(payloadEvent);
  }
  return events;
}

function normalizeToolResult(
  result: unknown,
  timestamp: string,
  state: ParserState
): NormalizedEvent {
  const record = isRecord(result) ? result : { content: result };
  const toolUseId = optionalString(record.tool_use_id, "tool use id");
  const toolName =
    optionalString(record.tool_name ?? record.name, "tool name") ??
    (toolUseId === undefined ? undefined : state.toolNamesByUseId.get(toolUseId));
  return makeEvent(state, {
    timestamp,
    role: "tool",
    category: categoryForToolResult(toolName),
    content: resultToText(record.content ?? record.output ?? record.result ?? record),
    toolName,
    metadata: { toolUseId }
  });
}

function filePayloadEvent(
  state: ParserState,
  timestamp: string,
  toolName: string | undefined,
  input: Record<string, unknown>,
  origin: string
): NormalizedEvent | undefined {
  if (toolName !== "Write" && toolName !== "Edit" && toolName !== "MultiEdit") {
    return undefined;
  }

  const payload = extractFilePayload(input);
  if (payload === undefined) {
    return undefined;
  }

  return makeEvent(state, {
    timestamp,
    role: "tool",
    category: "file-payloads",
    content: payload.content,
    toolName,
    metadata: {
      origin,
      filePath: payload.filePath,
      fieldPath: payload.fieldPath
    }
  });
}

function extractFilePayload(input: Record<string, unknown>):
  | { content: string; filePath?: string; fieldPath: string }
  | undefined {
  for (const field of FILE_PAYLOAD_FIELDS) {
    const value = input[field];
    if (typeof value === "string" && value.length > 0) {
      const payload: { content: string; filePath?: string; fieldPath: string } = {
        content: value,
        fieldPath: `input.${field}`
      };
      const filePath = optionalFilePath(input);
      if (filePath !== undefined) {
        payload.filePath = filePath;
      }
      return payload;
    }
  }

  if (Array.isArray(input.edits)) {
    const pieces = input.edits
      .filter(isRecord)
      .flatMap((edit, index) =>
        FILE_PAYLOAD_FIELDS.map((field) => {
          const value = edit[field];
          return typeof value === "string"
            ? `# edit ${index + 1} ${field}\n${value}`
            : "";
        }).filter(Boolean)
      );
    if (pieces.length > 0) {
      const payload: { content: string; filePath?: string; fieldPath: string } = {
        content: pieces.join("\n\n"),
        fieldPath: "input.edits"
      };
      const filePath = optionalFilePath(input);
      if (filePath !== undefined) {
        payload.filePath = filePath;
      }
      return payload;
    }
  }

  return undefined;
}

function argsWithoutLargePayload(input: Record<string, unknown>): string {
  const copy: Record<string, unknown> = { ...input };
  for (const field of FILE_PAYLOAD_FIELDS) {
    if (typeof copy[field] === "string") {
      copy[field] = `[captured separately: ${String(copy[field]).length} chars]`;
    }
  }
  if (Array.isArray(copy.edits)) {
    copy.edits = copy.edits.map((item) => {
      if (!isRecord(item)) {
        return item;
      }
      const edit = { ...item };
      for (const field of FILE_PAYLOAD_FIELDS) {
        if (typeof edit[field] === "string") {
          edit[field] = `[captured separately: ${String(edit[field]).length} chars]`;
        }
      }
      return edit;
    });
  }
  return stringifyStable(copy);
}

function resultToText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (isRecord(item) && typeof item.text === "string") {
          return item.text;
        }
        return stringifyStable(item);
      })
      .join("\n");
  }
  return stringifyStable(value);
}

function readToolName(record: Record<string, unknown>): string | undefined {
  return optionalString(record.tool_name ?? record.name, "tool name");
}

function readRecordField(
  record: Record<string, unknown>,
  names: string[],
  label: string
): Record<string, unknown> {
  for (const name of names) {
    const value = record[name];
    if (isRecord(value)) {
      return value;
    }
  }
  return assertRecord({}, label);
}

function categoryForRole(role: string): SegmentCategory {
  if (role === "system") {
    return "system";
  }
  if (role === "assistant") {
    return "assistant-reasoning";
  }
  if (role === "tool") {
    return "tool-result";
  }
  return "user";
}

function categoryForToolResult(toolName: string | undefined): SegmentCategory {
  if (toolName?.toLowerCase().startsWith("mcp")) {
    return "mcp-output";
  }
  return "tool-result";
}

function optionalFilePath(input: Record<string, unknown>): string | undefined {
  return optionalString(input.file_path ?? input.path, "file path");
}

function arrayField(record: Record<string, unknown>, field: string): unknown[] {
  const value = record[field];
  return Array.isArray(value) ? value : [];
}

function makeEvent(
  state: ParserState,
  input: Omit<NormalizedEvent, "id" | "turn" | "source" | "toolName" | "tokens"> & {
    toolName?: string | undefined;
  }
): NormalizedEvent {
  const turn = state.nextTurn++;
  const event: NormalizedEvent = {
    id: `${state.source}-${turn}`,
    turn,
    source: state.source,
    timestamp: input.timestamp,
    role: input.role,
    category: input.category,
    content: input.content,
    metadata: input.metadata
  };
  if (input.toolName !== undefined) {
    event.toolName = input.toolName;
  }
  return event;
}
