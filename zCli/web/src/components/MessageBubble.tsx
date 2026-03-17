// src/components/MessageBubble.tsx

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { ToolStatus } from './ToolStatus'
import type { ChatMessage } from '../types'

interface Props {
  message: ChatMessage
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const sourceTag = message.source === 'web' ? ' (web)' : message.source === 'cli' ? ' (cli)' : ''

  if (message.role === 'assistant') {
    console.log('[MessageBubble] rendering assistant msg:', message.id, 'content length:', message.content.length, 'first 100:', message.content.slice(0, 100))
  }

  if (isSystem && message.toolEvents && message.toolEvents.length > 0) {
    return (
      <div className="mb-2 px-2">
        <ToolStatus events={message.toolEvents} />
      </div>
    )
  }

  if (isSystem) {
    return (
      <div className="mb-3 px-2">
        <span className="text-xs text-gray-500">{message.content}</span>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
        isUser ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'
      }`}>
        {/* 来源标签（user） / 模型标签（assistant） */}
        {isUser && sourceTag && (
          <span className="text-xs opacity-50 mb-1 block">{sourceTag}</span>
        )}
        {!isUser && (message.model || message.provider) && (
          <span className="text-xs text-gray-500 mb-1 block">
            {message.provider && <span className="bg-gray-700 px-1 py-0.5 rounded mr-1">{message.provider}</span>}
            {message.model && <span>{message.model}</span>}
          </span>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
