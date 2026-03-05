// src/ui/InputBar.tsx
import React, { useState } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'

const SEPARATOR_WIDTH = 60

interface InputBarProps {
  onSubmit: (value: string) => void
  placeholder?: string
}

export function InputBar({ onSubmit, placeholder = 'Try "how does <filepath> work?"' }: InputBarProps) {
  const [value, setValue] = useState('')

  function handleSubmit(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{'─'.repeat(SEPARATOR_WIDTH)}</Text>
      </Box>
      <Box paddingLeft={1}>
        <Text color="green">❯ </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      </Box>
    </Box>
  )
}
