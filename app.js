const STORAGE_KEY = 'korean_words_progress_v2';
const WORKER_URL = "https://korean-words.seungju-rocketkorea.workers.dev/api/check"; // API 경로

let userProgress = {}; // { 'word_1195': { status: 'wrong|learning|mastered', nextReview: timestamp, errCount: 0 } }
let currentLevel = null;
let currentWord = null;
let isFlipped = false;
let isLoading = false;
let currentAiData = null; // AI가 넘겨준 현재 단어의 데이터 저장

const elements = {
  levelTabs: document.getElementById('level-tabs'),
  statsSection: document.getElementById('stats-section'),
  statPending: document.getElementById('stat-pending'),
  statLearning: document.getElementById('stat-learning'),
  statMastered: document.getElementById('stat-mastered'),
  
  cardArea: document.getElementById('card-area'),
  emptyState: document.getElementById('empty-state'),
  
  cardContainer: document.getElementById('word-card-container'),
  cardInner: document.getElementById('word-card-inner'),
  wordFront: document.getElementById('word-front'),
  wordFrontPos: document.getElementById('word-front-pos'),
  wordFrontHanja: document.getElementById('word-front-hanja'),
  loadingIndicator: document.getElementById('loading-indicator'),
  frontExamplesArea: document.getElementById('front-examples-area'),
  frontExamplesList: document.getElementById('word-front-examples'),
  
  wordBackMeaningBasic: document.getElementById('word-back-meaning-basic'),
  wordBackMeaningDetailed: document.getElementById('word-back-meaning-detailed'),
  wordBackHanjaBreakdown: document.getElementById('word-back-hanja-breakdown'),
  hanjaBreakdownArea: document.getElementById('hanja-breakdown-area'),
  
  btnReveal: document.getElementById('btn-reveal'),
  btnContainerActions: document.getElementById('btn-container-actions'),
  
  btnMarkWrong: document.getElementById('btn-mark-wrong'),
  btnMarkPartial: document.getElementById('btn-mark-partial'),
  btnMarkCorrect: document.getElementById('btn-mark-correct'),
};

// ==========================================
// 1. 초기화 및 레벨 탭 구성
// ==========================================
function initApp() {
  loadProgress();

  if (typeof wordsDB === 'undefined') {
    alert("words_db.js 파일이 올바르게 로드되지 않았습니다!");
    return;
  }

  const levels = Object.keys(wordsDB).sort();
  if (levels.length === 0) return;

  levels.forEach(level => {
    const btn = document.createElement('button');
    btn.className = `px-6 py-2 rounded-full font-bold text-sm transition-all border shadow-sm tab-btn`;
    btn.dataset.level = level;
    btn.textContent = `${level} 등급`;
    btn.addEventListener('click', () => selectLevel(level));
    elements.levelTabs.appendChild(btn);
  });

  // 이벤트 리스너 등록
  elements.btnReveal.addEventListener('click', flipCard);
  elements.btnMarkWrong.addEventListener('click', () => submitGrade('wrong'));
  elements.btnMarkPartial.addEventListener('click', () => submitGrade('learning'));
  elements.btnMarkCorrect.addEventListener('click', () => submitGrade('mastered'));
}

function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { userProgress = JSON.parse(saved); } catch(e) { userProgress = {}; }
  } else {
    // 마이그레이션 (기존 버전 호환은 생략하고 새로 시작)
    userProgress = {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userProgress));
  updateStats();
}

function selectLevel(level) {
  currentLevel = level;
  
  // 탭 스타일 액티브/인액티브 변경
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.level === level) {
      btn.classList.add('bg-[#5C664C]', 'text-[#F5F2E6]', 'border-[#5C664C]');
      btn.classList.remove('bg-white/60', 'text-stone-500', 'border-[#D6D2BF]', 'hover:bg-white');
    } else {
      btn.classList.remove('bg-[#5C664C]', 'text-[#F5F2E6]', 'border-[#5C664C]');
      btn.classList.add('bg-white/60', 'text-stone-500', 'border-[#D6D2BF]', 'hover:bg-white');
    }
  });

  elements.statsSection.classList.remove('hidden');
  updateStats();
  loadNextWord();
}

