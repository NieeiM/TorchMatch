import type { MatchResult, MatchType, WheelResultGroup } from './types'

const matchOrder: Record<MatchType, number> = {
  exact: 0,
  'same-major-fallback': 1,
  'cross-major-fallback': 2,
  'cpu-fallback': 3,
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function preferCanonicalSource(current: MatchResult, candidate: MatchResult): MatchResult {
  const currentCanonical = current.wheel.sourceDirectory === current.actualBuild
  const candidateCanonical = candidate.wheel.sourceDirectory === candidate.actualBuild
  return candidateCanonical && !currentCanonical ? candidate : current
}

export function groupMatchResults(results: MatchResult[]): WheelResultGroup[] {
  const grouped = new Map<string, MatchResult[]>()
  for (const result of results) {
    const key = [result.matchType, result.wheel.package, result.wheel.version, result.actualBuild].join('|')
    grouped.set(key, [...(grouped.get(key) || []), result])
  }

  return [...grouped.entries()].map(([key, candidates]) => {
    const byFilename = new Map<string, MatchResult>()
    for (const candidate of candidates) {
      const current = byFilename.get(candidate.wheel.filename)
      byFilename.set(candidate.wheel.filename, current ? preferCanonicalSource(current, candidate) : candidate)
    }
    const deduplicated = [...byFilename.values()].sort((a, b) => {
      const python = b.wheel.pythonTags.join().localeCompare(a.wheel.pythonTags.join(), undefined, { numeric: true })
      if (python) return python
      const system = a.wheel.os.join().localeCompare(b.wheel.os.join())
      if (system) return system
      return a.wheel.architectures.join().localeCompare(b.wheel.architectures.join())
    })
    const first = deduplicated[0]
    return {
      key,
      package: first.wheel.package,
      version: first.wheel.version,
      buildTag: first.actualBuild,
      matchType: first.matchType,
      requestedBuild: first.requestedBuild,
      fallbackReason: first.fallbackReason,
      results: deduplicated,
      pythonTags: unique(deduplicated.flatMap((item) => item.wheel.pythonTags)).sort().reverse(),
      systems: unique(deduplicated.flatMap((item) => item.wheel.os)).sort(),
      architectures: unique(deduplicated.flatMap((item) => item.wheel.architectures)).sort(),
    }
  }).sort((a, b) => {
    const match = matchOrder[a.matchType] - matchOrder[b.matchType]
    if (match) return match
    const packageName = a.package.localeCompare(b.package)
    if (packageName) return packageName
    const version = b.version.localeCompare(a.version, undefined, { numeric: true })
    if (version) return version
    return b.buildTag.localeCompare(a.buildTag, undefined, { numeric: true })
  })
}

