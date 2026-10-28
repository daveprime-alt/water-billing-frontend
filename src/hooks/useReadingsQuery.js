import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api.js'
import { currentUtcBillingMonth } from '../utils/readings.js'

export function useReadingsQuery(role, userId) {
  const [billingMonth, setBillingMonth] = useState(() => currentUtcBillingMonth())

  useEffect(() => {
    if (role !== 'READER') return undefined
    const now = new Date()
    const nextUtcMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    const timeoutId = window.setTimeout(
      () => setBillingMonth(currentUtcBillingMonth()),
      Math.min(24 * 60 * 60 * 1000, Math.max(0, nextUtcMonth - now.getTime())),
    )
    return () => window.clearTimeout(timeoutId)
  }, [billingMonth, role])

  return useQuery({
    queryKey: ['readings', role, role === 'READER' ? userId : 'all-periods', role === 'READER' ? billingMonth : 'all-periods'],
    queryFn: api.getReadings,
    enabled: role !== 'CONSUMER',
    gcTime: role === 'READER' ? 0 : undefined,
    refetchOnMount: role === 'READER' ? 'always' : undefined,
  })
}
