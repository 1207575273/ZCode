// src/providers/registry.ts
import { AnthropicProvider } from './anthropic.js'
import { OpenAICompatProvider } from './openai-compat.js'
import type { LLMProvider } from './provider.js'
import type { ZCliConfig } from '@config/config-manager.js'

// anthropic 使用原生协议，其余全走 OpenAI 兼容
const NATIVE_ANTHROPIC_PROVIDERS = new Set(['anthropic'])

export function createProvider(providerName: string, config: ZCliConfig): LLMProvider {
  const providerCfg = config.providers[providerName]
  if (!providerCfg) {
    throw new Error(`Provider "${providerName}" 未在 ~/.zcli/config.json 中配置`)
  }

  if (NATIVE_ANTHROPIC_PROVIDERS.has(providerName)) {
    return new AnthropicProvider(providerCfg)
  }

  // 其余均视为 OpenAI 兼容协议（glm / openai / deepseek / ollama 等）
  return new OpenAICompatProvider(providerName, providerCfg)
}
