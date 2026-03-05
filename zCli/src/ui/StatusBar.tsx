// src/ui/StatusBar.tsx
import React from 'react'
import { Box, Text } from 'ink'

interface StatusBarProps {
  model: string
  provider: string
  sessionId: string
}

export function StatusBar({ model, provider, sessionId }: StatusBarProps) {
  return (
    <Box borderStyle="single" paddingX={1}>
      <Text color="green">⚡ {model}</Text>
      <Text> · </Text>
      <Text color="cyan">{provider}</Text>
      <Text> · </Text>
      <Text dimColor>session: {sessionId.slice(0, 16)}</Text>
    </Box>
  )
}
