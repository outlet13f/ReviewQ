/**
 * 번들러 없이 ES 모듈을 쓰기 때문에, import 경로가 하나라도 틀리면 런타임에서만 터진다.
 * 이 스크립트는 manifest 가 가리키는 파일과 import 그래프 전체를 정적으로 검사한다.
 */

import { access, readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

const ROOT = process.cwd()
const problems = []

const exists = async (path) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const IMPORT_RE = /(?:^|[\s;])(?:import|export)[^;]*?from\s+['"]([^'"]+)['"]/gu
const DYNAMIC_IMPORT_RE = /import\(\s*chrome\.runtime\.getURL\(\s*['"]([^'"]+)['"]/gu

const importsOf = (source) => [
  ...new Set(
    [...source.matchAll(IMPORT_RE)].map((match) => match[1]).filter((specifier) => specifier.startsWith('.')),
  ),
]

const walkImports = async (entry, seen = new Set()) => {
  const absolute = resolve(ROOT, entry)
  if (seen.has(absolute)) return seen
  seen.add(absolute)

  if (!(await exists(absolute))) {
    problems.push(`파일 없음: ${relative(ROOT, absolute)}`)
    return seen
  }

  const source = await readFile(absolute, 'utf8')
  for (const specifier of importsOf(source)) {
    const target = resolve(dirname(absolute), specifier)
    if (!(await exists(target))) {
      problems.push(`import 경로 없음: ${relative(ROOT, absolute)} -> ${specifier}`)
      continue
    }
    await walkImports(relative(ROOT, target), seen)
  }
  for (const match of source.matchAll(DYNAMIC_IMPORT_RE)) {
    const target = resolve(ROOT, match[1])
    if (!(await exists(target))) problems.push(`동적 import 경로 없음: ${match[1]}`)
    else await walkImports(relative(ROOT, target), seen)
  }
  return seen
}

const manifest = JSON.parse(await readFile(resolve(ROOT, 'manifest.json'), 'utf8'))

const declaredFiles = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_page,
  ...(manifest.content_scripts ?? []).flatMap((entry) => entry.js ?? []),
].filter(Boolean)

for (const file of declaredFiles) {
  if (!(await exists(resolve(ROOT, file)))) problems.push(`manifest 가 가리키는 파일 없음: ${file}`)
}

// HTML 이 참조하는 스크립트/스타일도 확인한다.
for (const htmlFile of [manifest.action?.default_popup, manifest.options_page].filter(Boolean)) {
  const absolute = resolve(ROOT, htmlFile)
  if (!(await exists(absolute))) continue
  const source = await readFile(absolute, 'utf8')
  for (const match of source.matchAll(/(?:src|href)="([^"]+)"/gu)) {
    const reference = match[1]
    if (reference.startsWith('http')) continue
    const target = resolve(dirname(absolute), reference)
    if (!(await exists(target))) problems.push(`${htmlFile} 가 참조하는 파일 없음: ${reference}`)
    else if (reference.endsWith('.js')) await walkImports(relative(ROOT, target))
  }
}

for (const entry of [manifest.background?.service_worker, 'src/content/loader.js'].filter(Boolean)) {
  await walkImports(entry)
}

// 콘텐츠 스크립트가 동적 import 하는 모듈은 web_accessible_resources 로 노출되어야 한다.
const war = (manifest.web_accessible_resources ?? []).flatMap((entry) => entry.resources ?? [])
const contentGraph = await walkImports('src/content/content.js')
const toRegex = (pattern) => {
  const escaped = pattern.replaceAll('.', '[.]')
  const expanded = escaped.replaceAll('**/[^/]*', '@@ANY@@').replaceAll('*', '[^/]*').replaceAll('@@ANY@@', '.*')
  return new RegExp(`^${expanded}$`)
}
const covered = (path) => war.some((pattern) => toRegex(pattern.replaceAll('**/*', '**/[^/]*')).test(path))

for (const absolute of contentGraph) {
  const path = relative(ROOT, absolute).split('\\').join('/')
  if (!covered(path)) problems.push(`web_accessible_resources 에 없음(콘텐츠 스크립트가 로드함): ${path}`)
}

if (problems.length > 0) {
  console.error('검증 실패:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log(`검증 통과: manifest 파일 ${declaredFiles.length}개, 콘텐츠 모듈 ${contentGraph.size}개 확인`)
