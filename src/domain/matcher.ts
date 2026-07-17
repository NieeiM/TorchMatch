import type { MatchResult, NearMatch, SearchQuery, SearchResponse, Wheel } from './types'

export function pythonToTag(version: string): string {
  return version ? `cp${version.replace('.', '')}` : ''
}

function tagToPython(tag: string): string {
  const digits = tag.slice(2)
  return digits.length === 2 ? `${digits[0]}.${digits[1]}` : `${digits[0]}.${digits.slice(1)}`
}

function cudaNumber(tag: string): { major: number; minor: number } | null {
  const match = /^cu(\d{2})(\d)$/.exec(tag)
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : null
}

function baseMatches(wheel: Wheel, query: SearchQuery, includeBuild = true): boolean {
  if (query.package && wheel.package !== query.package) return false
  if (query.version && wheel.version !== query.version) return false
  if (query.python && !wheel.pythonTags.includes(pythonToTag(query.python))) return false
  if (query.os && !wheel.os.includes(query.os)) return false
  if (query.architecture && !wheel.architectures.includes(query.architecture)) return false
  if (includeBuild && query.build && wheel.build.tag !== query.build) return false
  return true
}

function fallbackRank(wheel: Wheel, requested: string): [number, number, number, string] {
  const actual = cudaNumber(wheel.build.tag)
  const target = cudaNumber(requested)
  if (!actual || !target) return [99, 99, 99, wheel.filename]
  const sameMajor = actual.major === target.major
  return [sameMajor ? 0 : 1, Math.abs(actual.major - target.major), Math.abs(actual.minor - target.minor), wheel.filename]
}

function compareRank(a: Wheel, b: Wheel, requested: string): number {
  const ar = fallbackRank(a, requested)
  const br = fallbackRank(b, requested)
  for (let i = 0; i < 3; i += 1) {
    if (ar[i] !== br[i]) return (ar[i] as number) - (br[i] as number)
  }
  const av = cudaNumber(a.build.tag)?.minor ?? 0
  const bv = cudaNumber(b.build.tag)?.minor ?? 0
  if (av !== bv) return bv - av
  return String(ar[3]).localeCompare(String(br[3]))
}

export function searchWheels(wheels: Wheel[], query: SearchQuery): SearchResponse {
  const exact = wheels.filter((wheel) => baseMatches(wheel, query))
  if (exact.length || !query.build.startsWith('cu') || !query.allowCudaFallback) {
    return {
      results: exact.map((wheel) => ({ wheel, matchType: 'exact', requestedBuild: query.build || undefined, actualBuild: wheel.build.tag })),
      exactCount: exact.length,
      usedFallback: false,
    }
  }

  const baseCandidates = wheels.filter((wheel) => baseMatches(wheel, query, false))
  const cudaCandidates = baseCandidates
    .filter((wheel) => wheel.build.kind === 'cuda')
    .sort((a, b) => compareRank(a, b, query.build))

  if (cudaCandidates.length) {
    const bestRank = fallbackRank(cudaCandidates[0], query.build)
    const best = cudaCandidates.filter((wheel) => {
      const rank = fallbackRank(wheel, query.build)
      return rank[0] === bestRank[0] && rank[1] === bestRank[1] && rank[2] === bestRank[2]
    })
    return {
      results: best.map((wheel): MatchResult => {
        const sameMajor = cudaNumber(wheel.build.tag)?.major === cudaNumber(query.build)?.major
        return {
          wheel,
          matchType: sameMajor ? 'same-major-fallback' : 'cross-major-fallback',
          requestedBuild: query.build,
          actualBuild: wheel.build.tag,
          fallbackReason: sameMajor ? '相同 CUDA 大版本内的最近版本' : '其他 CUDA 大版本中的最近版本',
        }
      }),
      exactCount: 0,
      usedFallback: true,
    }
  }

  if (query.allowCpuFallback) {
    const cpu = baseCandidates.filter((wheel) => wheel.build.kind === 'cpu')
    return {
      results: cpu.map((wheel) => ({
        wheel,
        matchType: 'cpu-fallback',
        requestedBuild: query.build,
        actualBuild: wheel.build.tag,
        fallbackReason: '未找到 CUDA wheel，已按明确授权回退到 CPU',
      })),
      exactCount: 0,
      usedFallback: cpu.length > 0,
    }
  }
  return { results: [], exactCount: 0, usedFallback: false }
}

export function findNearMatches(wheels: Wheel[], query: SearchQuery, limit = 5): NearMatch[] {
  return wheels
    .filter((wheel) => !query.package || wheel.package === query.package)
    .map((wheel) => {
      const differences: string[] = []
      let score = 0
      if (query.version && wheel.version !== query.version) { differences.push(`版本为 ${wheel.version}`); score += 4 }
      if (query.python && !wheel.pythonTags.includes(pythonToTag(query.python))) { differences.push(`Python 为 ${wheel.pythonTags.join('/')}`); score += 3 }
      if (query.build && wheel.build.tag !== query.build) {
        differences.push(`构建为 ${wheel.build.tag.toUpperCase()}`)
        const a = cudaNumber(query.build); const b = cudaNumber(wheel.build.tag)
        score += a && b ? Math.abs(a.major - b.major) * 2 + Math.abs(a.minor - b.minor) / 10 : 3
      }
      if (query.os && !wheel.os.includes(query.os)) { differences.push(`系统为 ${wheel.os.join('/')}`); score += 3 }
      if (query.architecture && !wheel.architectures.includes(query.architecture)) { differences.push(`架构为 ${wheel.architectures.join('/')}`); score += 3 }
      return { wheel, differences, score }
    })
    .filter((item) => item.differences.length > 0)
    .sort((a, b) => a.score - b.score || b.wheel.version.localeCompare(a.wheel.version, undefined, { numeric: true }))
    .slice(0, limit)
}

export function availableValues(wheels: Wheel[]) {
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  return {
    packages: unique(wheels.map((w) => w.package)),
    versions: unique(wheels.map((w) => w.version)),
    pythons: unique(wheels.flatMap((w) => w.pythonTags).filter((x) => /^cp\d+$/.test(x)).map(tagToPython)),
    builds: unique(wheels.map((w) => w.build.tag).filter((x) => x !== 'unknown')),
    systems: unique(wheels.flatMap((w) => w.os)),
    architectures: unique(wheels.flatMap((w) => w.architectures)),
  }
}
