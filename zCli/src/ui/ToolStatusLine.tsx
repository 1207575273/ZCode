// src/ui/ToolStatusLine.tsx

/**
 * ToolStatusLine — 单条工具执行状态行。
 *
 * 在 ChatView 中展示 AgentLoop 工具调用的实时状态：
 *   running → 旋转动画 + 工具动作描述
 *   done    → 绿色 ✓ + 耗时
 *   error   → 红色 ✗
 */

import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'

/** 工具执行事件，由 useChat 维护并传递给 ChatView */
export interface ToolEvent {
  id: string
  toolName: string
  /** 工具调用参数，可用于未来展示操作摘要 */
  args?: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  /** 仅 done/error 状态有值 */
  durationMs?: number
}

/** 工具名 → 人类友好的进行时描述（如 "read_file" → "Reading"） */
const TOOL_LABELS: Record<string, string> = {
  read_file: 'Reading',
  write_file: 'Writing',
  edit_file: 'Editing',
  glob: 'Searching files',
  grep: 'Searching content',
  bash: 'Running',
}

/** 返回工具的人类友好描述，未知工具直接用原名。 */
function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name
}

/** 渲染单条工具状态行，根据 status 字段切换样式。 */
export function ToolStatusLine({ event }: { event: ToolEvent }) {
  if (event.status === 'running') {
    return (
      <Box paddingLeft={1}>
        <Box marginRight={1}><Spinner type="dots" /></Box>
        <Text dimColor>{toolLabel(event.toolName)} {event.toolName}...</Text>
      </Box>
    )
  }

  const icon = event.status === 'done' ? '✓' : '✗'
  const color = event.status === 'done' ? 'green' : 'red'
  const duration = event.durationMs != null ? ` (${event.durationMs}ms)` : ''

  return (
    <Box paddingLeft={1}>
      <Text color={color}>{icon} {event.toolName}{duration}</Text>
    </Box>
  )
}
