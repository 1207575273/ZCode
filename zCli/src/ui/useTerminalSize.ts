// src/ui/useTerminalSize.ts
import { useState, useEffect } from 'react'
import { useStdout } from 'ink'

export function useTerminalSize() {
  const { stdout } = useStdout()
  const [columns, setColumns] = useState(stdout?.columns ?? 80)
  const [rows, setRows] = useState(stdout?.rows ?? 24)

  useEffect(() => {
    if (!stdout) return
    const onResize = () => {
      setColumns(stdout.columns ?? 80)
      setRows(stdout.rows ?? 24)
    }
    stdout.on('resize', onResize)
    return () => { stdout.off('resize', onResize) }
  }, [stdout])

  return { columns, rows }
}
