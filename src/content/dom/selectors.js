/**
 * ============================================================================
 *  네이버 DOM 이 바뀌면 이 파일만 고치면 된다. (다른 파일은 손대지 말 것)
 * ============================================================================
 * 난독화된 클래스명(_1ab2c)은 배포마다 바뀌므로 후보 목록에 넣지 않는다.
 * 대신 (1) 버튼/링크의 화면 표시 텍스트, (2) role/aria 속성, (3) 태그+속성 패턴
 * 세 가지 전략을 순서대로 시도한다.
 *
 * 실제 값을 확인하려면 리뷰 페이지에서 팝업 > "페이지 진단"을 실행하고
 * 출력된 JSON 을 보고 아래 텍스트/셀렉터를 보강하면 된다.
 */

/**
 * 리뷰 작성 목록 페이지.
 *
 * 2026-08-27 https://shopping.naver.com/my/writable-reviews 실측 기준.
 * 네이버는 CSS Modules 를 쓰므로 클래스명이 "의미있는접두어__해시" 형태다.
 * 해시는 배포마다 바뀌니 접두어만 부분 매칭한다.
 */
export const LIST = Object.freeze({
  /**
   * 작성 버튼 텍스트 후보. 목록 항목은 이 버튼에서 역추적한다.
   * 실측 문구: "리뷰쓰기", "한달사용리뷰 쓰기", "리뷰쓰고 최대 {150|300|350|650}원 받기".
   * 금액이 가변이므로 "리뷰쓰고" 처럼 접두어만 넣는다.
   */
  writeTriggerTexts: Object.freeze([
    '리뷰 쓰기',
    '리뷰쓰기',
    '리뷰쓰고',
    '리뷰 작성',
    '리뷰작성',
    '후기 쓰기',
    '후기 작성',
    '한달사용',
    '첫 리뷰 쓰기',
  ]),
  /**
   * 항목 컨테이너. 트리거가 이 안에 있어야 실제 작성 버튼으로 인정한다.
   * 헤더와 좌측 메뉴에도 "리뷰 작성" 링크가 있어 이 제한이 없으면 오탐한다.
   * 페이지에서 컨테이너를 하나도 못 찾으면 이 제한을 적용하지 않는다(구조 변경 대비).
   */
  itemContainerSelectors: Object.freeze([
    '[class*="WritableReviewListItem_list_item"]',
    '[class*="ReviewListItem_list_item"]',
    '[class*="ListItem_list_item"]',
    'li',
    'tr',
    'article',
    '[role="listitem"]',
  ]),
  /** 한달사용기 항목 표시. 일반 리뷰와 폼 구조가 다를 수 있어 구분한다. */
  monthlyReviewTexts: Object.freeze(['한달사용', '한달 사용']),
  /** 이미 작성된 항목에 나타나는 텍스트 — 목록에서 걸러낸다. */
  alreadyWrittenTexts: Object.freeze(['작성완료', '작성 완료', '리뷰 확인', '작성한 리뷰', '수정하기']),
  /** 항목 안에서 상품명을 찾을 셀렉터 후보. 구체적인 것부터 시도한다. */
  productNameSelectors: Object.freeze([
    '[class*="ListItemInfo_link_title"]',
    '[class*="link_title"]',
    '[class*="productName"]',
    '[class*="product_name"]',
    '[class*="goodsName"]',
    'strong',
    'h3',
    'h4',
    'a[href*="products"]',
  ]),
  /** 항목 안에서 스토어명을 찾을 셀렉터 후보. */
  storeNameSelectors: Object.freeze([
    '[class*="ListItemInfo_link_store"]',
    '[class*="link_store"]',
    '[class*="mallName"]',
    '[class*="storeName"]',
    '[class*="seller"]',
    'a[href*="smartstore"]',
  ]),
  /** 목록 더 불러오기 버튼. */
  loadMoreTexts: Object.freeze(['더보기', '더 보기', '더불러오기']),
})

