import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Check, ChevronDown, Clipboard, Cpu, Database, Download, Github, Search, ShieldCheck, Sparkles, Terminal, TriangleAlert, Zap } from 'lucide-react'
import { generateCommands } from './domain/commands'
import { groupMatchResults } from './domain/groups'
import { availableValues, findNearMatches, searchWheels } from './domain/matcher'
import type { MatchResult, SearchQuery, Wheel, WheelData, WheelResultGroup } from './domain/types'

const emptyQuery: SearchQuery = {
  package: '', version: '', python: '', build: '', os: '', architecture: '',
  allowCudaFallback: true, allowCpuFallback: false,
}

const systemLabels: Record<string, string> = { linux: 'Linux', windows: 'Windows', macos: 'macOS' }
const matchLabels: Record<string, string> = {
  exact: '精确匹配', 'same-major-fallback': '同大版本 fallback',
  'cross-major-fallback': '跨大版本 fallback', 'cpu-fallback': 'CPU fallback',
}

function SelectField({ label, value, options, onChange, format = (x) => x }: {
  label: string; value: string; options: string[]; onChange: (value: string) => void; format?: (value: string) => string
}) {
  return <label>
    <span className="field-label">{label}</span>
    <select className="select-field" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">任意</option>
      {options.map((option) => <option key={option} value={option}>{format(option)}</option>)}
    </select>
  </label>
}

function Toggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white/70 p-3">
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition ${checked ? 'bg-ink' : 'bg-zinc-300'}`}>
      <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
    </button>
    <span><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-xs leading-5 text-zinc-500">{detail}</span></span>
  </label>
}

function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }
  return <button type="button" className="btn-secondary !border-zinc-700 !bg-zinc-800 !text-white hover:!bg-zinc-700" onClick={copy}>
    {copied ? <Check size={16} /> : <Clipboard size={16} />} {copied ? '已复制' : label}
  </button>
}

function GroupCard({ group, defaultOpen, selectedUrl, onSelect }: { group: WheelResultGroup; defaultOpen: boolean; selectedUrl?: string; onSelect: (result: MatchResult) => void }) {
  const [open, setOpen] = useState(defaultOpen)
  const [showAllVariants, setShowAllVariants] = useState(false)
  const fallback = group.matchType !== 'exact'
  const selectedInGroup = group.results.some((item) => item.wheel.url === selectedUrl)
  const preview = (values: string[], format = (value: string) => value) => {
    const shown = values.slice(0, 4).map(format).join('、')
    return values.length > 4 ? `${shown} 等 ${values.length} 种` : shown
  }
  return <article className={`overflow-hidden rounded-2xl border bg-white/75 transition ${selectedInGroup ? 'border-ink ring-2 ring-sage' : 'border-zinc-200'}`}>
    <button type="button" className="w-full p-5 text-left hover:bg-white" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-bold">{group.package} {group.version}</span>
            <span className="rounded-md bg-zinc-900 px-2 py-1 font-mono text-[11px] font-bold text-white">{group.buildTag.toUpperCase()}</span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${fallback ? 'bg-amber-100 text-amber-800' : 'bg-lime-100 text-lime-800'}`}>{matchLabels[group.matchType]}</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">{group.results.length} 个 wheel · Python {preview(group.pythonTags)} · {preview(group.systems, (x) => systemLabels[x] || x)} · {preview(group.architectures)}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-zinc-500">{open ? '收起' : '选择环境'}<ChevronDown size={18} className={`transition ${open ? 'rotate-180' : ''}`} /></span>
      </div>
      {fallback && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">请求 {group.requestedBuild?.toUpperCase()} → 实际 {group.buildTag.toUpperCase()} · {group.fallbackReason}</div>}
    </button>
    {open && <div className="border-t border-zinc-200 bg-zinc-50/80 p-3 sm:p-4">
      <p className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-zinc-500">选择具体运行环境</p>
      <div className="space-y-2">
        {group.results.slice(0, showAllVariants ? undefined : 5).map((result) => {
          const wheel = result.wheel
          const selected = wheel.url === selectedUrl
          return <div key={wheel.url} className={`rounded-xl border p-3 sm:flex sm:items-center sm:justify-between sm:gap-4 ${selected ? 'border-ink bg-white' : 'border-zinc-200 bg-white/70'}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><strong>Python {wheel.pythonTags.join('/')}</strong><span>{wheel.os.map((x) => systemLabels[x] || x).join('/')}</span><span>{wheel.architectures.join('/')}</span></div>
              <details className="mt-1 text-xs text-zinc-500"><summary className="cursor-pointer select-none hover:text-ink">查看 ABI、平台和文件名</summary><div className="mt-2 space-y-1 rounded-lg bg-zinc-100 p-2 font-mono"><p>ABI: {wheel.abiTags.join(', ')}</p><p>Platform: {wheel.platformTags.join(', ')}</p><p className="break-all">{wheel.filename}</p></div></details>
            </div>
            <button type="button" className={`mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold transition sm:mt-0 sm:w-auto ${selected ? 'bg-sage text-ink' : 'bg-ink text-white hover:bg-zinc-700'}`} onClick={() => onSelect(result)}>{selected ? '已选择' : '选择此 wheel'}</button>
          </div>
        })}
        {!showAllVariants && group.results.length > 5 && <button type="button" className="w-full rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm font-semibold text-zinc-600 hover:border-ink hover:bg-white hover:text-ink" onClick={() => setShowAllVariants(true)}>展开其余 {group.results.length - 5} 个环境</button>}
      </div>
    </div>}
  </article>
}

function CommandPanel({ selected, wheels }: { selected: MatchResult; wheels: Wheel[] }) {
  const commands = generateCommands(selected.wheel, wheels)
  return <section id="commands" className="mt-8 overflow-hidden rounded-3xl bg-ink text-white shadow-panel">
    <div className="border-b border-white/10 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-sage">Ready to use</p><h2 className="mt-2 text-2xl font-bold">命令生成</h2></div>
        <a className="btn-secondary !border-white/20 !bg-white/5 !text-white hover:!bg-white/10" href={selected.wheel.url} target="_blank" rel="noreferrer"><Download size={17} /> 打开 wheel <ArrowUpRight size={14} /></a>
      </div>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-white/5 p-3"><span className="block text-xs text-zinc-400">请求构建</span>{selected.requestedBuild?.toUpperCase() || '任意'}</div>
        <div className="rounded-xl bg-white/5 p-3"><span className="block text-xs text-zinc-400">实际构建</span>{selected.actualBuild.toUpperCase()}</div>
        <div className="rounded-xl bg-white/5 p-3"><span className="block text-xs text-zinc-400">ABI / Platform</span>{selected.wheel.abiTags[0]} · {selected.wheel.platformTags[0]}</div>
      </div>
    </div>
    <div className="space-y-6 p-5 sm:p-7">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><Terminal size={17} /> 安装命令</h3>{commands.install && <CopyButton text={commands.install} />}</div>
        {commands.install ? <pre className="overflow-x-auto rounded-xl bg-black/30 p-4 font-mono text-sm leading-6 text-zinc-200"><code>{commands.install}</code></pre>
          : <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">{commands.warning}</div>}
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><Download size={17} /> 下载命令</h3><CopyButton text={commands.download} /></div>
        <pre className="overflow-x-auto rounded-xl bg-black/30 p-4 font-mono text-sm leading-6 text-zinc-200"><code>{commands.download}</code></pre>
      </div>
    </div>
  </section>
}

export default function App() {
  const [data, setData] = useState<WheelData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState<SearchQuery>(emptyQuery)
  const [submitted, setSubmitted] = useState<SearchQuery | null>(null)
  const [selected, setSelected] = useState<MatchResult | null>(null)
  const [visibleGroups, setVisibleGroups] = useState(12)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/wheels.json`)
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() })
      .then((payload: WheelData) => setData(payload))
      .catch((error: Error) => setLoadError(error.message))
  }, [])

  const values = useMemo(() => availableValues(data?.wheels || []), [data])
  const response = useMemo(() => submitted && data ? searchWheels(data.wheels, submitted) : null, [submitted, data])
  const groups = useMemo(() => groupMatchResults(response?.results || []), [response])
  const near = useMemo(() => submitted && data && response?.results.length === 0 ? findNearMatches(data.wheels, submitted) : [], [submitted, data, response])
  useEffect(() => {
    if (groups.length === 1 && groups[0].results.length === 1) setSelected(groups[0].results[0])
  }, [groups])
  const update = <K extends keyof SearchQuery>(key: K, value: SearchQuery[K]) => setQuery((current) => ({ ...current, [key]: value }))
  function submit(event: React.FormEvent) { event.preventDefault(); setSubmitted({ ...query }); setSelected(null); setVisibleGroups(12) }

  return <div className="min-h-screen overflow-hidden bg-paper">
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[580px] bg-[radial-gradient(circle_at_80%_15%,rgba(200,255,98,.7),transparent_27%),radial-gradient(circle_at_15%_5%,rgba(238,76,44,.18),transparent_26%)]" />
    <header className="relative mx-auto max-w-7xl px-5 pb-14 pt-6 sm:px-8 sm:pb-20">
      <nav className="flex items-center justify-between">
        <a href={import.meta.env.BASE_URL} className="flex items-center gap-2 text-lg font-black tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-lg bg-ember text-white"><Zap size={18} fill="currentColor" /></span>TorchMatch</a>
        <a href="https://github.com/NieeiM/TorchMatch" target="_blank" rel="noreferrer" className="btn-secondary !bg-white/50"><Github size={17} /> <span className="hidden sm:inline">GitHub</span></a>
      </nav>
      <div className="mt-16 max-w-4xl sm:mt-24">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/60 px-3 py-1.5 text-xs font-semibold backdrop-blur"><ShieldCheck size={15} className="text-ember" /> 只检索 PyTorch 官方稳定版 wheel</div>
        <h1 className="text-5xl font-black leading-[.96] tracking-[-.055em] sm:text-7xl lg:text-8xl">找到正确的<br /><span className="text-ember">PyTorch wheel.</span></h1>
        <p className="mt-7 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">按 Python、CUDA、系统与架构检索真实文件。每一次 fallback 都有迹可循，每一条命令都来自实际存在的 wheel。</p>
      </div>
    </header>

    <main className="relative mx-auto max-w-7xl px-5 pb-20 sm:px-8">
      <form onSubmit={submit} className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-panel backdrop-blur-xl sm:p-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-ember">Matcher</p><h2 className="mt-1 text-2xl font-bold tracking-tight">选择目标环境</h2></div><p className="text-xs text-zinc-500">所有条件均可留空</p></div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="包类型" value={query.package} options={values.packages} onChange={(v) => update('package', v as SearchQuery['package'])} />
          <SelectField label="包版本" value={query.version} options={values.versions} onChange={(v) => update('version', v)} />
          <SelectField label="Python 版本" value={query.python} options={values.pythons} onChange={(v) => update('python', v)} format={(v) => `Python ${v}`} />
          <SelectField label="计算平台" value={query.build} options={values.builds} onChange={(v) => update('build', v)} format={(v) => v === 'cpu' ? 'CPU' : `CUDA ${v.slice(2, -1)}.${v.slice(-1)}`} />
          <SelectField label="操作系统" value={query.os} options={values.systems} onChange={(v) => update('os', v as SearchQuery['os'])} format={(v) => systemLabels[v] || v} />
          <SelectField label="机器架构" value={query.architecture} options={values.architectures} onChange={(v) => update('architecture', v as SearchQuery['architecture'])} />
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <Toggle checked={query.allowCudaFallback} onChange={(v) => update('allowCudaFallback', v)} label="允许 CUDA fallback" detail="无精确结果时，优先同大版本内距离最近的 CUDA。" />
          <Toggle checked={query.allowCpuFallback} onChange={(v) => update('allowCpuFallback', v)} label="最后允许回退到 CPU" detail="默认关闭；仅在所有 CUDA 候选均不存在时生效。" />
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-4"><button className="btn-primary" disabled={!data}><Search size={18} /> 搜索官方 wheel</button>{!data && !loadError && <span className="text-sm text-zinc-500">正在载入索引…</span>}{loadError && <span className="text-sm text-red-700">索引载入失败：{loadError}</span>}</div>
      </form>

      {response && <section className="mt-12" aria-live="polite">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-zinc-500">Results</p><h2 className="mt-1 text-3xl font-bold tracking-tight">{response.results.length ? `${groups.length} 个版本组` : '没有完全匹配'}</h2>{response.results.length > 0 && <p className="mt-2 text-sm text-zinc-500">共 {response.results.length} 个真实 wheel，先选择版本组，再选择运行环境。</p>}</div>{response.usedFallback && <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">已应用 CUDA fallback</span>}</div>
        {response.results.length > 0 ? <><div className="space-y-3">{groups.slice(0, visibleGroups).map((group, index) => <GroupCard key={group.key} group={group} defaultOpen={groups.length === 1 || index === 0} selectedUrl={selected?.wheel.url} onSelect={setSelected} />)}</div>{visibleGroups < groups.length && <div className="mt-5 text-center"><button type="button" className="btn-secondary" onClick={() => setVisibleGroups((count) => count + 12)}>再显示 12 个版本组 <span className="text-zinc-400">（剩余 {groups.length - visibleGroups}）</span></button></div>}</>
          : <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
            <div className="flex gap-4"><TriangleAlert className="mt-1 shrink-0 text-amber-700" /><div><h3 className="text-lg font-bold">未找到同时满足全部条件的 wheel</h3><p className="mt-2 text-sm leading-6 text-amber-900">可以尝试放宽 Python 或 CUDA 版本、更换架构，或明确允许 CPU fallback。下面的候选仅用于比较差异，不代表兼容。</p></div></div>
            {near.length > 0 && <div className="mt-6 space-y-2"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">最接近的 wheel</p>{near.map((item) => <div key={item.wheel.url} className="rounded-xl bg-white/70 p-3 text-sm"><span className="font-semibold">{item.wheel.package} {item.wheel.version}</span><span className="ml-2 text-zinc-600">差异：{item.differences.join('；')}</span></div>)}</div>}
          </div>}
      </section>}

      {selected && data && <CommandPanel selected={selected} wheels={data.wheels} />}

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[['真实文件', '解析官方索引中的 wheel 文件名与兼容 tag，不依赖 pip 版本列表。', Database], ['透明 fallback', '清楚展示请求 CUDA 与实际 CUDA，不会静默切换 CPU。', Sparkles], ['可复现命令', '安装、跨平台下载和 wheel 直链均可直接复制使用。', Cpu]].map(([title, text, Icon]) => <div key={String(title)} className="rounded-2xl border border-zinc-200 bg-white/50 p-5"><Icon size={20} className="text-ember" /><h3 className="mt-4 font-bold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{String(text)}</p></div>)}
      </section>
    </main>

    <footer className="border-t border-zinc-300 bg-white/40"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 py-7 text-xs text-zinc-500 sm:flex-row sm:px-8"><p>数据源：<a className="underline hover:text-ink" href="https://download.pytorch.org/whl/">download.pytorch.org/whl</a> · 共 {data?.wheelCount ?? '—'} 个 wheel</p><p>更新时间：{data ? new Date(data.generatedAt).toLocaleString('zh-CN') : '载入中'}</p></div></footer>
  </div>
}
