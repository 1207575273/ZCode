// src/pages/OverviewPage.tsx

import { useState, useEffect, useCallback } from 'react'
import { apiGet } from '../hooks/useApi'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

// ═══ 类型 ═══

interface ProviderStat { provider: string; totalTokens: number; totalCost: number; currency: string; callCount: number }
interface ModelStat { provider: string; model: string; totalInput: number; totalOutput: number; totalCacheRead: number; totalCacheWrite: number; totalCost: number; currency: string; callCount: number }
interface DailyTrend { date: string; totalInput: number; totalOutput: number; totalCost: number; callCount: number }
interface RangeData { stats: ModelStat[]; byProvider: ProviderStat[] }
interface SessionSummary { sessionId: string; model: string; provider: string; messageCount: number; createdAt: string }
interface OverviewData { today: RangeData; week: RangeData; month: RangeData; custom: RangeData | null; dailyTrend: DailyTrend[]; recentSessions: SessionSummary[] }

type RangeTab = 'today' | 'week' | 'month' | 'custom'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
const sym = (c: string) => c === 'CNY' ? '¥' : '$'
const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)

export function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<RangeTab>('today')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10))

  const loadData = useCallback((from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', new Date(from).toISOString())
    if (to) params.set('to', new Date(to + 'T23:59:59').toISOString())
    const query = params.toString() ? `?${params.toString()}` : ''
    apiGet<OverviewData>(`/api/overview${query}`)
      .then(setData)
      .catch(e => setError(String(e)))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // 切到自定义 tab 时重新请求
  const handleCustomSearch = useCallback(() => {
    loadData(customFrom, customTo)
    setTab('custom')
  }, [customFrom, customTo, loadData])

  if (error) return <div className="p-6 text-red-400">加载失败: {error}</div>
  if (!data) return <div className="p-6 text-gray-500">加载中...</div>

  const rangeData = tab === 'custom' ? (data.custom ?? data.today) : data[tab]
  const totalCalls = rangeData.stats.reduce((s, r) => s + r.callCount, 0)
  const totalInput = rangeData.stats.reduce((s, r) => s + r.totalInput, 0)
  const totalOutput = rangeData.stats.reduce((s, r) => s + r.totalOutput, 0)
  const totalCacheRead = rangeData.stats.reduce((s, r) => s + (r.totalCacheRead ?? 0), 0)
  const totalCacheWrite = rangeData.stats.reduce((s, r) => s + (r.totalCacheWrite ?? 0), 0)
  const costs = rangeData.byProvider.filter(r => r.totalCost > 0).map(r => `${sym(r.currency)}${r.totalCost.toFixed(4)}`)

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">总览大盘</h2>

      {/* Tab 切换 + 自定义日期 */}
      <div className="flex items-center gap-1 border-b border-gray-700">
        <TabBtn active={tab === 'today'} onClick={() => setTab('today')}>当日</TabBtn>
        <TabBtn active={tab === 'week'} onClick={() => setTab('week')}>本周</TabBtn>
        <TabBtn active={tab === 'month'} onClick={() => setTab('month')}>本月</TabBtn>
        <TabBtn active={tab === 'custom'} onClick={() => setTab('custom')}>自定义</TabBtn>
        {tab === 'custom' && (
          <div className="flex items-center gap-2 ml-4">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="bg-gray-800 text-sm rounded px-2 py-1 outline-none" />
            <span className="text-gray-500 text-sm">至</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="bg-gray-800 text-sm rounded px-2 py-1 outline-none" />
            <button onClick={handleCustomSearch} className="px-2 py-1 bg-blue-600 text-xs rounded hover:bg-blue-500">查询</button>
          </div>
        )}
      </div>

      {/* 汇总卡片：6 个（四维 token + 调用次数 + 费用） */}
      <div className="grid grid-cols-6 gap-3">
        <Card label="调用次数" value={String(totalCalls)} />
        <Card label="输入 Token" value={fmtTokens(totalInput)} color="text-blue-400" />
        <Card label="输出 Token" value={fmtTokens(totalOutput)} color="text-green-400" />
        <Card label="缓存读取" value={fmtTokens(totalCacheRead)} color="text-cyan-400" />
        <Card label="缓存写入" value={fmtTokens(totalCacheWrite)} color="text-purple-400" />
        <Card label="费用" value={costs.join(' + ') || '-'} color="text-yellow-400" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 折线图 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm text-gray-400 mb-3">最近 7 天 Token 消耗趋势</h3>
          {data.dailyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.dailyTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={fmtTokens} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }} formatter={(v) => fmtTokens(Number(v ?? 0))} />
                <Line type="monotone" dataKey="totalInput" stroke="#3b82f6" name="输入" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="totalOutput" stroke="#10b981" name="输出" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

        {/* 饼图 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm text-gray-400 mb-3">供应商 Token 消耗分布</h3>
          {rangeData.byProvider.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={rangeData.byProvider} dataKey="totalTokens" nameKey="provider"
                  cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {rangeData.byProvider.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => fmtTokens(Number(v ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>
      </div>

      {/* 模型明细：四维 token */}
      {rangeData.stats.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm text-gray-400 mb-3">模型用量明细</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-2 py-2">供应商</th>
                <th className="px-2 py-2">模型</th>
                <th className="px-2 py-2 text-right">调用</th>
                <th className="px-2 py-2 text-right">输入</th>
                <th className="px-2 py-2 text-right">输出</th>
                <th className="px-2 py-2 text-right">缓存读</th>
                <th className="px-2 py-2 text-right">缓存写</th>
                <th className="px-2 py-2 text-right">费用</th>
              </tr>
            </thead>
            <tbody>
              {rangeData.stats.map((r, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="px-2 py-2 font-mono">{r.provider}</td>
                  <td className="px-2 py-2 font-mono text-gray-300">{r.model}</td>
                  <td className="px-2 py-2 text-right">{r.callCount}</td>
                  <td className="px-2 py-2 text-right text-blue-400">{fmtTokens(r.totalInput)}</td>
                  <td className="px-2 py-2 text-right text-green-400">{fmtTokens(r.totalOutput)}</td>
                  <td className="px-2 py-2 text-right text-cyan-400">{fmtTokens(r.totalCacheRead ?? 0)}</td>
                  <td className="px-2 py-2 text-right text-purple-400">{fmtTokens(r.totalCacheWrite ?? 0)}</td>
                  <td className="px-2 py-2 text-right">{r.totalCost > 0 ? `${sym(r.currency)}${r.totalCost.toFixed(4)}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 最近会话 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm text-gray-400 mb-3">最近会话</h3>
        {data.recentSessions.length === 0 ? <Empty /> : (
          <div className="space-y-1">
            {data.recentSessions.map(s => (
              <Link key={s.sessionId} to={`/conversations/${s.sessionId}`}
                className="flex items-center justify-between p-2 rounded hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500">{s.sessionId.slice(0, 8)}</span>
                  <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">{s.model}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleString()}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`px-4 py-2 text-sm border-b-2 -mb-[1px] transition-colors ${active ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>{children}</button>
}

function Card({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="bg-gray-800 rounded-lg p-3"><div className="text-xs text-gray-400 mb-1">{label}</div><div className={`text-lg font-bold ${color ?? ''}`}>{value}</div></div>
}

function Empty() {
  return <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">暂无数据</div>
}
