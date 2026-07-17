export type Language = 'en' | 'zh'

const messages = {
  en: {
    any: 'Any', copy: 'Copy', copied: 'Copied', collapse: 'Collapse', chooseEnvironment: 'Choose environment',
    wheelCount: 'wheel', wheelsCount: 'wheels', environmentKinds: 'types', chooseRuntime: 'Choose a runtime environment',
    details: 'View detection evidence, ABI, platform, and filename', selectWheel: 'Select this wheel', selected: 'Selected',
    showRemaining: 'Show {count} more environments', ready: 'Ready to use', commandGenerator: 'Command generator', openWheel: 'Open wheel',
    requestedBuild: 'Requested build', actualBuild: 'Actual build', installBundle: 'Install the PyTorch bundle',
    installBundleDetail: 'Recommended: install matching versions of torch, torchvision, and torchaudio', installOnlyTorch: 'Install torch only',
    installPackage: 'Install {package}', installOnlyDetail: 'Does not explicitly install torchvision or torchaudio', downloadCommand: 'Download command',
    officialOnly: 'Official stable PyTorch wheels only', heroStart: 'Find the right',
    heroDescription: 'Search real files by Python, CUDA, operating system, and architecture. Every fallback is transparent, and every command is backed by an existing wheel.',
    matcher: 'Matcher', targetEnvironment: 'Choose a target environment', optionalFilters: 'Every filter is optional',
    packageType: 'Package', packageVersion: 'Package version', pythonVersion: 'Python version', computePlatform: 'Compute platform', operatingSystem: 'Operating system', architecture: 'Architecture',
    cudaFallback: 'Allow CUDA fallback', cudaFallbackDetail: 'When no exact match exists, prefer the nearest CUDA version in the same major release.',
    cpuFallback: 'Finally allow CPU fallback', cpuFallbackDetail: 'Off by default; used only when no CUDA candidate exists.',
    search: 'Search official wheels', loadingIndex: 'Loading index…', indexFailed: 'Failed to load index: {error}', unsupportedSchema: 'Unsupported data schema: {schema}',
    results: 'Results', versionGroups: '{count} version groups', noExactMatch: 'No exact match', resultSummary: '{count} real wheels. Choose a version group, then a runtime environment.', fallbackApplied: 'CUDA fallback applied',
    showMoreGroups: 'Show 12 more version groups', remaining: '{count} remaining', noWheel: 'No wheel satisfies every selected condition',
    noWheelHelp: 'Try relaxing the Python or CUDA version, changing architecture, or explicitly allowing CPU fallback. The candidates below are for comparison only and are not guaranteed compatible.',
    closestWheels: 'Closest wheels', differences: 'Differences: ', realFiles: 'Real files', realFilesDetail: 'Parses wheel filenames and compatibility tags from official indexes instead of relying on pip version lists.',
    transparentFallback: 'Transparent fallback', transparentFallbackDetail: 'Shows requested and actual CUDA versions clearly and never switches to CPU silently.',
    reproducibleCommands: 'Reproducible commands', reproducibleCommandsDetail: 'Installation, cross-platform download, and direct wheel links are ready to copy.',
    dataSource: 'Data source', total: '{count} wheels', updated: 'Updated', loading: 'Loading', requestActual: 'Requested {requested} → actual {actual}',
    exact: 'Exact match', sameMajor: 'Same-major fallback', crossMajor: 'Cross-major fallback', cpuMatch: 'CPU fallback',
    sameMajorReason: 'nearest version in the same CUDA major release', crossMajorReason: 'nearest version in another CUDA major release', cpuReason: 'no CUDA wheel found; CPU fallback was explicitly allowed',
    evidenceFilename: 'Declared by filename', evidenceOfficial: 'Official index', evidenceSharedCpu: 'Shared CPU index', evidencePlatform: 'Platform policy', evidenceAmbiguous: 'Ambiguous build',
    notProvided: 'not provided', sourceIndexes: 'Source indexes', warning: 'Warning', bundleUnavailable: 'Compatible {missing} wheels are absent from the current dataset, so no potentially invalid bundle command is generated.',
  },
  zh: {
    any: '任意', copy: '复制', copied: '已复制', collapse: '收起', chooseEnvironment: '选择环境', wheelCount: '个 wheel', wheelsCount: '个 wheel', environmentKinds: '种', chooseRuntime: '选择具体运行环境',
    details: '查看识别证据、ABI、平台和文件名', selectWheel: '选择此 wheel', selected: '已选择', showRemaining: '展开其余 {count} 个环境', ready: '可直接使用', commandGenerator: '命令生成', openWheel: '打开 wheel',
    requestedBuild: '请求构建', actualBuild: '实际构建', installBundle: '安装 PyTorch 三件套', installBundleDetail: '推荐：同时安装匹配版本的 torch、torchvision 和 torchaudio', installOnlyTorch: '仅安装 torch', installPackage: '安装 {package}', installOnlyDetail: '不主动安装 torchvision 和 torchaudio', downloadCommand: '下载命令',
    officialOnly: '只检索 PyTorch 官方稳定版 wheel', heroStart: '找到正确的', heroDescription: '按 Python、CUDA、系统与架构检索真实文件。每一次 fallback 都有迹可循，每一条命令都来自实际存在的 wheel。',
    matcher: '匹配器', targetEnvironment: '选择目标环境', optionalFilters: '所有条件均可留空', packageType: '包类型', packageVersion: '包版本', pythonVersion: 'Python 版本', computePlatform: '计算平台', operatingSystem: '操作系统', architecture: '机器架构',
    cudaFallback: '允许 CUDA fallback', cudaFallbackDetail: '无精确结果时，优先同大版本内距离最近的 CUDA。', cpuFallback: '最后允许回退到 CPU', cpuFallbackDetail: '默认关闭；仅在所有 CUDA 候选均不存在时生效。', search: '搜索官方 wheel', loadingIndex: '正在载入索引…', indexFailed: '索引载入失败：{error}', unsupportedSchema: '不支持的数据 schema：{schema}',
    results: '结果', versionGroups: '{count} 个版本组', noExactMatch: '没有完全匹配', resultSummary: '共 {count} 个真实 wheel，先选择版本组，再选择运行环境。', fallbackApplied: '已应用 CUDA fallback', showMoreGroups: '再显示 12 个版本组', remaining: '剩余 {count}', noWheel: '未找到同时满足全部条件的 wheel', noWheelHelp: '可以尝试放宽 Python 或 CUDA 版本、更换架构，或明确允许 CPU fallback。下面的候选仅用于比较差异，不代表兼容。', closestWheels: '最接近的 wheel', differences: '差异：',
    realFiles: '真实文件', realFilesDetail: '解析官方索引中的 wheel 文件名与兼容 tag，不依赖 pip 版本列表。', transparentFallback: '透明 fallback', transparentFallbackDetail: '清楚展示请求 CUDA 与实际 CUDA，不会静默切换 CPU。', reproducibleCommands: '可复现命令', reproducibleCommandsDetail: '安装、跨平台下载和 wheel 直链均可直接复制使用。', dataSource: '数据源', total: '共 {count} 个 wheel', updated: '更新时间', loading: '载入中', requestActual: '请求 {requested} → 实际 {actual}',
    exact: '精确匹配', sameMajor: '同大版本 fallback', crossMajor: '跨大版本 fallback', cpuMatch: 'CPU fallback', sameMajorReason: '相同 CUDA 大版本内的最近版本', crossMajorReason: '其他 CUDA 大版本中的最近版本', cpuReason: '未找到 CUDA wheel，已按明确授权回退到 CPU',
    evidenceFilename: '文件名声明', evidenceOfficial: '官方索引识别', evidenceSharedCpu: 'CPU 索引共享', evidencePlatform: '平台规则识别', evidenceAmbiguous: '构建信息有歧义', notProvided: '未提供', sourceIndexes: '来源索引', warning: '警告', bundleUnavailable: '当前真实 wheel 数据中缺少兼容的 {missing}，为避免给出错误组合，暂不生成三件套安装命令。',
  },
} as const

export type MessageKey = keyof typeof messages.en

export function translate(language: Language, key: MessageKey, values: Record<string, string | number> = {}): string {
  let message: string = messages[language][key]
  for (const [name, value] of Object.entries(values)) message = message.replaceAll(`{${name}}`, String(value))
  return message
}