function updateStats() {
  if (!currentLevel) return;
  const words = wordsDB[currentLevel] || [];
  
  let pendingCount = 0;
  let learningCount = 0;
  let masteredCount = 0;

  words.forEach(w => {
    const status = userProgress[w.id]?.status || 'pending';
    if (status === 'mastered') masteredCount++;
    else if (status === 'learning') learningCount++;
    else pendingCount++; // wrong & pending
  });

  elements.statPending.textContent = pendingCount;
  elements.statLearning.textContent = learningCount;
  elements.statMastered.textContent = masteredCount;
}

// ==========================================
// 2. 단어 추출 (Spaced Repetition 형태)
// ==========================================
function getNextWordToStudy() {
  const pool = wordsDB[currentLevel] || [];
  if (pool.length === 0) return null;

  // 상태별 분류
  const wrongPool = [];
  const learningPool = [];
  const activePool = []; // pending
  const masteredPool = [];

  pool.forEach(w => {
    const record = userProgress[w.id] || { status: 'pending', nextReview: 0 };
    // 리뷰 시간이 된 단어 분류 로직 단순화
    const now = Date.now();
    
    if (record.status === 'wrong') wrongPool.push(w);
    else if (record.status === 'learning') learningPool.push(w);
    else if (record.status === 'mastered') {
      if (now > record.nextReview) masteredPool.push(w);
    }
    else activePool.push(w);
  });

  // 비율 기반 뽑기 알고리즘 (Math.random)
  // 틀린 틀림 50%, 애매함 30%, 새단어 15%, 마스터된 단어 복습 5%
  let r = Math.random();
  let candidateGroup = [];

  if (r < 0.5 && wrongPool.length > 0) candidateGroup = wrongPool;
  else if (r < 0.8 && learningPool.length > 0) candidateGroup = learningPool;
  else if (r < 0.95 && activePool.length > 0) candidateGroup = activePool;
  else if (masteredPool.length > 0) candidateGroup = masteredPool;
  
  // 만약 선택된 그룹이 비어있다면, 순차 강제 대체
  if (candidateGroup.length === 0) {
    if (activePool.length > 0) candidateGroup = activePool;
    else if (wrongPool.length > 0) candidateGroup = wrongPool;
    else if (learningPool.length > 0) candidateGroup = learningPool;
    else candidateGroup = masteredPool; // 복습 시간 안 됐어도 그냥 출제
  }

  if (candidateGroup.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * candidateGroup.length);
  return candidateGroup[randomIndex];
}

// ==========================================
// 3. 단어 사이클 실행
// ==========================================
async function loadNextWord() {
  currentWord = getNextWordToStudy();
  
  if (!currentWord) {
    elements.cardArea.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    return;
  }
  
  elements.cardArea.classList.remove('hidden');
  elements.emptyState.classList.add('hidden');

  // UI 리셋 (앞면)
  isFlipped = false;
  elements.cardContainer.classList.remove('card-flipped');
  setTimeout(() => {
    elements.btnReveal.classList.add('hidden');
    elements.btnContainerActions.classList.add('hidden');
    
    elements.frontExamplesArea.classList.add('hidden');
    elements.loadingIndicator.classList.remove('hidden');
    elements.loadingIndicator.classList.add('flex');
    
    // Front Set
    elements.wordFront.textContent = currentWord.word;
    elements.wordFrontPos.textContent = currentWord.pos || "품사 없음";
    elements.wordFrontHanja.textContent = currentWord.hanja && currentWord.hanja !== "고유어" ? `(${currentWord.hanja})` : "";
    
    // 이전에 Back에 떴던 내용 초기화
    elements.wordBackMeaningBasic.textContent = currentWord.meaning;
    elements.wordBackMeaningDetailed.textContent = "";
    elements.wordBackHanjaBreakdown.textContent = "";
    elements.hanjaBreakdownArea.classList.add('hidden');
  }, 150);

  // AI 통신
  isLoading = true;
  await fetchWordFromAI(currentWord);
}

