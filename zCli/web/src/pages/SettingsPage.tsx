// src/pages/SettingsPage.tsx

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '../hooks/useApi'

interface ProviderConfig {
  apiKey: string
  baseURL?: string
  protocol?: string
  models: string[]
}

interface ZCliConfig {
  defaultProvider: string
  defaultModel: string
  providers: Record<string, ProviderConfig>
}

interface PricingRule {
  id: number
  provider: string
  model_pattern: string
  input_price: number
  output_price: number
  cache_read_price: number
  cache_write_price: number
  currency: string
  effective_from: string
  effective_to: string | null
  source: string | null
  priority: number
}

type Tab = 'providers' | 'pricing'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('providers')

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold mb-4">设置管理</h2>

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-6 border-b border-gray-700">
        <TabButton active={tab === 'providers'} onClick={() => setTab('providers')}>Provider 配置</TabButton>
        <TabButton active={tab === 'pricing'} onClick={() => setTab('pricing')}>计价规则</TabButton>
      </div>

      {tab === 'providers' ? <ProvidersTab /> : <PricingTab />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-[1px] ${
        active ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

// ═══ Provider 配置 Tab ═══

function ProvidersTab() {
  const [config, setConfig] = useState<ZCliConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiGet<{ config: ZCliConfig }>('/api/settings')
      .then(d => setConfig(d.config))
      .catch(e => setError(String(e)))
  }, [])

  const handleSave = useCallback(async () => {
    if (!config) return
    setSaving(true)
    try {
      await apiPost('/api/settings/save', { config })
      setError(null)
    } catch (e) {
      setError(String(e))
    }
    setSaving(false)
  }, [config])

  if (error && !config) return <div className="text-red-400">加载失败: {error}</div>
  if (!config) return <div className="text-gray-500">加载中...</div>

  return (
    <div className="space-y-4">
      {/* 默认设置 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">默认设置</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">默认 Provider</label>
            <input
              value={config.defaultProvider}
              onChange={e => setConfig({ ...config, defaultProvider: e.target.value })}
              className="w-full bg-gray-900 text-sm rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">默认 Model</label>
            <input
              value={config.defaultModel}
              onChange={e => setConfig({ ...config, defaultModel: e.target.value })}
              className="w-full bg-gray-900 text-sm rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Provider 列表 */}
      {Object.entries(config.providers).map(([name, prov]) => (
        <div key={name} className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">{name}</h3>
            {prov.protocol && <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-400">{prov.protocol}</span>}
          </div>
          <div className="space-y-2 text-sm">
            {prov.baseURL && (
              <div><span className="text-gray-500">baseURL:</span> <span className="text-gray-300 font-mono">{prov.baseURL}</span></div>
            )}
            <div><span className="text-gray-500">API Key:</span> <span className="text-gray-300 font-mono">{prov.apiKey.slice(0, 8)}{'•'.repeat(20)}</span></div>
            <div><span className="text-gray-500">Models:</span> <span className="text-gray-300">{prov.models.join(', ')}</span></div>
          </div>
        </div>
      ))}

      {/* 保存按钮 */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 text-sm">
          {saving ? '保存中...' : '保存配置'}
        </button>
        {error && <span className="text-red-400 text-sm">{error}</span>}
      </div>
    </div>
  )
}

// ═══ 计价规则 Tab ═══

function PricingTab() {
  const [rules, setRules] = useState<PricingRule[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadRules = useCallback(() => {
    apiGet<{ rules: PricingRule[] }>('/api/pricing')
      .then(d => setRules(d.rules))
      .catch(e => setError(String(e)))
  }, [])

  useEffect(() => { loadRules() }, [loadRules])

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm('确定删除这条计价规则？')) return
    try {
      await apiPost('/api/pricing/delete', { id })
      loadRules()
    } catch (e) {
      setError(String(e))
    }
  }, [loadRules])

  if (error && rules.length === 0) return <div className="text-red-400">加载失败: {error}</div>

  const sym = (c: string) => c === 'CNY' ? '¥' : '$'

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="px-3 py-2">供应商</th>
              <th className="px-3 py-2">模型匹配</th>
              <th className="px-3 py-2 text-right">输入</th>
              <th className="px-3 py-2 text-right">输出</th>
              <th className="px-3 py-2">币种</th>
              <th className="px-3 py-2">生效日期</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(r => (
              <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-3 py-2 font-mono">{r.provider}</td>
                <td className="px-3 py-2 font-mono">{r.model_pattern}</td>
                <td className="px-3 py-2 text-right">{sym(r.currency)}{r.input_price}</td>
                <td className="px-3 py-2 text-right">{sym(r.currency)}{r.output_price}</td>
                <td className="px-3 py-2">{r.currency}</td>
                <td className="px-3 py-2 text-gray-400">{r.effective_from}</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-300 text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rules.length === 0 && <p className="text-gray-500 text-sm mt-4">暂无计价规则</p>}
    </div>
  )
}
