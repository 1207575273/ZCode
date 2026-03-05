// src/platform/detector.ts
import os from 'node:os'

export type Platform = 'win32' | 'linux' | 'darwin'

export interface PlatformInfo {
  platform: Platform
  isWindows: boolean
  isLinux: boolean
  isMac: boolean
  arch: string
  homeDir: string
  zcliDir: string
}

export function detectPlatform(): PlatformInfo {
  const platform = os.platform() as Platform
  return {
    platform,
    isWindows: platform === 'win32',
    isLinux: platform === 'linux',
    isMac: platform === 'darwin',
    arch: os.arch(),
    homeDir: os.homedir(),
    zcliDir: `${os.homedir()}/.zcli`,
  }
}
