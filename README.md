# 📚 AI 한국어 단어 1,000

단순한 기계적 암기를 넘어, AI와 함께 문맥과 뉘앙스까지 완벽하게 익히는 **스마트 한국어 어휘 학습 웹 서비스**입니다. 
사용자가 직접 뜻을 서술하면 인공지능 선생님이 실시간으로 1:1 첨삭 채점을 진행하여 단어를 온전히 내 것으로 만들 수 있도록 돕습니다.

---

## ✨ 주요 기능

### 1. 스마트 플래시카드 & AI 맞춤 첨삭
- 단어를 보고 뜻을 스스로 유추하여 직접 타이핑하는 주도적 학습 경험을 제공합니다.
- 사용자가 작성한 뜻풀이를 바탕으로 **AI(Gemini)가 정답 여부를 판정하고, 상세한 피드백과 뉘앙스 차이**를 실시간으로 설명해 줍니다.

### 2. 살아있는 예문 및 깊이 있는 어원 해설
- 실생활에서 쓰이는 자연스러운 맞춤형 예문을 즉석에서 생성하여 문맥 속 쓰임새를 파악할 수 있게 합니다.
- 어려운 사자성어나 한자어의 경우, 단어를 한자 단위로 분해하고 깊이 있는 어원 해설을 제공합니다.

### 3. 망각 곡선에 맞춘 복습장 (Review System)
- 학습한 단어를 `🔴 시급(오답)`, `🟡 학습 중(부분 정답)`, `🟢 완벽 암기` 상태로 자동 분류합니다.
- 탭 형태의 직관적인 대시보드와 필터 기능을 통해, 취약한 단어들만 모아서 집중적으로 복습할 수 있습니다.

### 4. 눈이 편안한 프리미엄 UI 디자인
- 장시간 텍스트 환경에 노출되는 학습자를 위해, 전 세계 개발자들에게 검증된 **'Solarized Light' 테마 색상 팔레트**를 전면 도입했습니다.
- 불필요한 그림자와 장식을 배제한 Flat 디자인과 넓은 여백, 그리고 가독성이 높은 **리디바탕(RIDIBatang)** 서체를 사용해 높은 몰입감을 제공합니다.

---

## 🚀 사용 기술 (Tech Stack)

* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3, Tailwind CSS v4
* **Backend & AI Engine:** Cloudflare Workers, Google Gemini AI API
* **Database & Storage:** 
  * Cloudflare KV (방대한 AI 생성 해설 및 예문 캐싱 데이터 영속성 유지)
  * Local Storage (개별 사용자의 학습 진행률 및 채점 이력 등 상태 데이터 관리)
* **Typography:** Wanted Sans Variable (베이스 폰트), RIDIBatang (단어 강조 표제어 폰트)
* **Deployment:** Cloudflare Pages 기반의 빠르고 정적인 자동 배포 체계

---

## 💡 시작하기

이 애플리케이션은 복잡한 노드 환경 구성이나 빌드 과정 없이 가볍게 구동되는 정적 웹 구조로 설계되었습니다.

1. 저장소를 클론(Clone)하거나 다운로드 받습니다.
2. 루트 폴더의 `index.html` 파일을 최신 웹 브라우저(Chrome, Edge, Safari 등)에서 엽니다.
3. 곧바로 1,000개의 엄선된 국어 단어 학습을 시작할 수 있습니다.

*(참고: AI 통신 및 채점 서버는 Cloudflare Workers 환경에 이미 배포되어 연결되어 있으므로 즉시 작동합니다.)*

---

<div align="center">
  <br/>
  <sub>
    <b>Designed & Developed by Seungju Ko in 2026.</b><br/>
    Powered by <b>Google Gemini AI</b> to provide an immersive and intelligent learning experience.
  </sub>
</div>
