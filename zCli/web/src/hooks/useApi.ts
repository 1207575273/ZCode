// src/hooks/useApi.ts

/**
 * 简单的 REST API 请求封装。
 * 基于 fetch，自动处理 JSON 序列化和错误。
 */

const BASE = ''  // 同域，不需要前缀

export async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE}${path}`)
  if (!resp.ok) throw new Error(`API ${path}: ${resp.status}`)
  return resp.json() as Promise<T>
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`API ${path}: ${resp.status}`)
  return resp.json() as Promise<T>
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`API ${path}: ${resp.status}`)
  return resp.json() as Promise<T>
}

export async function apiDelete<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!resp.ok) throw new Error(`API ${path}: ${resp.status}`)
  return resp.json() as Promise<T>
}
