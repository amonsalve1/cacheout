import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoBackend } from './demoBackend.ts'
import { netBalances } from '../lib/marker.ts'

beforeEach(() => {
  const items = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('payment lifecycle', () => {
  it('retains the balance until the recipient confirms and persists that confirmation', async () => {
    const backend = createDemoBackend()
    await backend.signIn({ displayName: 'YOU', leetcodeUsername: 'you' })
    const before = await backend.load()
    const balance = netBalances(before.markers).get('you') ?? 0
    await backend.pay('kevin', 100)
    const pending = await backend.load()
    expect(netBalances(pending.markers, pending.payments).get('you')).toBe(balance)
    await expect(backend.confirmPayment(pending.payments[0].id)).rejects.toThrow('recipient')
    await expect(backend.pay('kevin', 100)).rejects.toThrow('pending')
    await backend.signIn({ displayName: 'KEVIN', leetcodeUsername: 'kevin' })
    await backend.confirmPayment(pending.payments[0].id)
    const confirmed = await createDemoBackend().load()
    expect(netBalances(confirmed.markers, confirmed.payments).get('you')).toBe(balance + 100)
    await expect(backend.confirmPayment(pending.payments[0].id)).rejects.toThrow('recipient')
  })
  it('rejects self-payments, strangers, fractions and nonpositive amounts', async () => {
    const backend = createDemoBackend()
    await backend.signIn({ displayName: 'YOU', leetcodeUsername: 'you' })
    for (const cents of [0, -100, 1.5, NaN])
      await expect(backend.pay('kevin', cents)).rejects.toThrow('Invalid')
    await expect(backend.pay('you', 100)).rejects.toThrow('Invalid')
    await expect(backend.pay('stranger', 100)).rejects.toThrow('Invalid')
  })
})
