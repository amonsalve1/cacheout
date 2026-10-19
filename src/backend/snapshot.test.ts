import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emptySnapshot } from './types.ts'

const SRC = new URL('..', import.meta.url).pathname

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walk(path)
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : []
  })
}

describe('the empty snapshot', () => {
  it('is structurally complete, so every screen can read it without guards', () => {
    const snapshot = emptySnapshot()

    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'antes',
        'daily',
        'lastSweptDay',
        'markers',
        'payments',
        'meId',
        'players',
        'powerups',
        'table',
        'today',
      ].sort(),
    )
    expect(snapshot.players).toEqual([])
    expect(snapshot.antes).toEqual([])
    expect(snapshot.markers).toEqual([])
    expect(snapshot.powerups).toEqual([])
  })

  it("contains no invented content — an empty table must read as empty, not as someone else's", () => {
    const snapshot = emptySnapshot()
    expect(snapshot.table.name).toBe('')
    expect(snapshot.table.joinCode).toBe('')
    expect(snapshot.meId).toBe('')
    expect(snapshot.daily.slug).toBe('')

    expect(JSON.stringify(snapshot)).not.toMatch(/NIGHT SHIFT|ALLIN|KEVIN|your_handle/i)
  })

  it('dates itself to a real day, so the countdown is not NaN before the first load', () => {
    expect(emptySnapshot().today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('fixture containment', () => {
  it('only the demo backend and its own tests import the fixture module', () => {
    const offenders = walk(SRC)
      .filter((file) => /import[^;]*from\s+'[^']*\/demo\.ts'/.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(SRC.length))

    expect(offenders.sort()).toEqual(['backend/demoBackend.ts'])
  })
})
