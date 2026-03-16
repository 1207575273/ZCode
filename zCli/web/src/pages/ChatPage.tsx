// src/pages/ChatPage.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { MessageBubble } from '../components/MessageBubble'
import { InputBar } from '../components/InputBar'
import { ToolStatus } from '../components/ToolStatus'
import { PermissionCard } from '../components/PermissionCard'
import { UserQuestionForm } from '../components/UserQuestionForm'
import type { ChatMessage, ToolEvent, ServerEvent, UserQuestion } from '../types'

interface ChatPageProps {
  /** URL 路由中的 sessionId，为 null 时连接当前活跃 session */
  targetSessionId?: string | null
}

export function ChatPage({ targetSessionId }: ChatPageProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionModel, setSessionModel] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([])
  const [pendingPermission, setPendingPermission] = useState<{ toolName: string; args: Record<string, unknown> } | null>(null)
  const [pendingQuestions, setPendingQuestions] = useState<UserQuestion[] | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const msgIdCounter = useRef(0)

  // ── 本轮追踪（ref，不触发重渲染，done 时一次性提交） ──
  const turnTextRef = useRef('')
  const turnToolsRef = useRef<ToolEvent[]>([])

  // WebSocket 事件通过 callback 直接处理（不经过 useState，保证不丢事件）
  const { connected, send } = useWebSocket({
    sessionId: targetSessionId,
    onEvent: handleServerEvent,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming, toolEvents])

  function handleServerEvent(event: ServerEvent) {
    console.log('[WS Event]', event.type, event.type === 'text' ? `(+${(event as {text:string}).text.length} chars)` : '', event)

    switch (event.type) {
      case 'session_init': {
        console.log('[session_init] sessionId:', event.sessionId, 'messages:', event.messages.length)
        setSessionId(event.sessionId)
        if (event.model) setSessionModel(event.model)
        if (!targetSessionId && event.sessionId) {
          window.history.replaceState(null, '', `/session/${event.sessionId}`)
        }
        const restored: ChatMessage[] = event.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
        setMessages(restored)
        msgIdCounter.current = restored.length
        break
      }
      case 'user_input': {
        console.log('[user_input] source:', event.source, 'text:', event.text.slice(0, 50))
        const msg: ChatMessage = {
          id: `msg-${++msgIdCounter.current}`,
          role: 'user',
          content: event.text,
          source: event.source,
        }
        setMessages(prev => [...prev, msg])
        setStreaming('')
        setIsStreaming(true)
        turnTextRef.current = ''
        turnToolsRef.current = []
        break
      }
      case 'text':
        turnTextRef.current += event.text
        setStreaming(prev => prev + event.text)
        break
      case 'tool_start':
        console.log('[tool_start]', event.toolName, 'turnText so far:', turnTextRef.current.length, 'chars')
        setStreaming('')
        setToolEvents(prev => [...prev, {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          status: 'running',
        }])
        break
      case 'tool_done': {
        console.log('[tool_done]', event.toolName, event.durationMs, 'ms', 'success:', event.success)
        const completedEvent: ToolEvent = {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: {},
          status: 'done',
          durationMs: event.durationMs,
          success: event.success,
          resultSummary: event.resultSummary,
        }
        setToolEvents(prev => {
          const running = prev.find(e => e.toolCallId === event.toolCallId)
          if (running) completedEvent.args = running.args
          turnToolsRef.current.push(completedEvent)
          return prev.map(e =>
            e.toolCallId === event.toolCallId
              ? { ...e, status: 'done' as const, durationMs: event.durationMs, success: event.success, resultSummary: event.resultSummary }
              : e
          )
        })
        break
      }
      case 'permission_request':
        console.log('[permission_request]', event.toolName)
        setPendingPermission({ toolName: event.toolName, args: event.args })
        break
      case 'user_question_request':
        console.log('[user_question_request]', event.questions.length, 'questions')
        setPendingQuestions(event.questions)
        break
      case 'done': {
        const finalText = turnTextRef.current
        const finalTools = [...turnToolsRef.current]
        console.log('[done] finalText:', finalText.length, 'chars, finalTools:', finalTools.length)

        const newMessages: ChatMessage[] = []
        if (finalTools.length > 0) {
          newMessages.push({
            id: `msg-${++msgIdCounter.current}`,
            role: 'system',
            content: '',
            toolEvents: finalTools,
          })
        }
        if (finalText) {
          newMessages.push({
            id: `msg-${++msgIdCounter.current}`,
            role: 'assistant',
            content: finalText,
          })
        }

        // 全部同步：清流式 + 加消息，React 18 自动批处理
        setStreaming('')
        setToolEvents([])
        setIsStreaming(false)
        setPendingPermission(null)
        setPendingQuestions(null)
        if (newMessages.length > 0) {
          setMessages(prev => {
            const next = [...prev, ...newMessages]
            console.log('[done] messages after add:', next.length, 'last role:', next[next.length - 1]?.role, 'last content length:', next[next.length - 1]?.content.length)
            return next
          })
        }
        turnTextRef.current = ''
        turnToolsRef.current = []
        break
      }
      case 'bridge_stop':
        setMessages(prev => [...prev, {
          id: `msg-${++msgIdCounter.current}`,
          role: 'system',
          content: 'Bridge Server 已关闭',
        }])
        break
      case 'error':
        setStreaming('')
        setIsStreaming(false)
        setMessages(prev => [...prev, {
          id: `msg-${++msgIdCounter.current}`,
          role: 'system',
          content: `错误: ${event.error}`,
        }])
        break
      default:
        break
    }
  }

  const handleSubmit = useCallback((text: string) => {
    if (isStreaming) {
      // 中断当前流
      if (turnTextRef.current) {
        setMessages(prev => [...prev, {
          id: `msg-${++msgIdCounter.current}`,
          role: 'assistant' as const,
          content: turnTextRef.current + '\n\n*(已中断)*',
        }])
      }
      setStreaming('')
      setToolEvents([])
      setPendingPermission(null)
      setPendingQuestions(null)
      turnTextRef.current = ''
      turnToolsRef.current = []
      send({ type: 'abort' })
    }

    setMessages(prev => [...prev, {
      id: `msg-${++msgIdCounter.current}`,
      role: 'user' as const,
      content: text,
      source: 'web' as const,
    }])
    setStreaming('')
    setIsStreaming(true)
    turnTextRef.current = ''
    turnToolsRef.current = []
    setTimeout(() => send({ type: 'chat', text }), 50)
  }, [send, isStreaming])

  const handlePermission = useCallback((allow: boolean) => {
    send({ type: 'permission', allow })
    setPendingPermission(null)
  }, [send])

  const handleQuestionSubmit = useCallback((answers: Record<string, string | string[]>) => {
    send({ type: 'question', cancelled: false, answers })
    setPendingQuestions(null)
  }, [send])

  const handleQuestionCancel = useCallback(() => {
    send({ type: 'question', cancelled: true })
    setPendingQuestions(null)
  }, [send])

  const inputDisabled = !connected

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">ZCli</h1>
          {sessionModel && <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{sessionModel}</span>}
          {sessionId && <span className="text-xs text-gray-500 font-mono">{sessionId.slice(0, 8)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${connected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
            {connected ? '已连接' : '断开'}
          </span>
          <button
            onClick={() => {
              if (window.confirm('确定关闭 Bridge Server？所有 Web 客户端将断开连接。')) {
                fetch('/api/bridge/stop', { method: 'POST' }).catch(() => {})
              }
            }}
            className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-400 hover:bg-red-800 transition-colors"
            title="关闭 Bridge Server"
          >
            关闭 Bridge
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* 流式输出：纯文本渲染（不走 ReactMarkdown，避免不完整 Markdown 渲染乱码） */}
        {streaming && (
          <div className="flex justify-start mb-3">
            <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-800 text-gray-100">
              <p className="whitespace-pre-wrap text-sm">{streaming}</p>
            </div>
          </div>
        )}

        {/* 工具执行进度（实时） */}
        <ToolStatus events={toolEvents} />

        {/* 权限确认 */}
        {pendingPermission && (
          <PermissionCard
            toolName={pendingPermission.toolName}
            args={pendingPermission.args}
            onAllow={() => handlePermission(true)}
            onDeny={() => handlePermission(false)}
          />
        )}

        {/* 用户问卷 */}
        {pendingQuestions && (
          <UserQuestionForm
            questions={pendingQuestions}
            onSubmit={handleQuestionSubmit}
            onCancel={handleQuestionCancel}
          />
        )}

        <div ref={bottomRef} />
      </div>

      <InputBar onSubmit={handleSubmit} disabled={inputDisabled} />
    </div>
  )
}
