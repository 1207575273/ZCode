import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock LangChain BEFORE importing provider
vi.mock('@langchain/anthropic', () => {
  const makeChunk = (content: string) => ({
    content,
    tool_calls: [] as unknown[],
    concat(other: { content: string; tool_calls: unknown[] }) {
      return makeChunk(this.content + other.content)
    },
  })
  const mockStream = async function* () {
    yield makeChunk('hello ')
    yield makeChunk('world')
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

  it('chat 带 tools 时返回 tool_call chunk', async () => {
    // 重新 mock，让 stream 返回带 tool_calls 的 chunk
    const { ChatAnthropic } = await import('@langchain/anthropic')
    const mockChunkWithTool = {
      content: '',
      tool_calls: [{ name: 'read_file', args: { path: 'foo.ts' }, id: 'call_1' }],
      concat: (_other: unknown) => mockChunkWithTool,
    }
    vi.mocked(ChatAnthropic).mockImplementationOnce(function () {
      return {
        bindTools: vi.fn().mockReturnThis(),
        stream: vi.fn().mockImplementation(async function* () {
          yield mockChunkWithTool
        }),
        getNumTokens: vi.fn().mockResolvedValue(5),
      } as unknown as InstanceType<typeof ChatAnthropic>
    })

    const req: ChatRequest = {
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'read foo.ts' }],
      tools: [{ name: 'read_file', description: 'read', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } }],
    }
    const chunks = []
    for await (const chunk of provider.chat(req)) {
      chunks.push(chunk)
    }
    const toolChunks = chunks.filter(c => c.type === 'tool_call')
    expect(toolChunks).toHaveLength(1)
    expect((toolChunks[0] as { type: string; toolCall?: { toolName: string } })?.toolCall?.toolName).toBe('read_file')
  })
})
