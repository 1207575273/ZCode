// src/ui/ChatView.tsx
import React from 'react'
import { Box, Text } from 'ink'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const ROLE_CONFIG = {
  user: { color: 'green' as const, label: '> 你' },
  assistant: { color: 'cyan' as const, label: '◆ ZCli' },
} as const

interface ChatViewProps {
  messages: ChatMessage[]
}

export function ChatView({ messages }: ChatViewProps) {
  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      {messages.map((msg) => (
        <Box key={msg.id} marginBottom={1} flexDirection="column">
          <Text color={ROLE_CONFIG[msg.role].color} bold>
            {ROLE_CONFIG[msg.role].label}
          </Text>
          <Text>{msg.content}</Text>
        </Box>
      ))}
    </Box>
  )
}
