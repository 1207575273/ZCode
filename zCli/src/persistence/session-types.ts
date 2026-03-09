// src/persistence/session-types.ts

import type { TokenUsage, MessageContent } from '@core/types.js'

export type SessionEventType =
  | 'session_start'
  | 'session_resume'
  | 'user'
  | 'assistant'
  | 'system'
  | 'tool_call'
  | 'tool_result'
  | 'turn_duration'

export interface SessionEvent {
  sessionId: string
  type: SessionEventType
  timestamp: string // ISO 8601
  uuid: string // 本条事件 ID
  parentUuid: string | null // 上一条事件 ID
  cwd: string
  gitBranch?: string
  message?: {
    role: string
    content: string | MessageContent[]
    model?: string
    usage?: TokenUsage
  }
  provider?: string
  model?: string
  toolCallId?: string
  toolName?: string
  args?: Record<string, unknown>
  result?: string
  isError?: boolean
  error?: string
  durationMs?: number
}

export interface SessionSnapshot {
  sessionId: string
  provider: string
  model: string
  cwd: string
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>
  /** 当前分支的叶节点 UUID */
  leafEventUuid: string | null
}

/** 分支信息，每个叶节点代表一个分支 */
export interface BranchInfo {
  /** 分支末端事件 UUID */
  leafEventUuid: string
  /** 分支末尾消息预览（截断） */
  lastMessage: string
  /** 该分支上 user+assistant 消息数 */
  messageCount: number
  /** 叶节点时间戳 */
  updatedAt: string
  /** 分叉点事件 UUID（与主干分开的位置，主干无分叉点） */
  forkPoint: string | null
}

export interface SessionSummary {
  sessionId: string
  projectSlug: string
  firstMessage: string
  updatedAt: string
  gitBranch: string
  fileSize: number
  filePath: string
}
