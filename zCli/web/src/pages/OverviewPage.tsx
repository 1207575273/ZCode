// src/pages/OverviewPage.tsx

import { useState, useEffect } from 'react'
import { apiGet } from '../hooks/useApi'
import { Link } from 'react-router-dom'

interface AggregateStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  currency: string
  callCount: number
}

interface SessionSummary {
  sessionId: string
  model: string
  provider: string
  messageCount: number
  createdAt: string
}

interface OverviewData {
  today: AggregateStats[]
  month: AggregateStats[]
  recentSessions: SessionSummary[]
}

export function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<OverviewData>('/api/overview')
      .then(setData)
      .catch(e => setError(String(e)))
  }, [])

  if (error) return <div className="p-6 text-red-400">加载失败: {error}</div>
  if (!data) return <div className="p-6 text-gray-500">加载中...</div>

  const sym = (c: string) => c === 'CNY' ? '¥' : '$'
  const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold mb-6">总览大盘</h2>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard title="今日" stats={data.today} sym={sym} fmtTokens={fmtTokens} />
        <StatCard title="本月" stats={data.month} sym={sym} fmtTokens={fmtTokens} />
      </div>

      {/* 最近会话 */}
      <h3 className="text-lg font-semibold mb-3">最近会话</h3>
      {data.recentSessions.length === 0 ? (
        <p className="text-gray-500 text-sm">暂无会话记录</p>
      ) : (
        <div className="space-y-2">
          {data.recentSessions.map(s => (
            <Link
              key={s.sessionId}
              to={`/conversations/${s.sessionId}`}
              className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <div>
                <span className="text-sm font-mono text-gray-400">{s.sessionId.slice(0, 8)}</span>
                <span className="text-xs text-gray-500 ml-2">{s.model}</span>
              </div>
              <span className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ title, stats, sym, fmtTokens }: {
  title: string
  stats: AggregateStats[]
  sym: (c: string) => string
  fmtTokens: (n: number) => string
}) {
  const totalCalls = stats.reduce((s, r) => s + r.callCount, 0)
  const totalInput = stats.reduce((s, r) => s + r.totalInputTokens, 0)
  const totalOutput = stats.reduce((s, r) => s + r.totalOutputTokens, 0)
  const costs = stats.filter(r => r.totalCost > 0).map(r => `${sym(r.currency)}${r.totalCost.toFixed(4)}`)

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h4 className="text-sm text-gray-400 mb-2">{title}</h4>
      <div className="text-2xl font-bold">{totalCalls} <span className="text-sm text-gray-400 font-normal">次调用</span></div>
      <div className="text-sm text-gray-400 mt-1">
        {fmtTokens(totalInput)} in / {fmtTokens(totalOutput)} out
      </div>
      {costs.length > 0 && (
        <div className="text-sm text-green-400 mt-1">{costs.join(' + ')}</div>
      )}
    </div>
  )
}
