/** 확장 전체에서 공유하는 상수 정의. */

/** background <-> content <-> popup 메시지 타입. */
export const MSG = Object.freeze({
  // popup -> background
  RUN_START: 'RUN_START',
  RUN_STOP: 'RUN_STOP',
  RUN_STATUS: 'RUN_STATUS',
  PROBE_PAGE: 'PROBE_PAGE',
  // background -> content
  PING: 'PING',
  SCAN_LIST: 'SCAN_LIST',
  OPEN_ITEM: 'OPEN_ITEM',
  FILL_FORM: 'FILL_FORM',
  SUBMIT_FORM: 'SUBMIT_FORM',
  LOAD_MORE: 'LOAD_MORE',
  PROBE_DUMP: 'PROBE_DUMP',
  // background -> popup (broadcast)
  RUN_PROGRESS: 'RUN_PROGRESS',
})

/** 실행 상태 값. */
export const RUN_PHASE = Object.freeze({
  IDLE: 'IDLE',
  SCANNING: 'SCANNING',
  WRITING: 'WRITING',
  STOPPING: 'STOPPING',
  DONE: 'DONE',
  FAILED: 'FAILED',
})

/** 개별 리뷰 처리 결과. */
export const ITEM_STATUS = Object.freeze({
  SUBMITTED: 'SUBMITTED',
  DRY_RUN: 'DRY_RUN',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED',
})

/** chrome.storage 키. */
export const STORAGE_KEY = Object.freeze({
  SETTINGS: 'settings',
  TEMPLATES: 'templates',
  RUN_STATE: 'runState',
  /** 중단 신호 전용. 오케스트레이터가 쓰지 않아 실행 상태 저장에 덮어써지지 않는다. */
  STOP_REQUEST: 'stopRequest',
})

/** 매직 넘버 제거용 기본 한계값. */
export const LIMITS = Object.freeze({
  MIN_REVIEW_LENGTH: 20,
  MAX_REVIEW_LENGTH: 1000,
  MAX_ITEMS_PER_RUN: 200,
  MAX_LIST_ENTRIES: 300,
  MAX_COMPOSE_ATTEMPTS: 12,
  DEFAULT_TIMEOUT_MS: 12000,
  POLL_INTERVAL_MS: 200,
  TAB_LOAD_TIMEOUT_MS: 20000,
  CONTENT_READY_TIMEOUT_MS: 15000,
  /**
   * 이 시간 이상 진행이 없는 활성 실행 상태는 서비스 워커가 죽어 남은 유령으로 본다.
   * 정상 최대 간격(건 사이 대기 120초 + 항목 처리)보다 넉넉히 크게 잡는다.
   */
  STALE_RUN_MS: 300000,
  /** 글자당 입력 지연 상한. */
  MAX_TYPING_DELAY_MS: 500,
  /** 항목 사이 대기 상한. */
  MAX_BETWEEN_ITEMS_MS: 120000,
  /** 입력 후 대기 상한. */
  MAX_AFTER_FILL_MS: 10000,
  SIMILARITY_THRESHOLD: 0.72,
})

/**
 * 폼 입력 대기 상한.
 *
 * 검증기가 허용하는 **최악의 조합**(최대 글자 수 x 최대 글자 지연)을 담을 수 있어야 한다.
 * 상수를 따로 두면 "검증기는 통과시키는데 타임아웃은 못 기다리는" 모순이 생기고,
 * background 가 타이핑 도중 항목을 실패 처리하며 폼 창을 닫아 버린다.
 */
export const MAX_FILL_TIMEOUT_MS =
  LIMITS.CONTENT_READY_TIMEOUT_MS +
  LIMITS.MAX_REVIEW_LENGTH * LIMITS.MAX_TYPING_DELAY_MS +
  LIMITS.DEFAULT_TIMEOUT_MS
