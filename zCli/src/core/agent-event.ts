// src/core/agent-event.ts

/**
 * AgentLoop 事件流类型定义。
 *
 * AgentEvent 是 AgentLoop.run() 的 yield 类型，调用方（useChat）通过 for-await-of 消费。
 * 分为两类：
 *   1. 业务事件 — text / tool_start / tool_done / permission_request / error / done
 *   2. 观测事件 — llm_start / llm_usage / llm_error / tool_fallback / permission_grant
 *
 * 观测事件由 SessionLogger 消费，写入 JSONL；业务事件由 UI 层消费，驱动界面更新。
 */

// ── 业务事件：驱动 UI 和对话流程 ──

export interface TextEvent {
  type: 'text'
  text: string
}

export interface ToolStartEvent {
  type: 'tool_start'
  toolName: string
  toolCallId: string
  args: Record<string, unknown>
}

export interface ToolDoneEvent {
  type: 'tool_done'
  toolName: string
  toolCallId: string
  durationMs: number
  success: boolean
  resultSummary?: string
}

export interface PermissionRequestEvent {
  type: 'permission_request'
  toolName: string
  args: Record<string, unknown>
  /** 调用 resolve(true) 允许执行，resolve(false) 拒绝 */
  resolve: (allow: boolean) => void
}

export interface ErrorEvent {
  type: 'error'
  error: string
}

export interface DoneEvent {
  type: 'done'
}

// ── 观测事件：驱动日志记录（SessionLogger 消费） ──

export interface LlmStartEvent {
  type: 'llm_start'
  provider: string
  model: string
  messageCount: number
}

export interface LlmUsageEvent {
  type: 'llm_usage'
  inputTokens: number
  outputTokens: number
  /** 'end_turn' | 'max_tokens' | 'abort' */
  stopReason: string
}

export interface LlmErrorEvent {
  type: 'llm_error'
  error: string
  partialOutputTokens?: number
}

export interface ToolFallbackEvent {
  type: 'tool_fallback'
  toolName: string
  fromLevel: string
  toLevel: string
  reason: string
}

export interface PermissionGrantEvent {
  type: 'permission_grant'
  toolName: string
  always: boolean
}

// ── 联合类型 ──

export type AgentEvent =
  | TextEvent
  | ToolStartEvent
  | ToolDoneEvent
  | PermissionRequestEvent
  | ErrorEvent
  | DoneEvent
  | LlmStartEvent
  | LlmUsageEvent
  | LlmErrorEvent
  | ToolFallbackEvent
  | PermissionGrantEvent

// ── AgentLoop 配置 ──

export interface AgentConfig {
  model: string
  /** provider 名称，记录到 llm_start 事件 */
  provider: string
  signal?: AbortSignal
}
