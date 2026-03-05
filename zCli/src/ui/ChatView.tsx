// src/ui/ChatView.tsx
import React from 'react'
import { Box, Text } from 'ink'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatViewProps {
  messages: ChatMessage[]
}

export function ChatView({ messages }: ChatViewProps) {
  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1} flexDirection="column">
          <Text color={msg.role === 'user' ? 'green' : 'cyan'} bold>
            {msg.role === 'user' ? '> 你' : '◆ ZCli'}
          </Text>
          <Text>{msg.content}</Text>
        </Box>
      ))}
    </Box>
  )
}
