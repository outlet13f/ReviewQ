/**
 * MV3 content_scripts 는 ES 모듈을 직접 지원하지 않는다.
 * 그래서 클래식 스크립트로 진입한 뒤 동적 import 로 모듈 그래프를 불러온다.
 * (빌드 도구 없이 파일을 작게 유지하기 위한 선택)
 */

;(async () => {
  if (window.__REVIEWQ_LOADED__ === true) return
  window.__REVIEWQ_LOADED__ = true

  try {
    await import(chrome.runtime.getURL('src/content/content.js'))
  } catch (error) {
    window.__REVIEWQ_LOADED__ = false
    console.error('[ReviewQ][loader] 콘텐츠 모듈 로드 실패', error)
  }
})()
