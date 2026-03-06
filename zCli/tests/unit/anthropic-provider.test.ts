import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock LangChain BEFORE importing provider
vi.mock('@langchain/anthropic', () => {
  const mockStream = async function* () {
    yield { content: 'hello ' }
    yield { content: 'world' }
  }
  return {
    ChatAnthropic: vi.fn().mockImplementation(function () {
      return {
        stream: vi.fn().mockImplementation(mockStream),
        getNumTokens: vi.fn().mockResolvedValue(10),
      }
    }),
  }
})

import { AnthropicProvider } from '@providers/anthropic.js'
import type { ChatRequest } from '@providers/provider.js'

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider

  beforeEach(() => {
    provider = new AnthropicProvider({
      apiKey: 'sk-test',
      models: ['claude-sonnet-4-6'],
    })
  })

  it('name 和 protocol 正确', () => {
    expect(provider.name).toBe('anthropic')
    expect(provider.protocol).toBe('native-anthropic')
  })

  it('isModelSupported 仅匹配配置的模型', () => {
    expect(provider.isModelSupported('claude-sonnet-4-6')).toBe(true)
    expect(provider.isModelSupported('gpt-4o')).toBe(false)
  })

  it('chat 流式返回 text chunks 和 done', async () => {
    const req: ChatRequest = {
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'hi' }],
    }
    const chunks = []
    for await (const chunk of provider.chat(req)) {
      chunks.push(chunk)
    }
    const textChunks = chunks.filter(c => c.type === 'text')
    const doneChunks = chunks.filter(c => c.type === 'done')
    expect(textChunks.length).toBeGreaterThan(0)
    expect(doneChunks).toHaveLength(1)
    const fullText = textChunks.map(c => c.text).join('')
    expect(fullText).toBe('hello world')
  })
})
