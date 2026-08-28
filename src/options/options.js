/** 설정 화면. 저장 전에 validateSettings 로 검증한다. */

import { STORAGE_KEY } from '../shared/constants.js'
import { DEFAULT_SETTINGS, mergeSettings, validateSettings } from '../shared/settings.js'
import { BUILT_IN_TEMPLATE_SETS, findTemplateSet } from '../generator/templates/index.js'
import { composeReview } from '../generator/template-engine.js'
import { createSystemRandom } from '../generator/random.js'
import { showNotice } from '../ui/messaging.js'

const PREVIEW_COUNT = 3

const el = (id) => document.getElementById(id)
const notice = el('notice')

/**
 * 마지막으로 불러온 설정.
 * 화면에 노출되지 않은 항목(afterFill)을 저장할 때 기본값으로 덮어쓰지 않기 위해 보관한다.
 */
let loadedSettings = DEFAULT_SETTINGS

/** 화면 입력값 -> 설정 객체 (검증 전 원본). */
const readForm = () => ({
  reviewListUrl: el('reviewListUrl').value.trim(),
  maxItemsPerRun: el('maxItemsPerRun').value,
  stopOnConsecutiveFailures: el('stopOnConsecutiveFailures').value,
  dryRun: el('dryRun').checked,
  rating: el('rating').value,
  minReviewLength: el('minReviewLength').value,
  templateSetId: el('templateSetId').value,
  humanTyping: el('humanTyping').checked,
  answerSurveys: el('answerSurveys').checked,
  delayMs: {
    typingChar: [el('typingCharMin').value, el('typingCharMax').value],
    // 화면에 없는 항목은 기존 값을 유지한다.
    afterFill: loadedSettings.delayMs.afterFill,
    betweenItems: [el('betweenItemsMin').value, el('betweenItemsMax').value],
  },
})

const writeForm = (settings) => {
  el('reviewListUrl').value = settings.reviewListUrl
  el('maxItemsPerRun').value = settings.maxItemsPerRun
  el('stopOnConsecutiveFailures').value = settings.stopOnConsecutiveFailures
  el('dryRun').checked = settings.dryRun
  el('rating').value = String(settings.rating)
  el('minReviewLength').value = settings.minReviewLength
  el('templateSetId').value = settings.templateSetId
  el('humanTyping').checked = settings.humanTyping
  el('answerSurveys').checked = settings.answerSurveys
  el('typingCharMin').value = settings.delayMs.typingChar[0]
  el('typingCharMax').value = settings.delayMs.typingChar[1]
  el('betweenItemsMin').value = settings.delayMs.betweenItems[0]
  el('betweenItemsMax').value = settings.delayMs.betweenItems[1]
}

const populateTemplateOptions = () => {
  el('templateSetId').replaceChildren(
    ...BUILT_IN_TEMPLATE_SETS.map((set) => {
      const option = document.createElement('option')
      option.value = set.id
      option.textContent = set.name
      return option
    }),
  )
}

/**
 * 설정을 불러와 화면에 채운다.
 * 저장소 접근이 실패하면 폼이 전부 빈 채로 남는데, 겉보기에는 정상적인 빈 화면과
 * 구분되지 않는다. 반드시 사용자에게 알리고 기본값이라도 채워 준다.
 */
const load = async () => {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY.SETTINGS)
    loadedSettings = mergeSettings(stored[STORAGE_KEY.SETTINGS])
    writeForm(loadedSettings)
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    loadedSettings = DEFAULT_SETTINGS
    writeForm(DEFAULT_SETTINGS)
    showNotice(notice, `설정을 불러오지 못해 기본값을 표시합니다: ${reason}`, 'error')
  }
}

el('save').addEventListener('click', async () => {
  const validated = validateSettings(readForm())
  if (!validated.ok) {
    showNotice(notice, validated.error, 'error')
    return
  }
  try {
    await chrome.storage.local.set({ [STORAGE_KEY.SETTINGS]: validated.value })
    loadedSettings = validated.value
    writeForm(validated.value)
    showNotice(notice, '저장했습니다.', 'ok')
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    showNotice(notice, `저장하지 못했습니다: ${reason}`, 'error')
  }
})

el('reset').addEventListener('click', async () => {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY.SETTINGS]: DEFAULT_SETTINGS })
    loadedSettings = DEFAULT_SETTINGS
    writeForm(DEFAULT_SETTINGS)
    showNotice(notice, '기본값으로 되돌렸습니다.', 'ok')
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    showNotice(notice, `기본값 복원에 실패했습니다: ${reason}`, 'error')
  }
})

el('preview').addEventListener('click', () => {
  const settings = mergeSettings(readForm())
  const templateSet = findTemplateSet(settings.templateSetId)
  const random = createSystemRandom()
  const samples = []
  const problems = []

  for (let index = 0; index < PREVIEW_COUNT; index += 1) {
    const result = composeReview({
      templateSet,
      rating: settings.rating,
      random,
      minLength: settings.minReviewLength,
      recentTexts: samples,
      similarityThreshold: settings.similarityThreshold,
    })
    if (!result.ok) {
      problems.push(result.error)
      break
    }
    samples.push(result.value.text)
    problems.push(...result.value.warnings)
  }

  const output = el('preview-output')
  output.hidden = false
  output.textContent = samples.map((text, index) => `${index + 1}. (${text.length}자) ${text}`).join('\n\n')
  showNotice(notice, problems.length > 0 ? problems.join('\n') : '샘플을 생성했습니다.', problems.length > 0 ? 'error' : 'ok')
})

populateTemplateOptions()
await load()
