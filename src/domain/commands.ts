import type { PackageName, Wheel } from './types'

const INDEX_ROOT = 'https://download.pytorch.org/whl'

export interface CommandSet {
  install: string | null
  download: string
  companions: Wheel[]
  warning?: string
}

function sameEnvironment(a: Wheel, b: Wheel): boolean {
  return a.build.tag === b.build.tag
    && a.pythonTags.some((tag) => b.pythonTags.includes(tag))
    && a.os.some((value) => b.os.includes(value))
    && a.architectures.some((value) => b.architectures.includes(value))
}

function versionParts(version: string): number[] {
  return version.split('.').map(Number)
}

function compatibleTorchvision(torchVersion: string, visionVersion: string): boolean {
  const [torchMajor, torchMinor] = versionParts(torchVersion)
  const [visionMajor, visionMinor] = versionParts(visionVersion)
  if (torchMajor !== 2 || visionMajor !== 0) return false
  return visionMinor === torchMinor + 15
}

function pickCompanion(selected: Wheel, wheels: Wheel[], packageName: PackageName): Wheel | undefined {
  return wheels
    .filter((wheel) => wheel.package === packageName && sameEnvironment(selected, wheel))
    .filter((wheel) => packageName === 'torchaudio'
      ? wheel.version === selected.version
      : compatibleTorchvision(selected.version, wheel.version))
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0]
}

export function generateCommands(selected: Wheel, wheels: Wheel[]): CommandSet {
  const index = `${INDEX_ROOT}/${selected.build.tag}`
  const abi = selected.abiTags[0] || selected.pythonTags[0]
  const pythonTag = selected.pythonTags.find((tag) => /^cp\d+$/.test(tag)) || selected.pythonTags[0]
  const pyDigits = pythonTag?.replace('cp', '') || ''
  const pythonVersion = pyDigits.length === 2 ? `${pyDigits[0]}.${pyDigits[1]}` : `${pyDigits.slice(0, -2)}.${pyDigits.slice(-2)}`
  const platform = selected.platformTags[0]
  const download = `python -m pip download ${selected.package}==${selected.version} --index-url ${index} --python-version ${pythonVersion} --implementation cp --abi ${abi} --platform ${platform} --only-binary=:all: --no-deps`

  if (selected.package !== 'torch') {
    return { install: `python -m pip install ${selected.package}==${selected.version} --index-url ${index}`, download, companions: [] }
  }

  const vision = pickCompanion(selected, wheels, 'torchvision')
  const audio = pickCompanion(selected, wheels, 'torchaudio')
  if (!vision || !audio) {
    const missing = [!vision && 'torchvision', !audio && 'torchaudio'].filter(Boolean).join('、')
    return { install: null, download, companions: [vision, audio].filter((x): x is Wheel => Boolean(x)), warning: `真实 wheel 数据中缺少兼容的 ${missing}，为避免给出错误组合，暂不生成三件套安装命令。` }
  }
  return {
    install: `python -m pip install torch==${selected.version} torchvision==${vision.version} torchaudio==${audio.version} --index-url ${index}`,
    download,
    companions: [vision, audio],
  }
}

