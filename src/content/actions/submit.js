/** 리뷰 등록 버튼을 찾아 누르고 결과를 확인한다. */

import { LIMITS } from '../../shared/constants.js'
import { err, ok } from '../../shared/result.js'
import { FORM } from '../dom/selectors.js'
import { findAllClickableByText, isDisabled, textOf } from '../dom/finder.js'
import { humanClick } from '../dom/events.js'
import { waitFor } from '../../shared/async.js'
import { findUncheckedAgreements, waitForFormGone } from './form.js'

/**
 * 등록 버튼을 찾는다. submitTexts 는 구체적인 것("리뷰 등록")부터 나열되어 있으므로
 * 앞에서부터 매칭해 "취소" 같은 버튼과 헷갈리지 않게 한다.
 */
export const findSubmitButton = (root = document) => {
  for (const needle of FORM.submitTexts) {
    const candidates = findAllClickableByText([needle], { root, exclude: FORM.submitExcludeTexts })
    if (candidates.length === 0) continue

    // 실측: 네이버 등록 버튼은 필수 항목을 채우기 전까지 disabled 다.
    // 비활성이라고 "버튼이 없다"고 하면 원인을 알 수 없으므로, 활성 버튼을 우선하되
    // 전부 비활성이어도 반환해서 호출 측이 사유를 설명할 수 있게 한다.
    const enabled = candidates.filter((button) => !isDisabled(button))
    const pool = enabled.length > 0 ? enabled : candidates

    // 텍스트가 짧은 쪽이 실제 버튼일 가능성이 높다.
    return pool.reduce((best, current) => (textOf(current).length < textOf(best).length ? current : best))
  }
  return null
}

/** 지금 페이지에 나타나 있는 성공 문구 집합. */
const presentSuccessTexts = () => {
  // innerText 는 렌더 의존이라 환경에 따라 없을 수 있다. textContent 로 폴백한다.
  const body = document.body?.innerText ?? document.body?.textContent ?? ''
  return new Set(FORM.successTexts.filter((needle) => body.includes(needle)))
}

/**
 * 클릭 전에는 없었는데 새로 나타난 성공 문구.
 * 단순히 "문구가 있는가"를 보면, 방금 입력한 리뷰 본문이나 폼에 상시 표시되는
 * 안내 문구까지 성공으로 오탐한다. 반드시 없음 -> 있음 전이만 인정한다.
 */
const newlyAppearedSuccessText = (before) => {
  for (const needle of presentSuccessTexts()) {
    if (!before.has(needle)) return needle
  }
  return null
}

/**
 * 리뷰를 제출한다.
 * @param {Element} root 폼 루트
 * @param {{dryRun?: boolean, timeout?: number}} options
 */
export const submitReview = async (root, options = {}) => {
  const { dryRun = true, timeout = LIMITS.DEFAULT_TIMEOUT_MS } = options

  const button = findSubmitButton(root ?? document)
  if (!button) return err('등록 버튼을 찾지 못했습니다. 팝업 > 페이지 진단으로 구조를 확인해 주세요.')

  const warnings = findUncheckedAgreements(root).map(
    (checkbox) => `동의하지 않은 체크박스가 있습니다: ${checkbox.name || checkbox.id || 'unnamed'}`,
  )

  const buttonDisabled = isDisabled(button)

  if (dryRun) {
    return ok(
      Object.freeze({
        submitted: false,
        dryRun: true,
        buttonText: textOf(button),
        buttonDisabled,
        warnings: Object.freeze(
          buttonDisabled
            ? [...warnings, '등록 버튼이 아직 비활성 상태입니다. 필수 항목이 남아 있을 수 있습니다.']
            : warnings,
        ),
      }),
    )
  }

  if (buttonDisabled) {
    return err(
      '등록 버튼이 비활성 상태라 누를 수 없습니다. 별점·본문 외에 추가 평가 항목이 필수일 수 있습니다.',
    )
  }

  // 클릭 전 기준선을 잡아 둔다. 이미 떠 있던 문구는 성공 근거가 될 수 없다.
  const successTextsBefore = presentSuccessTexts()

  humanClick(button)

  return confirmSubmission({ root, successTextsBefore, timeout, warnings })
}

/**
 * 등록 버튼을 누른 뒤 성공 여부를 판정한다.
 * 1) 없다가 새로 나타난 성공 문구, 2) 폼이 닫힘 순으로 확인한다.
 */
const confirmSubmission = async ({ root, successTextsBefore, timeout, warnings }) => {
  const confirmed = await waitFor(() => newlyAppearedSuccessText(successTextsBefore), {
    timeout,
    label: '등록 완료 메시지',
  })
  if (confirmed.ok) {
    return ok(
      Object.freeze({
        submitted: true,
        dryRun: false,
        evidence: 'success-text',
        matchedText: confirmed.value,
        warnings: Object.freeze(warnings),
      }),
    )
  }

  // 성공 문구를 못 찾아도 폼이 닫혔으면 등록된 것으로 본다.
  const closed = await waitForFormGone(root, timeout)
  if (closed.ok) {
    return ok(Object.freeze({ submitted: true, dryRun: false, evidence: 'form-closed', warnings: Object.freeze(warnings) }))
  }

  return err(
    `등록 여부를 확인하지 못했습니다. 폼이 그대로 남아 있습니다. ${warnings.join(' ') || '필수 입력값이 빠졌을 수 있습니다.'}`,
  )
}
