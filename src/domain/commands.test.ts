import { describe, expect, it } from 'vitest'
import { generateCommands } from './commands'
import type { PackageName, Wheel } from './types'

const wheel = (packageName: PackageName, version: string): Wheel => ({
  package: packageName, version, build: { kind: 'cuda', tag: 'cu124', evidence: 'filename', filenameDeclared: true, major: 12, minor: 4 },
  pythonTags: ['cp310'], abiTags: ['cp310'], platformTags: ['manylinux2014_x86_64'], os: ['linux'], architectures: ['x86_64'],
  filename: `${packageName}.whl`, url: `https://example/${packageName}`, sha256: packageName.padEnd(64, '0'),
  sourceIndexes: ['cu124'], urls: [{ url: `https://example/${packageName}`, sourceIndex: 'cu124' }], warnings: [],
})

describe('generateCommands', () => {
  it('includes all three packages for torch', () => {
    const selected = wheel('torch', '2.4.1')
    const result = generateCommands(selected, [selected, wheel('torchvision', '0.19.1'), wheel('torchaudio', '2.4.1')])
    expect(result.installBundle).toContain('torchvision==0.19.1')
    expect(result.installBundle).toContain('torchaudio==2.4.1')
    expect(result.installSingle).toBe('python -m pip install torch==2.4.1 --index-url https://download.pytorch.org/whl/cu124')
  })

  it('does not add torch for torchvision', () => {
    const result = generateCommands(wheel('torchvision', '0.19.1'), [])
    expect(result.installSingle).toBe('python -m pip install torchvision==0.19.1 --index-url https://download.pytorch.org/whl/cu124')
    expect(result.installBundle).toBeNull()
  })

  it('keeps single torch install available when companions are missing', () => {
    const result = generateCommands(wheel('torch', '2.4.1'), [])
    expect(result.installBundle).toBeNull()
    expect(result.installSingle).toContain('torch==2.4.1')
    expect(result.warning).toContain('暂不生成三件套')
  })
})
