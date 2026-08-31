# 셀렉터 보정 가이드

네이버 페이지가 개편되어 확장이 요소를 못 찾을 때, **`src/content/dom/selectors.js` 한 파일만** 고치면 됩니다. 이 문서는 진단 출력을 읽고 그 파일의 어느 항목을 바꿔야 하는지 알려 줍니다.

## 1. 진단 실행

문제가 생긴 페이지(목록 또는 리뷰 작성 폼)에서 확장 팝업 → **페이지 진단**.

출력은 두 부분입니다.

```jsonc
{
  "resolved": {          // 확장이 "지금 무엇을 고를지" — 여기부터 봅니다
    "formRoot":     { "tag": "div", "attributes": { "role": "dialog" }, "path": "..." },
    "textInput":    { "tag": "textarea", "contentLength": 0, "attributes": { ... } },
    "submitButton": { "tag": "button", "text": "리뷰 등록" },
    "writeTriggerCount": 7,
    "writeTriggers": [ ... ]
  },
  "bySelector": {        // 페이지에 실제로 있는 요소들 — resolved 가 null 일 때 봅니다
    "textarea": { "count": 1, "samples": [ ... ] },
    "input[type=\"radio\"]": { "count": 5, "samples": [ ... ] },
    ...
  }
}
```

입력 필드의 내용은 담기지 않습니다(`text`는 빈 문자열, `contentLength`만 기록). 그대로 복사해 공유해도 됩니다.

## 2. 증상별 대응

### 목록에서 항목을 못 찾음 (`작성 가능한 리뷰를 찾지 못했습니다`)

`resolved.writeTriggerCount`가 `0`입니다.

`bySelector.button`과 `bySelector["a[href]"]`의 `samples[].text`를 훑어 실제 버튼 문구를 찾습니다. 예를 들어 `"리뷰 남기기"`라면:

```js
// LIST.writeTriggerTexts 에 추가
writeTriggerTexts: Object.freeze([
  '리뷰 쓰기',
  '리뷰 남기기',   // ← 추가
  ...
]),
```

이미 작성한 항목까지 잡힌다면 `LIST.alreadyWrittenTexts`에 해당 문구를 추가합니다.

### 상품명이 비어 있음 (`key`가 `text:...` 또는 `index:...`)

동작에는 문제없지만 로그가 읽기 어려워집니다. 항목 컨테이너 안 상품명 요소의 태그/클래스를 확인해 `LIST.productNameSelectors` 앞쪽에 추가하세요. **후보는 순서대로 시도되므로 더 구체적인 것을 앞에 둡니다.**

```js
productNameSelectors: Object.freeze([
  '[class*="goodsTitle"]',   // ← 구체적인 것을 앞에
  '[class*="productName"]',
  'strong',
  ...
]),
```

### 폼을 못 찾음 (`리뷰 작성 폼을 찾지 못했습니다`)

`resolved.formRoot`가 `null`입니다. 원인은 둘 중 하나입니다.

**(a) 본문 입력칸을 못 찾음** — `resolved.textInput`도 `null`입니다. `bySelector`에서 `textarea` / `[contenteditable="true"]` / `[role="textbox"]`의 `count`를 확인하세요. 셋 다 `0`이면 다른 형태이므로 `FORM.textInputSelectors`에 추가합니다.

`count`는 1 이상인데 `textInput`이 `null`이면 제외 규칙에 걸린 것입니다. `FORM.textInputExcludeSelectors`를 확인하세요 (`placeholder`에 "검색"이 들어가면 제외됩니다).

**(b) 폼 컨테이너를 못 감쌈** — `textInput`은 찾았는데 `formRoot`가 `null`인 경우입니다. `FORM.rootSelectors`에 `body`가 있으니 보통 여기까지 오지 않습니다. 왔다면 입력칸이 `iframe` 안에 있을 가능성이 큽니다(현재 미지원).

### 별점이 안 눌림 (`별점 위젯을 찾지 못했습니다`)

전략은 다음 순서로 시도됩니다. `bySelector`에서 어느 것이 존재하는지 확인하세요.

| 순서 | 전략 | 확인할 `bySelector` 키 | 고칠 항목 |
| --- | --- | --- | --- |
| 1 | 라디오 인풋 | `input[type="radio"]` | `FORM.ratingRadioSelectors` |
| 2 | role=radio | `[role="radio"]`, `[role="radiogroup"]` | `FORM.ratingRoleSelectors` |
| 3 | "N점" 라벨 | `button`, `[role="button"]` 의 `aria-label` | `FORM.ratingLabelTemplate` |
| 4 | 별 아이콘 5개 | — | `FORM.ratingStarContainerSelectors` |

**전략 1이 가장 신뢰도 높습니다** (`checked`로 성공을 검증할 수 있는 유일한 방법). `input[type="radio"]`의 `count`가 5인데도 실패하면 `name` 속성을 확인하세요. 셀렉터는 `name`에 `rating|score|star|grade|point`가 들어가는 것만 잡습니다.

