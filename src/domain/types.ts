export type PackageName = 'torch' | 'torchvision' | 'torchaudio'
export type OperatingSystem = 'linux' | 'windows' | 'macos'
export type Architecture = 'x86_64' | 'aarch64' | 'arm64'
export type MatchType = 'exact' | 'same-major-fallback' | 'cross-major-fallback' | 'cpu-fallback'

export interface WheelBuild {
  kind: 'cpu' | 'cuda' | 'unknown'
  tag: string
  major?: number
  minor?: number
}

export interface Wheel {
  package: PackageName
  version: string
  build: WheelBuild
  pythonTags: string[]
  abiTags: string[]
  platformTags: string[]
  os: OperatingSystem[]
  architectures: Architecture[]
  filename: string
  url: string
  sourceDirectory: string
}

export interface WheelData {
  schemaVersion: number
  generatedAt: string
  source: string
  wheelCount: number
  wheels: Wheel[]
}

export interface SearchQuery {
  package: PackageName | ''
  version: string
  python: string
  build: string
  os: OperatingSystem | ''
  architecture: Architecture | ''
  allowCudaFallback: boolean
  allowCpuFallback: boolean
}

export interface MatchResult {
  wheel: Wheel
  matchType: MatchType
  requestedBuild?: string
  actualBuild: string
  fallbackReason?: string
}

export interface SearchResponse {
  results: MatchResult[]
  exactCount: number
  usedFallback: boolean
}

export interface WheelResultGroup {
  key: string
  package: PackageName
  version: string
  buildTag: string
  matchType: MatchType
  requestedBuild?: string
  fallbackReason?: string
  results: MatchResult[]
  pythonTags: string[]
  systems: OperatingSystem[]
  architectures: Architecture[]
}

export interface NearMatch {
  wheel: Wheel
  differences: string[]
  score: number
}
