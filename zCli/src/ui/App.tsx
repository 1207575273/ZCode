// src/ui/App.tsx
import React, { useState } from 'react'
import { randomUUID } from 'node:crypto'
import { Box, useApp } from 'ink'
import { WelcomeScreen } from './WelcomeScreen.js'
import { ChatView, type ChatMessage } from './ChatView.js'
import { InputBar } from './InputBar.js'

interface AppProps {
  model?: string
  provider?: string
  cwd?: string
}

export function App({
  model = 'claude-opus-4-6',
  provider = 'anthropic',
  cwd = process.cwd(),
}: AppProps) {
  const { exit } = useApp()
  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  function handleSubmit(text: string) {
    if (!text.trim()) return
    if (text === '/exit' || text === '/quit') {
      exit()
      return
    }
    const msg: ChatMessage = {
      id: randomUUID(),
      role: 'user',
      content: text,
    }
    setMessages(prev => [...prev, msg])
    if (!started) setStarted(true)
  }

  return (
    <Box flexDirection="column" width="100%">
      {started ? (
        <ChatView messages={messages} />
      ) : (
        <WelcomeScreen model={model} provider={provider} cwd={cwd} />
      )}
      <InputBar onSubmit={handleSubmit} />
    </Box>
  )
}
