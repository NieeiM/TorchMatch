import { describe, expect, it } from 'vitest'
import { groupMatchResults } from './groups'
import type { MatchResult, Wheel } from './types'

function result(version: string, python: string, filename = `torch-${version}-${python}.whl`, sha256 = filename.padEnd(64, '0')): MatchResult {
  const wheel: Wheel = {
    package: 'torch', version, build: { kind: 'cuda', tag: 'cu124', evidence: 'filename', filenameDeclared: true, major: 12, minor: 4 },
    pythonTags: [python], abiTags: [python], platformTags: ['linux_x86_64'], os: ['linux'], architectures: ['x86_64'],
    filename, url: `https://example/cu124/${filename}`, sha256,
    sourceIndexes: ['cu124'], urls: [{ url: `https://example/cu124/${filename}`, sourceIndex: 'cu124' }], warnings: [],
  }
  return { wheel, matchType: 'exact', actualBuild: 'cu124' }
}

describe('groupMatchResults', () => {
  it('groups environment variants by package, version and build', () => {
    const groups = groupMatchResults([result('2.4.1', 'cp310'), result('2.4.1', 'cp311'), result('2.5.0', 'cp311')])
    expect(groups).toHaveLength(2)
    expect(groups[0].version).toBe('2.5.0')
    expect(groups[1].pythonTags).toEqual(['cp311', 'cp310'])
  })

  it('keeps same filenames with different artifact hashes separate', () => {
    const duplicate = 'torch-2.4.1+cu124-cp310-cp310-linux_x86_64.whl'
    const groups = groupMatchResults([result('2.4.1', 'cp310', duplicate, 'a'.repeat(64)), result('2.4.1', 'cp310', duplicate, 'b'.repeat(64))])
    expect(groups[0].results).toHaveLength(2)
  })

  it('collapses repeated occurrences of the same artifact hash', () => {
    const first = result('2.4.1', 'cp310', 'first.whl', 'c'.repeat(64))
    const second = result('2.4.1', 'cp310', 'second.whl', 'c'.repeat(64))
    expect(groupMatchResults([first, second])[0].results).toHaveLength(1)
  })
})
