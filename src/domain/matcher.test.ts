import { describe, expect, it } from 'vitest'
import { searchWheels } from './matcher'
import type { SearchQuery, Wheel } from './types'

const wheel = (tag: string): Wheel => ({
  package: 'torch', version: '2.4.1', build: { kind: tag === 'cpu' ? 'cpu' : 'cuda', tag },
  pythonTags: ['cp310'], abiTags: ['cp310'], platformTags: ['manylinux2014_x86_64'],
  os: ['linux'], architectures: ['x86_64'], filename: `torch-${tag}.whl`, url: `https://example/${tag}`, sourceDirectory: tag,
})
const query: SearchQuery = { package: 'torch', version: '2.4.1', python: '3.10', build: 'cu121', os: 'linux', architecture: 'x86_64', allowCudaFallback: true, allowCpuFallback: false }

describe('searchWheels', () => {
  it('returns exact matches first', () => {
    const result = searchWheels([wheel('cu124'), wheel('cu121')], query)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].matchType).toBe('exact')
  })

  it('uses nearest same-major CUDA fallback', () => {
    const result = searchWheels([wheel('cu118'), wheel('cu126'), wheel('cu124')], query)
    expect(result.results[0].actualBuild).toBe('cu124')
    expect(result.results[0].matchType).toBe('same-major-fallback')
  })

  it('never falls back to CPU without explicit permission', () => {
    expect(searchWheels([wheel('cpu')], query).results).toHaveLength(0)
    expect(searchWheels([wheel('cpu')], { ...query, allowCpuFallback: true }).results[0].matchType).toBe('cpu-fallback')
  })
})