```js
ratingRadioSelectors: Object.freeze([
  'input[type="radio"][name*="reviewLevel" i]',   // ← 실제 name 추가
  ...
]),
```

라디오가 5개보다 많으면 다른 평가 항목과 섞인 것입니다. 확장은 **같은 `name`으로 묶어 5개짜리 그룹을 우선**하므로 보통 알아서 처리됩니다.

전략 4는 자식이 **정확히 5개**인 컨테이너만 대상으로 합니다. 별 사이에 구분자 요소가 있으면 6개 이상이 되어 건너뜁니다. 이때는 컨테이너를 더 안쪽 요소로 지정하세요.

### 등록 버튼이 안 눌림 (`등록 버튼을 찾지 못했습니다`)

`bySelector.button`의 `samples[].text`에서 실제 문구를 찾아 `FORM.submitTexts`에 추가합니다.

**순서가 중요합니다.** 구체적인 문구를 앞에 두세요. `'등록'`이 `'리뷰 등록'`보다 앞에 있으면 다른 "등록" 버튼을 먼저 잡을 수 있습니다.

```js
submitTexts: Object.freeze([
  '리뷰 등록',      // 구체적
  '등록하기',
  '등록',           // 일반적 — 뒤에
  ...
]),
```

엉뚱한 버튼을 누른다면 `FORM.submitExcludeTexts`에 그 문구를 추가하세요.

### 등록했는데 실패로 기록됨 (`등록 여부를 확인하지 못했습니다`)

등록은 됐지만 성공 판정을 못 한 경우입니다. 성공 후 화면에 뜨는 문구를 `FORM.successTexts`에 추가하세요.

```js
successTexts: Object.freeze(['등록되었습니다', '리뷰 작성 완료', ...]),
```

**추가할 문구를 고를 때 두 가지 규칙을 지켜야 합니다.**

1. **"완료"를 뜻하는 구체적 표현만 넣으세요.** 확장은 등록 버튼을 누른 뒤 페이지 전체에서 이 문구를 찾습니다. `적립`, `감사합니다`, `포인트` 같은 일반적인 낱말은 리뷰 폼에 상시 표시되는 안내("리뷰 작성 시 최대 500원 적립")나 **리뷰 본문 자체**와 충돌합니다. 실제로 기본 템플릿의 마무리 문장 "잘 쓰겠습니다, 감사합니다."가 9.7% 확률로 생성되어, 그 본문을 입력하는 순간 성공이 오탐됐습니다.

2. **클릭 전부터 있던 문구는 근거가 되지 않습니다.** 확장은 등록 버튼을 누르기 직전에 어떤 문구가 이미 떠 있는지 기록해 두고, **없다가 새로 나타난 문구만** 성공으로 인정합니다. 그러니 폼에 항상 떠 있는 문구를 추가해 봐야 아무 효과가 없습니다. 등록 후에만 나타나는 문구를 골라야 합니다.

`tests/invariants.test.js`가 이 두 규칙을 자동으로 검사합니다. 생성되는 리뷰 본문과 겹치는 문구를 추가하면 테스트가 실패합니다.

성공 문구를 못 찾아도 **폼이 사라지면 등록으로 간주**하므로, 레이어 팝업 방식이면 보통 자동으로 통과합니다.

## 3. 고친 뒤 확인

```bash
npm run lint:manifest    # 경로가 깨지지 않았는지
npm test                 # 셀렉터를 참조하는 테스트가 통과하는지
```

그다음 `chrome://extensions`에서 확장 새로고침 → **드라이런으로** 재확인하세요.

## 4. shadow DOM

`deepQueryAll`은 기본적으로 shadow root 안쪽을 뒤지지 않습니다. shadow root를 찾으려면 `querySelectorAll('*')`로 트리 전체를 매번 배열화해야 하는데, 폼 탐색은 이 함수를 한 번에 수십 번 호출하고 `waitForForm`이 그걸 200ms마다 반복하기 때문입니다.

**진단 모드는 예외로 shadow DOM까지 훑습니다.** 그러니 진단 결과에는 요소가 보이는데 확장이 못 찾는다면, 그 요소가 shadow root 안에 있을 가능성이 큽니다. 이때는 해당 탐색 경로에 `{ pierceShadow: true }`를 넘기면 됩니다.

## 5. 원칙

새 셀렉터를 추가할 때 지킬 것:

- **난독화된 클래스명을 쓰지 마세요.** `._1ab2c3` 같은 값은 다음 배포에서 바뀝니다. `[class*="review"]`처럼 부분 일치는 괜찮습니다.
- **화면에 보이는 텍스트를 우선하세요.** 문구는 클래스명보다 훨씬 오래 유지됩니다.
- **후보는 구체적인 것부터 나열하세요.** 앞에서부터 순서대로 시도합니다.
- **`selectors.js` 밖은 고치지 마세요.** 다른 파일을 고쳐야 한다면 셀렉터 문제가 아니라 구조 문제입니다.
