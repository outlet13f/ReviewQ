/**
 * 카테고리별 문장 풀. negative 톤은 정의하지 않고 기본 세트로 폴백한다
 * (1~2점 리뷰는 카테고리별로 나눌 실익이 적음).
 */

export const fashionSet = Object.freeze({
  id: 'fashion',
  name: '의류 / 패션',
  tones: Object.freeze({
    positive: Object.freeze({
      patterns: Object.freeze([
        '{fit} {material} {closing}',
        '{material} {color} {fit} {closing}',
        '{fit} {color} {closing}',
        '{material} {fit} {filler} {closing}',
      ]),
      slots: Object.freeze({
        fit: Object.freeze([
          '사이즈는 평소 입는 대로 주문했는데 잘 맞았어요.',
          '실측 사이즈를 보고 골랐더니 딱 맞습니다.',
          '품이 넉넉해서 편하게 입기 좋아요.',
          '기장이 생각한 만큼 나와서 만족합니다.',
        ]),
        material: Object.freeze([
          '원단이 얇지 않고 적당히 두께가 있어요.',
          '촉감이 부드러워서 살에 닿는 느낌이 좋습니다.',
          '세탁 후에도 모양이 크게 변하지 않았어요.',
          '비침 없이 단정하게 입을 수 있습니다.',
          '봉제선이 깔끔해서 마감이 잘 되어 있어요.',
        ]),
        color: Object.freeze([
          '색상이 화면과 거의 같아서 좋았어요.',
          '생각보다 차분한 색이라 오히려 마음에 듭니다.',
          '코디하기 편한 색이라 활용도가 높아요.',
        ]),
        closing: Object.freeze([
          '자주 입게 될 것 같아요.',
          '다른 색도 하나 더 살까 고민 중입니다.',
          '가격 생각하면 충분히 만족합니다.',
          '잘 입겠습니다.',
        ]),
        filler: Object.freeze([
          '평소 입는 옷들과 같이 코디하기 좋았습니다.',
          '출근용으로도 무난하게 입을 수 있어요.',
        ]),
      }),
    }),
    neutral: Object.freeze({
      patterns: Object.freeze(['{fit} {material} {closing}', '{material} {color} {closing}', '{fit} {filler} {closing}']),
      slots: Object.freeze({
        fit: Object.freeze([
          '사이즈가 미묘하게 애매해서 한 치수 고민됩니다.',
          '품은 맞는데 기장이 약간 아쉬웠어요.',
        ]),
        material: Object.freeze(['원단이 생각보다 얇습니다.', '촉감은 보통이에요.']),
        color: Object.freeze(['색은 화면보다 조금 어둡네요.']),
        closing: Object.freeze(['가격 생각하면 이 정도라고 봅니다.', '무난하게 입을 수는 있어요.']),
        filler: Object.freeze(['계절에 따라 활용도가 갈릴 것 같습니다.']),
      }),
    }),
  }),
})

export const foodSet = Object.freeze({
  id: 'food',
  name: '식품 / 신선식품',
  tones: Object.freeze({
    positive: Object.freeze({
      patterns: Object.freeze([
        '{freshness} {taste} {closing}',
        '{taste} {quantity} {closing}',
        '{freshness} {taste} {quantity} {closing}',
        '{taste} {filler} {closing}',
      ]),
      slots: Object.freeze({
        freshness: Object.freeze([
          '아이스팩이 충분히 들어 있어서 신선하게 도착했어요.',
          '포장이 꼼꼼해서 내용물이 새지 않았습니다.',
          '유통기한이 넉넉하게 남아 있었어요.',
          '냉장 상태 그대로 잘 받았습니다.',
        ]),
        taste: Object.freeze([
          '간이 세지 않아서 부담 없이 먹었어요.',
          '잡내 없이 깔끔한 맛이었습니다.',
          '생각보다 훨씬 맛있어서 금방 비웠어요.',
          '아이도 잘 먹어서 다행이었습니다.',
          '재료가 실하게 들어 있어서 만족했어요.',
        ]),
        quantity: Object.freeze([
          '양이 넉넉해서 여러 번 나눠 먹기 좋습니다.',
          '소분되어 있어서 꺼내 먹기 편했어요.',
          '가격 대비 양이 괜찮았습니다.',
        ]),
        closing: Object.freeze([
          '떨어지면 또 주문할 생각이에요.',
          '가족들도 좋아해서 재구매 예정입니다.',
          '맛있게 잘 먹었습니다.',
        ]),
        filler: Object.freeze(['간단히 데워서 먹기 좋았어요.', '보관하기도 편했습니다.']),
      }),
    }),
    neutral: Object.freeze({
      patterns: Object.freeze(['{taste} {quantity} {closing}', '{freshness} {taste} {closing}', '{taste} {filler} {closing}']),
      slots: Object.freeze({
        freshness: Object.freeze(['배송 상태는 무난했습니다.']),
        taste: Object.freeze([
          '맛은 평범한 편이에요.',
          '제 입맛에는 살짝 짰습니다.',
          '특별히 인상적인 맛은 아니었어요.',
        ]),
        quantity: Object.freeze(['양은 생각보다 적었습니다.']),
        closing: Object.freeze(['한 번 먹어 볼 만은 합니다.', '재구매는 고민해 볼게요.']),
        filler: Object.freeze(['취향 차이가 클 것 같아요.']),
      }),
    }),
  }),
})

