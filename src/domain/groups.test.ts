import { describe, expect, it } from 'vitest'
import { groupMatchResults } from './groups'
import type { MatchResult, Wheel } from './types'

function result(version: string, python: string, filename = `torch-${version}-${python}.whl`, sourceDirectory = 'cu124'): MatchResult {
  const wheel: Wheel = {
    package: 'torch', version, build: { kind: 'cuda', tag: 'cu124', major: 12, minor: 4 },
    pythonTags: [python], abiTags: [python], platformTags: ['linux_x86_64'], os: ['linux'], architectures: ['x86_64'],
    filename, url: `https://example/${sourceDirectory}/${filename}`, sourceDirectory,
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

  it('collapses duplicate filenames and prefers their canonical build directory', () => {
    const duplicate = 'torch-2.4.1+cu124-cp310-cp310-linux_x86_64.whl'
    const groups = groupMatchResults([result('2.4.1', 'cp310', duplicate, 'cu121'), result('2.4.1', 'cp310', duplicate, 'cu124')])
    expect(groups[0].results).toHaveLength(1)
    expect(groups[0].results[0].wheel.sourceDirectory).toBe('cu124')
  })
})