// AI로부터 예문 3개와 해설 받아오기
async function fetchWordFromAI(wordObj) {
  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: wordObj.word,
        meaning: wordObj.meaning,
        pos: wordObj.pos,
        hanja: wordObj.hanja
      })
    });

    if (!response.ok) throw new Error(`Worker Error: ${response.status}`);
    const aiResult = await response.json();
    currentAiData = aiResult; // { examples: [], detailedMeaning: "", hanjaBreakdown: "" }

    renderAILoadedSuccess();
  } catch (error) {
    console.error("AI 요청 실패:", error);
    // 모의 데이터로 폴백(Fallback) 방어
    currentAiData = {
      examples: [
        "AI 응답 지연으로 예문을 불러올 수 없습니다.",
        "오프라인 상태이거나 서버 오류일 수 있습니다."
      ],
      detailedMeaning: "통신 오류: " + error.message,
      hanjaBreakdown: "오류"
    };
    renderAILoadedSuccess();
  }
}

function renderAILoadedSuccess() {
  if (isFlipped) return; // 이미 뒤집혔다면 렌더링 무시
  isLoading = false;
  
  // 로딩 숨기고 예문 표시
  elements.loadingIndicator.classList.add('hidden');
  elements.loadingIndicator.classList.remove('flex');
  
  elements.frontExamplesList.innerHTML = "";
  if (currentAiData.examples && currentAiData.examples.length > 0) {
    currentAiData.examples.forEach(ex => {
      const li = document.createElement('li');
      li.innerHTML = ex; // <strong> 태그 렌더링 허용
      elements.frontExamplesList.appendChild(li);
    });
  }
  elements.frontExamplesArea.classList.remove('hidden');
  elements.frontExamplesArea.classList.add('flex');
  
  // '확인하기' 버튼 보이기
  elements.btnReveal.classList.remove('hidden');
  elements.btnReveal.disabled = false;
}

// 정답 확인 버튼 눌렀을 때
function flipCard() {
  if (isLoading || isFlipped) return;
  isFlipped = true;
  
  // 뒷면 채우기
  elements.wordBackMeaningDetailed.textContent = currentAiData.detailedMeaning || "-";
  if (currentAiData.hanjaBreakdown && currentAiData.hanjaBreakdown.trim() !== "") {
    elements.wordBackHanjaBreakdown.textContent = currentAiData.hanjaBreakdown;
    elements.hanjaBreakdownArea.classList.remove('hidden');
  }

  // 카드 뒤집기 애니메이션 실행
  elements.cardContainer.classList.add('card-flipped');

  // 버튼 교체
  elements.btnReveal.classList.add('hidden');
  elements.btnContainerActions.classList.remove('hidden');
}

// Anki 등급 제출 처리
function submitGrade(grade) {
  if (!currentWord) return;

  const wordId = currentWord.id;
  if (!userProgress[wordId]) {
    userProgress[wordId] = { status: 'pending', errCount: 0, nextReview: 0 };
  }

  const record = userProgress[wordId];
  const now = Date.now();
  let delay = 0;

  if (grade === 'wrong') {
    record.status = 'wrong';
    record.errCount += 1;
    delay = 1000 * 60; // 1분 뒤 복습
  } else if (grade === 'learning') {
    record.status = 'learning';
    delay = 1000 * 60 * 60 * 12; // 12시간 뒤 복습 (실제로는 확률적으로 나올 수 있도록 함)
  } else if (grade === 'mastered') {
    record.status = 'mastered';
    delay = 1000 * 60 * 60 * 24 * 3; // 3일 뒤 복습
  }

  record.nextReview = now + delay;
  saveProgress();
  
  // 다음 단어로 빠르게 넘어가기
  setTimeout(() => {
    loadNextWord();
  }, 100);
}

// 앱 실행
document.addEventListener('DOMContentLoaded', initApp);