/** 리뷰 작성 폼(레이어 팝업 또는 별도 페이지). */
export const FORM = Object.freeze({
  /** 폼이 열렸는지 판정할 컨테이너 후보. 첫 번째로 발견되는 것을 폼 루트로 쓴다. */
  rootSelectors: Object.freeze([
    '[role="dialog"]',
    '[class*="reviewWrite"]',
    '[class*="review_write"]',
    '[class*="ReviewWrite"]',
    'form[class*="review"]',
    '[class*="layer_review"]',
    'main',
    'body',
  ]),
  /** 별점: 1순위 — 라디오 인풋. */
  ratingRadioSelectors: Object.freeze([
    'input[type="radio"][name*="rating" i]',
    'input[type="radio"][name*="score" i]',
    'input[type="radio"][name*="star" i]',
    'input[type="radio"][name*="grade" i]',
    'input[type="radio"][name*="point" i]',
  ]),
  /** 별점: 2순위 — role=radio 위젯. */
  ratingRoleSelectors: Object.freeze(['[role="radiogroup"] [role="radio"]', '[role="radio"]']),
  /** 별점: 3순위 — 별 아이콘 묶음. 자식 순서로 N번째를 클릭한다. */
  ratingStarContainerSelectors: Object.freeze([
    '[class*="starRating"]',
    '[class*="star_rating"]',
    '[class*="StarRating"]',
    '[class*="grade"]',
    '[class*="score"]',
  ]),
  /** 별점: 4순위 — aria-label/title 에 "N점" 이 들어간 요소. */
  ratingLabelTemplate: (rating) => Object.freeze([`${rating}점`, `별점 ${rating}`, `${rating}점 만점`]),
  /** 본문 입력 필드 후보. */
  textInputSelectors: Object.freeze([
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"][maxlength]',
  ]),
  /** 본문 입력 필드로 착각하기 쉬운 것들 — 제외한다. */
  textInputExcludeSelectors: Object.freeze([
    '[type="search"]',
    '[name*="search" i]',
    '[placeholder*="검색"]',
    '[aria-label*="검색"]',
  ]),
  /** 등록 버튼 텍스트 후보. */
  submitTexts: Object.freeze(['리뷰 등록', '리뷰등록', '등록하기', '작성 완료', '작성완료', '등록', '저장', '완료']),
  /** 등록 버튼과 혼동되면 안 되는 텍스트. */
  submitExcludeTexts: Object.freeze(['취소', '닫기', '삭제', '임시저장', '이전']),
  /**
   * 제출 성공 판정에 쓰는 텍스트.
   * "완료"를 뜻하는 구체적 표현만 넣는다. "적립", "감사합니다" 같은 일반적 문구는
   * 폼에 상시 표시되는 안내나 리뷰 본문 자체와 충돌해 성공을 오탐한다.
   */
  successTexts: Object.freeze(['등록되었습니다', '작성이 완료', '리뷰가 등록', '등록이 완료']),
  /**
   * 상품 평가 설문 그룹. 별점과 같은 role 을 쓰지만 선택지 개수가 다르다(실측 3개).
   * 등록 버튼이 초기에 비활성이라 이 설문이 필수일 수 있다.
   */
  surveyGroupSelectors: Object.freeze([
    '[class*="evaluation_grade_rating"]',
    '[class*="evaluation"][role="radiogroup"]',
    '[role="radiogroup"]',
  ]),
  /** 필수 동의 체크박스 후보. */
  agreementSelectors: Object.freeze(['input[type="checkbox"][name*="agree" i]', 'input[type="checkbox"][id*="agree" i]']),
})

/** 진단 모드에서 훑을 관심 셀렉터. */
export const PROBE_SELECTORS = Object.freeze([
  'textarea',
  '[contenteditable="true"]',
  '[role="textbox"]',
  'input[type="radio"]',
  '[role="radio"]',
  '[role="radiogroup"]',
  'input[type="checkbox"]',
  'button',
  'a[href]',
  '[role="button"]',
  '[role="dialog"]',
  'form',
])
