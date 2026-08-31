/** 확장 페이지(팝업/옵션)에서 서비스 워커로 메시지를 보낸다. */

export const sendToBackground = (type, payload) =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      const failure = chrome.runtime.lastError
      if (failure) {
        resolve({ ok: false, error: `백그라운드 응답 없음: ${failure.message}` })
        return
      }
      if (!response || typeof response.ok !== 'boolean') {
        resolve({ ok: false, error: '백그라운드 응답 형식이 올바르지 않습니다.' })
        return
      }
      resolve(response)
    })
  })

/** 상태 메시지를 표시한다. */
export const showNotice = (element, message, kind = 'info') => {
  if (!element) return
  element.textContent = message
  element.className = `notice${kind === 'info' ? '' : ` ${kind}`}`
  element.hidden = message === ''
}
