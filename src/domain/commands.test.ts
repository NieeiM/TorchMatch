import { describe, expect, it } from 'vitest'
import { generateCommands } from './commands'
import type { PackageName, Wheel } from './types'

const wheel = (packageName: PackageName, version: string): Wheel => ({
  package: packageName, version, build: { kind: 'cuda', tag: 'cu124', major: 12, minor: 4 },
  pythonTags: ['cp310'], abiTags: ['cp310'], platformTags: ['manylinux2014_x86_64'], os: ['linux'], architectures: ['x86_64'],
  filename: `${packageName}.whl`, url: `https://example/${packageName}`, sourceDirectory: 'cu124',
})

describe('generateCommands', () => {
  it('includes all three packages for torch', () => {
    const selected = wheel('torch', '2.4.1')
    const result = generateCommands(selected, [selected, wheel('torchvision', '0.19.1'), wheel('torchaudio', '2.4.1')])
    expect(result.install).toContain('torchvision==0.19.1')
    expect(result.install).toContain('torchaudio==2.4.1')
  })

  it('does not add torch for torchvision', () => {
    const result = generateCommands(wheel('torchvision', '0.19.1'), [])
    expect(result.install).toBe('python -m pip install torchvision==0.19.1 --index-url https://download.pytorch.org/whl/cu124')
  })
})