export const digitalSet = Object.freeze({
  id: 'digital',
  name: '전자 / 디지털',
  tones: Object.freeze({
    positive: Object.freeze({
      patterns: Object.freeze([
        '{setup} {performance} {closing}',
        '{performance} {build} {closing}',
        '{setup} {performance} {build} {closing}',
        '{performance} {filler} {closing}',
      ]),
      slots: Object.freeze({
        setup: Object.freeze([
          '설명서대로 하니 설치가 어렵지 않았어요.',
          '연결이 바로 잡혀서 세팅이 금방 끝났습니다.',
          '별도 설치 없이 바로 인식됐어요.',
        ]),
        performance: Object.freeze([
          '작동이 조용해서 신경 쓰이지 않습니다.',
          '발열이 심하지 않아서 안심됩니다.',
          '반응 속도가 빨라서 쓰기 편해요.',
          '배터리가 생각보다 오래 갑니다.',
          '며칠 켜 놨는데 끊김 없이 잘 돌아갑니다.',
        ]),
        build: Object.freeze([
          '마감이 단단해서 저렴해 보이지 않아요.',
          '케이블이나 부속품도 빠짐없이 들어 있었습니다.',
          '크기가 작아서 자리 차지를 덜 합니다.',
        ]),
        closing: Object.freeze([
          '이 가격에 이 정도면 만족합니다.',
          '필요한 사람에게 추천할 만해요.',
          '잘 쓰겠습니다.',
        ]),
        filler: Object.freeze([
          '사용 환경에 따라 다를 수 있지만 저는 문제없었어요.',
          '장시간 써 봐도 이상은 없었습니다.',
        ]),
      }),
    }),
    neutral: Object.freeze({
      patterns: Object.freeze(['{performance} {build} {closing}', '{setup} {performance} {closing}', '{performance} {filler} {closing}']),
      slots: Object.freeze({
        setup: Object.freeze(['설치에 시간이 조금 걸렸습니다.']),
        performance: Object.freeze(['성능은 딱 가격만큼입니다.', '가끔 반응이 느릴 때가 있어요.']),
        build: Object.freeze(['마감은 평범한 수준이에요.']),
        closing: Object.freeze(['가격을 감안하면 이 정도라고 봅니다.', '무난합니다.']),
        filler: Object.freeze(['용도에 따라 갈릴 것 같습니다.']),
      }),
    }),
  }),
})

export const livingSet = Object.freeze({
  id: 'living',
  name: '생활용품 / 주방',
  tones: Object.freeze({
    positive: Object.freeze({
      patterns: Object.freeze([
        '{usability} {quality} {closing}',
        '{quality} {value} {closing}',
        '{usability} {quality} {value} {closing}',
        '{usability} {filler} {closing}',
      ]),
      slots: Object.freeze({
        usability: Object.freeze([
          '손잡이가 편해서 다루기 쉬웠어요.',
          '생각한 자리에 딱 들어가서 좋았습니다.',
          '가벼워서 옮기기 편합니다.',
          '세척이 간단해서 관리가 수월해요.',
        ]),
        quality: Object.freeze([
          '재질이 튼튼해서 오래 쓸 것 같습니다.',
          '냄새 없이 깔끔했어요.',
          '마감이 매끄러워서 손이 걸리지 않습니다.',
        ]),
        value: Object.freeze([
          '이 가격에 이 정도 구성이면 괜찮습니다.',
          '묶음으로 사니 더 저렴했어요.',
          '필요한 만큼 딱 왔습니다.',
        ]),
        closing: Object.freeze(['집에서 잘 쓰고 있어요.', '하나 더 살까 생각 중입니다.', '만족합니다.']),
        filler: Object.freeze([
          '생활용품은 이 정도면 충분하다고 봅니다.',
          '매일 쓰는 물건이라 더 만족스러워요.',
        ]),
      }),
    }),
    neutral: Object.freeze({
      patterns: Object.freeze(['{usability} {quality} {closing}', '{quality} {value} {closing}', '{usability} {filler} {closing}']),
      slots: Object.freeze({
        usability: Object.freeze(['쓰는 데 큰 불편은 없습니다.']),
        quality: Object.freeze(['재질이 조금 얇아 보여요.', '마감이 아주 매끄럽지는 않네요.']),
        value: Object.freeze(['가격 생각하면 무난합니다.']),
        closing: Object.freeze(['당장 쓰기엔 문제없어요.', '보통입니다.']),
        filler: Object.freeze(['오래 써 봐야 알 것 같습니다.']),
      }),
    }),
  }),
})
