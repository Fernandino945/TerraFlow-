import { useState, useEffect, useCallback, useRef } from 'react'

export function usePolling<T>(
  fetcher: () => Promise<T>,
  interval: number = 10000,
  immediate: boolean = true
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lastData = useRef<T | null>(null)

  const fetch = useCallback(async () => {
    try {
      const result = await fetcher()
      setData(result)
      lastData.current = result
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Error de conexión')
      // Mantener último estado conocido (failsafe)
      if (lastData.current) setData(lastData.current)
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    if (immediate) fetch()
    const id = setInterval(fetch, interval)
    return () => clearInterval(id)
  }, [fetch, interval, immediate])

  return { data, loading, error, refetch: fetch }
}
