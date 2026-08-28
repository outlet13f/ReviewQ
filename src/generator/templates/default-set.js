/** 전체 상품에 쓰는 기본 문장 풀. 다른 세트가 특정 톤을 정의하지 않으면 여기로 폴백한다. */

export const defaultSet = Object.freeze({
  id: 'default',
  name: '기본 (전체 상품)',
  tones: Object.freeze({
    positive: Object.freeze({
      patterns: Object.freeze([
        '{delivery} {quality} {closing}',
        '{quality} {delivery} {closing}',
        '{delivery} {quality} {filler} {closing}',
        '{quality} {filler} {closing}',
        '{delivery} {quality}',
      ]),
      slots: Object.freeze({
        delivery: Object.freeze([
          '주문하고 이틀 만에 도착했어요.',
          '배송이 생각보다 훨씬 빨라서 좋았습니다.',
          '포장이 꼼꼼해서 파손 없이 잘 받았어요.',
          '택배 상자 안에 완충재가 넉넉히 들어 있었습니다.',
          '발송 알림도 제때 와서 기다리기 편했어요.',
          '주말에 주문했는데 예상보다 일찍 왔네요.',
          '포장 상태가 깔끔해서 선물용으로도 괜찮을 것 같아요.',
          '배송이 짧게 걸려서 급하게 필요했던 참에 딱 맞았습니다.',
        ]),
        quality: Object.freeze([
          '실물이 사진과 거의 같아서 만족합니다.',
          '마감 처리가 깔끔해서 손이 자주 갈 것 같아요.',
          '가격대를 생각하면 품질이 기대 이상이었습니다.',
          '생각했던 용도에 잘 맞아서 바로 쓰고 있어요.',
          '설명에 적힌 그대로여서 따로 아쉬운 점이 없었습니다.',
          '첫인상부터 튼튼해 보여서 오래 쓸 수 있을 것 같아요.',
          '무게나 크기가 부담스럽지 않아서 다루기 편합니다.',
          '며칠 써 봤는데 아직 별다른 문제는 없었어요.',
          '디테일에 신경 쓴 티가 나서 마음에 듭니다.',
          '이전에 쓰던 것보다 확실히 나아서 바꾼 게 잘한 선택이었어요.',
        ]),
        closing: Object.freeze([
          '다음에도 필요하면 여기서 또 살 것 같아요.',
          '고민하는 분들께는 추천할 만합니다.',
          '잘 쓰겠습니다, 감사합니다.',
          '전체적으로 만족스러운 구매였어요.',
          '주변에도 한번 권해 볼 생각입니다.',
          '재구매 의사 있습니다.',
          '무난하게 좋았어요.',
          '판매자분 응대도 좋아서 기분 좋게 받았습니다.',
        ]),
        filler: Object.freeze([
          '사용하면서 특별히 불편한 점은 없었습니다.',
          '가격 대비 만족도가 높은 편이에요.',
          '받아 보고 나서 기대했던 만큼은 나왔다고 생각합니다.',
          '고민했던 시간이 아깝지 않았어요.',
        ]),
      }),
    }),
    neutral: Object.freeze({
      patterns: Object.freeze([
        '{delivery} {quality} {closing}',
        '{quality} {closing}',
        '{delivery} {quality} {filler} {closing}',
      ]),
      slots: Object.freeze({
        delivery: Object.freeze([
          '배송은 평균적인 수준이었어요.',
          '포장은 특별할 것 없이 무난했습니다.',
          '받는 데까지 며칠 걸렸어요.',
          '배송 기간은 안내받은 대로였습니다.',
        ]),
        quality: Object.freeze([
          '기대했던 만큼은 아니지만 못 쓸 정도는 아니에요.',
          '가격을 생각하면 이 정도인가 싶습니다.',
          '장단점이 반반이라 아주 만족스럽진 않네요.',
          '사진과 조금 차이가 있어서 살짝 아쉬웠습니다.',
          '쓰는 데 문제는 없지만 특별히 좋다고 하기도 어려워요.',
        ]),
        closing: Object.freeze([
          '일단 쓰던 대로 계속 써 볼 생각입니다.',
          '그럭저럭 쓸 만합니다.',
          '다음엔 다른 것도 비교해 볼 것 같아요.',
          '보통이라고 생각합니다.',
        ]),
        filler: Object.freeze([
          '크게 문제 될 부분은 없었습니다.',
          '용도에 따라 평가가 갈릴 것 같아요.',
        ]),
      }),
    }),
    negative: Object.freeze({
      patterns: Object.freeze(['{quality} {closing}', '{delivery} {quality} {closing}', '{quality} {filler} {closing}']),
      slots: Object.freeze({
        delivery: Object.freeze([
          '배송이 예상보다 오래 걸렸습니다.',
          '포장이 부실해서 받았을 때 걱정됐어요.',
        ]),
        quality: Object.freeze([
          '설명과 다른 부분이 있어서 아쉬웠습니다.',
          '마감이 매끄럽지 않아 실망했어요.',
          '기대했던 품질과는 차이가 컸습니다.',
          '받자마자 상태를 다시 확인해야 했어요.',
        ]),
        closing: Object.freeze([
          '재구매는 고민해 봐야 할 것 같습니다.',
          '개선되면 좋겠습니다.',
        ]),
        filler: Object.freeze([
          '구매 전에 상세 정보를 더 확인하시는 게 좋겠어요.',
          '같은 값이면 다른 선택지도 보시길 권합니다.',
        ]),
      }),
    }),
  }),
})
