// src/ui/PermissionDialog.tsx
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTerminalSize } from './useTerminalSize.js'

interface PermissionDialogProps {
  toolName: string
  args: Record<string, unknown>
  onResolve: (allow: boolean, always?: boolean) => void
}

const OPTIONS = [
  { label: 'Yes', value: 'yes' as const },
  { label: "Yes, and don't ask again", value: 'always' as const },
  { label: 'No', value: 'no' as const },
]

const TOOL_TITLES: Record<string, string> = {
  bash: 'Bash command',
  write_file: 'Write file',
  edit_file: 'Edit file',
}

function formatPreview(toolName: string, args: Record<string, unknown>): string {
  if (toolName === 'bash') return String(args['command'] ?? '')
  if (toolName === 'write_file') return `${args['path']} (${String(args['content'] ?? '').length} chars)`
  if (toolName === 'edit_file') return String(args['path'] ?? '')
  return JSON.stringify(args)
}

export function PermissionDialog({ toolName, args, onResolve }: PermissionDialogProps) {
  const [selected, setSelected] = useState(0)
  const { columns } = useTerminalSize()

  useInput((_input, key) => {
    if (key.upArrow) setSelected(s => Math.max(0, s - 1))
    if (key.downArrow) setSelected(s => Math.min(OPTIONS.length - 1, s + 1))
    if (key.return) {
      const choice = OPTIONS[selected]?.value
      if (choice === 'yes') onResolve(true, false)
      else if (choice === 'always') onResolve(true, true)
      else onResolve(false, false)
    }
    if (key.escape) onResolve(false, false)
  })

  const title = TOOL_TITLES[toolName] ?? toolName
  const preview = formatPreview(toolName, args)

  return (
    <Box flexDirection="column" width={columns}>
      <Box>
        <Text dimColor>{'─'.repeat(columns)}</Text>
      </Box>
      <Box paddingX={2} flexDirection="column">
        <Text bold color="yellow">{title}</Text>
        <Box marginY={1} paddingLeft={2}>
          <Text dimColor>{preview}</Text>
        </Box>
        <Text>Do you want to proceed?</Text>
        {OPTIONS.map((opt, i) => (
          <Box key={opt.value} paddingLeft={1}>
            {i === selected
              ? <Text color="cyan">{'❯ '}{i + 1}. {opt.label}</Text>
              : <Text>{'  '}{i + 1}. {opt.label}</Text>
            }
          </Box>
        ))}
      </Box>
    </Box>
  )
}
