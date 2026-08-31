/** 팝업 UI. 표시 값 계산은 ui/run-view.js 가 맡고, 여기서는 DOM 반영과 명령 전송만 한다. */

import { MSG, STORAGE_KEY } from '../shared/constants.js'
import { mergeSettings } from '../shared/settings.js'
import { describeRun } from '../ui/run-view.js'
import { sendToBackground, showNotice } from '../ui/messaging.js'

const POLL_INTERVAL_MS = 1200

const el = (id) => document.getElementById(id)
const nodes = {
  start: el('start'),
  stop: el('stop'),
  probe: el('probe'),
  options: el('options'),
  notice: el('notice'),
  phase: el('phase'),
  progress: el('progress'),
  results: el('results'),
  badge: el('mode-badge'),
  probeOutput: el('probe-output'),
}

let pollTimer = null

const stopPolling = () => {
  clearInterval(pollTimer)
  pollTimer = null
}

/** 이미 돌고 있으면 중복으로 걸지 않는다. */
const startPolling = () => {
  if (pollTimer !== null) return
  pollTimer = setInterval(refresh, POLL_INTERVAL_MS)
}

const renderResults = (results) => {
  if (results.length === 0) {
    const empty = document.createElement('li')
    empty.textContent = '아직 처리한 항목이 없습니다.'
    nodes.results.replaceChildren(empty)
    return
  }

  nodes.results.replaceChildren(
    ...results.map((entry) => {
      const item = document.createElement('li')
      const status = document.createElement('span')
      status.className = `status ${entry.status}`
      status.textContent = entry.status
      const name = document.createElement('span')
      name.textContent = entry.productName || entry.key
      const detail = document.createElement('span')
      detail.className = 'preview'
      detail.textContent = entry.message || entry.textPreview
      item.append(status, name, detail)
      return item
    }),
  )
}

const applyView = (view) => {
  nodes.phase.textContent = view.phaseLabel
  nodes.progress.textContent = view.progressText
  nodes.start.disabled = view.isRunning
  nodes.stop.disabled = !view.isRunning
  nodes.badge.textContent = view.badge.text
  nodes.badge.className = view.badge.className
  renderResults(view.results)

  if (view.notice) showNotice(nodes.notice, view.notice.message, view.notice.kind)

  // 실행 중이면 따라가고, 아니면 멈춘다.
  // 팝업을 실행 도중에 열었을 때도 진행률이 갱신되어야 하므로 시작도 여기서 판단한다.
  if (view.shouldPoll) startPolling()
  else stopPolling()
}

async function refresh() {
  const status = await sendToBackground(MSG.RUN_STATUS)
  if (!status.ok) {
    showNotice(nodes.notice, status.error, 'error')
    stopPolling()
    return
  }
  applyView(describeRun(status.value))
}

/**
 * 실행 기록이 없을 때 보여줄 배지는 현재 설정에서 읽는다.
 * 저장소 접근이 실패해도 화면이 조용히 비어 버리지 않도록 명시적으로 알린다.
 */
const showCurrentMode = async () => {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY.SETTINGS)
    const view = describeRun(null)
    const isDryRun = mergeSettings(stored[STORAGE_KEY.SETTINGS]).dryRun
    nodes.badge.textContent = isDryRun ? view.badge.text : '실제 등록'
    nodes.badge.className = isDryRun ? 'badge dry' : 'badge live'
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    showNotice(nodes.notice, `설정을 읽지 못했습니다: ${reason}`, 'error')
  }
}

nodes.start.addEventListener('click', async () => {
  showNotice(nodes.notice, '실행을 시작합니다...', 'info')
  nodes.start.disabled = true
  // RUN_START 는 실행이 모두 끝나야 응답한다. 진행 상황은 폴링으로 따라간다.
  startPolling()

  const started = await sendToBackground(MSG.RUN_START)
  if (!started.ok) showNotice(nodes.notice, started.error, 'error')
  await refresh()
})

nodes.stop.addEventListener('click', async () => {
  const stopped = await sendToBackground(MSG.RUN_STOP)
  showNotice(nodes.notice, stopped.ok ? stopped.value.message : stopped.error, stopped.ok ? 'info' : 'error')
  await refresh()
})

nodes.probe.addEventListener('click', async () => {
  showNotice(nodes.notice, '현재 탭 구조를 분석합니다...', 'info')
  const probed = await sendToBackground(MSG.PROBE_PAGE)
  if (!probed.ok) {
    showNotice(nodes.notice, probed.error, 'error')
    return
  }
  nodes.probeOutput.hidden = false
  nodes.probeOutput.textContent = JSON.stringify(probed.value, null, 2)
  showNotice(nodes.notice, '진단 결과를 아래에 표시했습니다. 복사해서 셀렉터 수정에 쓰세요.', 'ok')
})

nodes.options.addEventListener('click', () => chrome.runtime.openOptionsPage())

window.addEventListener('unload', stopPolling)

await showCurrentMode()
await refresh()
