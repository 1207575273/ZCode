// src/ui/ToolStatusLine.tsx
import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'

export interface ToolEvent {
  id: string
  toolName: string
  args?: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  durationMs?: number
}

// 工具名 → 人类友好的动作描述
const TOOL_LABELS: Record<string, string> = {
  read_file: 'Reading',
  write_file: 'Writing',
  edit_file: 'Editing',
  glob: 'Searching files',
  grep: 'Searching content',
  bash: 'Running',
}

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name
}

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
