const STORAGE_KEY = 'korean_words_progress_v2';
const WORKER_URL = "https://korean-words.seungju-rocketkorea.workers.dev/api/check";

let userProgress = {}; // { 'word_1195': { status: 'wrong|learning|mastered', nextReview: timestamp, errCount: 0 } }
let currentLevel = null;
let currentWord = null;
let isFlipped = false;
let isContextLoading = false;
let isGradeLoading = false;
let currentAiContext = null;

const levelNames = {
  'A': '1단계', 'B': '2단계', 'C': '3단계'
};

const posMap = {
  '감': '감탄사', '고': '고유 명사', '관': '관형사',
  '대': '대명사', '동': '동사', '명': '명사',
  '보': '보조 용언', '부': '부사', '불': '분석 불능',
  '수': '수사', '의': '의존 명사', '형': '형용사'
};

const elements = {
  levelTabs: document.getElementById('level-tabs'),
  statsSection: document.getElementById('stats-section'),
  statPending: document.getElementById('stat-pending'),
  statLearning: document.getElementById('stat-learning'),
  statMastered: document.getElementById('stat-mastered'),
  
  cardArea: document.getElementById('card-area'),
  emptyState: document.getElementById('empty-state'),
  emptyTitle: document.getElementById('empty-title'),
  emptySubtitle: document.getElementById('empty-subtitle'),
  
  cardContainer: document.getElementById('word-card-container'),
  wordFront: document.getElementById('word-front'),
  wordFrontPos: document.getElementById('word-front-pos'),
  wordFrontHanja: document.getElementById('word-front-hanja'),
  loadingIndicatorFront: document.getElementById('loading-indicator-front'),
  frontExamplesArea: document.getElementById('front-examples-area'),
  frontExamplesList: document.getElementById('word-front-examples'),
  
  userMeaningInput: document.getElementById('user-meaning-input'),
  loadingIndicatorGrade: document.getElementById('loading-indicator-grade'),
  
  aiJudgmentBadge: document.getElementById('ai-judgment-badge'),
  aiFeedback: document.getElementById('ai-feedback'),
  
  wordBackMeaningBasic: document.getElementById('word-back-meaning-basic'),
  wordBackMeaningDetailed: document.getElementById('word-back-meaning-detailed'),
  wordBackHanjaBreakdown: document.getElementById('word-back-hanja-breakdown'),
  hanjaBreakdownArea: document.getElementById('hanja-breakdown-area'),
  
  btnSubmit: document.getElementById('btn-submit'),
  btnContainerNext: document.getElementById('btn-container-next'),
  btnNext: document.getElementById('btn-next'),
  btnTabReview: document.getElementById('btn-tab-review')
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

  // 실시간 전처리 가공 (숫자제거, 품사 매핑, 빈도 랭킹 정렬)
  Object.keys(wordsDB).forEach(level => {
    wordsDB[level].forEach(w => {
      // "속01", "버리다01" -> "속", "버리다"
      w.word = w.word.replace(/\d+$/, '');
      // 품사 치환
      if (w.pos in posMap) {
        w.pos = posMap[w.pos];
      }
      // ID를 기준으로 정수 랭크 추출 ('word_1195' -> 1195)
      w.rank = parseInt(w.id.replace('word_', ''), 10);
      if (isNaN(w.rank)) w.rank = 999999; 
    });
    // 빈도수 숫자가 낮을수록(순위가 높을수록) 앞쪽으로 О름차순 정렬
    wordsDB[level].sort((a, b) => a.rank - b.rank);
  });

  const levels = Object.keys(wordsDB).sort();

  levels.forEach(level => {
    if(level === 'REVIEW') return; // 방어 코드

    const btn = document.createElement('button');
    btn.className = `px-6 py-2 rounded-full font-bold text-sm transition-all border shadow-sm tab-btn bg-white/60 text-stone-500 border-[#D6D2BF] hover:bg-white`;
    btn.dataset.level = level;
    // 맵핑된 이름 출력, 없으면 기존 이름
    btn.textContent = levelNames[level] || `${level} 등급`;
    btn.addEventListener('click', () => selectLevel(level));
    elements.levelTabs.appendChild(btn);
  });

  elements.btnSubmit.addEventListener('click', submitAnswer);
  elements.btnNext.addEventListener('click', loadNextWord);
  
  // Enter 키로도 제출 가능하게
  elements.userMeaningInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitAnswer();
    }
  });
}

function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { userProgress = JSON.parse(saved); } catch(e) { userProgress = {}; }
  } else {
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
  document.querySelectorAll('.tab-btn, #btn-tab-review').forEach(btn => {
    if (btn.dataset.level === level || (level === 'REVIEW' && btn.id === 'btn-tab-review')) {
      // 선택된 스타일
      if(level === 'REVIEW') {
        btn.className = `px-6 py-2 rounded-full font-bold text-sm transition-all border shadow-sm bg-[#D98C63] text-white border-[#D98C63]`;
      } else {
        btn.className = `px-6 py-2 rounded-full font-bold text-sm transition-all border shadow-sm tab-btn bg-[#5C664C] text-[#F5F2E6] border-[#5C664C]`;
      }
    } else {
      // 해제된 스타일
      if (btn.id === 'btn-tab-review') {
         btn.className = `px-6 py-2 rounded-full font-bold text-sm transition-all border shadow-sm bg-white/60 text-[#D98C63] border-[#D6D2BF] hover:bg-white`;
      } else {
         btn.className = `px-6 py-2 rounded-full font-bold text-sm transition-all border shadow-sm tab-btn bg-white/60 text-stone-500 border-[#D6D2BF] hover:bg-white`;
      }
    }
  });

  elements.statsSection.classList.remove('hidden');
  updateStats();
  loadNextWord();
}

function getReviewPool() {
  // 모든 단어 풀에서 기록이 존재하는(한번이라도 제출한) 단어만 끌어모음
  const allWords = [];
  Object.values(wordsDB).forEach(arr => allWords.push(...arr));
  
  return allWords.filter(w => {
    const st = userProgress[w.id]?.status;
    return st && st !== 'pending';
  });
}

function updateStats() {
  if (!currentLevel) return;
  
  let words = [];
  if (currentLevel === 'REVIEW') {
    words = getReviewPool();
    document.getElementById('stats-title').textContent = "복습장 학습 현황 (누적)";
  } else {
    words = wordsDB[currentLevel] || [];
    const displayName = levelNames[currentLevel] || `${currentLevel} 등급`;
    document.getElementById('stats-title').textContent = `${displayName} 학습 현황`;
  }
  
  let pendingCount = 0;
  let learningCount = 0;
  let masteredCount = 0;

  words.forEach(w => {
    const status = userProgress[w.id]?.status || 'pending';
    if (status === 'mastered') masteredCount++;
    else if (status === 'learning') learningCount++;
    else pendingCount++; 
  });

  elements.statPending.textContent = pendingCount;
  elements.statLearning.textContent = learningCount;
  elements.statMastered.textContent = masteredCount;
}

// ==========================================
// 2. 단어 추출 알고리즘
// ==========================================
function getNextWordToStudy() {
  let pool = [];
  if (currentLevel === 'REVIEW') {
    pool = getReviewPool();
  } else {
    pool = wordsDB[currentLevel] || [];
  }
  
  if (pool.length === 0) return null;

  const wrongPool = [];
  const learningPool = [];
  const activePool = []; // 한번도 안본 단어 (REVIEW 탭에선 비어있음)
  const masteredPool = [];

  const now = Date.now();

  pool.forEach(w => {
    const record = userProgress[w.id] || { status: 'pending', nextReview: 0 };
    if (record.status === 'wrong') {
      if (now >= record.nextReview) wrongPool.push(w);
    } else if (record.status === 'learning') {
      if (now >= record.nextReview) learningPool.push(w);
    } else if (record.status === 'mastered') {
      if (now >= record.nextReview) masteredPool.push(w);
    } else {
      activePool.push(w);
    }
  });

  // 비율 기반 뽑기
  let r = Math.random();
  let candidateGroup = [];

  if (r < 0.5 && wrongPool.length > 0) candidateGroup = wrongPool;
  else if (r < 0.8 && learningPool.length > 0) candidateGroup = learningPool;
  else if (r < 0.95 && activePool.length > 0) candidateGroup = activePool;
  else if (masteredPool.length > 0) candidateGroup = masteredPool;
  
  // 대체 그룹 보정
  if (candidateGroup.length === 0) {
    if (wrongPool.length > 0) candidateGroup = wrongPool;
    else if (learningPool.length > 0) candidateGroup = learningPool;
    else if (activePool.length > 0) candidateGroup = activePool;
    else if (masteredPool.length > 0) candidateGroup = masteredPool;
  }
  
  // 그래도 없으면, 랜덤 강제가 아니라 풀의 앞쪽(빈도수 1등)을 뽑음
  if (candidateGroup.length === 0) {
    candidateGroup = pool; 
  }

  if (candidateGroup === activePool || candidateGroup === pool) {
    // 한 번도 안 본 단어 그룹이라면, 랜덤이 아니라 무조건 순위가 빠른 순서부터(index 0) 먼저 뽑음 (정렬 완료된 상태)
    return candidateGroup[0];
  } else {
    // 복습 단어(틀린단어, 학습중) 그룹이면 아무렇게나 하나를 섞어서 뽑음
    const randomIndex = Math.floor(Math.random() * candidateGroup.length);
    return candidateGroup[randomIndex];
  }
}

// ==========================================
// 3. 단어 사이클 (Load & Fetch Context)
// ==========================================
async function loadNextWord() {
  currentWord = getNextWordToStudy();
  
  if (!currentWord) {
    elements.cardArea.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    elements.emptyTitle.textContent = currentLevel === 'REVIEW' ? "복습할 단어가 없어요!" : "모든 단어를 마스터했습니다!";
    elements.emptySubtitle.textContent = currentLevel === 'REVIEW' ? "아직 다른 등급에서 공부한 단어가 없거나, 모두 완벽히 외워 당장 복습할 단어가 없습니다." : "수고하셨습니다 👏";
    return;
  }
  
  elements.cardArea.classList.remove('hidden');
  elements.emptyState.classList.add('hidden');

  // UI 리셋 (앞면)
  isFlipped = false;
  elements.cardContainer.classList.remove('card-flipped');
  elements.userMeaningInput.value = "";
  elements.userMeaningInput.disabled = false;
  
  setTimeout(() => {
    elements.btnSubmit.classList.remove('hidden');
    elements.btnSubmit.disabled = true;
    elements.btnContainerNext.classList.add('hidden');
    
    // Front Loader 상태
    elements.frontExamplesArea.classList.add('hidden');
    elements.loadingIndicatorFront.classList.remove('hidden');
    elements.loadingIndicatorFront.classList.add('flex');
    
    // Front Set
    elements.wordFront.textContent = currentWord.word;
    elements.wordFrontPos.textContent = currentWord.pos || "품사 없음";
    elements.wordFrontHanja.textContent = currentWord.hanja && currentWord.hanja !== "고유어" ? `(${currentWord.hanja})` : "";
    
    // 이전에 Back에 떴던 내용 초기화
    elements.wordBackMeaningBasic.textContent = currentWord.meaning;
    elements.wordBackMeaningDetailed.textContent = "";
    elements.wordBackHanjaBreakdown.textContent = "";
    elements.hanjaBreakdownArea.classList.add('hidden');
    elements.aiFeedback.textContent = "";
  }, 150);

  isContextLoading = true;
  await fetchWordContext(currentWord);
}

// 1차 통신: 예문과 해설 가져오기
async function fetchWordContext(wordObj) {
  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "context",
        word: wordObj.word,
        meaning: wordObj.meaning,
        pos: wordObj.pos,
        hanja: wordObj.hanja
      })
    });

    if (!response.ok) throw new Error(`Worker Error: ${response.status}`);
    currentAiContext = await response.json(); 

    renderContextLoaded();
  } catch (error) {
    console.error("AI 1차 요청 실패:", error);
    currentAiContext = {
      examples: [ "통신 오류로 예문을 불러올 수 없습니다." ],
      detailedMeaning: "해설을 가져오지 못했습니다.",
      hanjaBreakdown: ""
    };
    renderContextLoaded();
  }
}

function renderContextLoaded() {
  if (isFlipped) return;
  isContextLoading = false;
  
  // 로딩 숨기고 예문 표시
  elements.loadingIndicatorFront.classList.add('hidden');
  elements.loadingIndicatorFront.classList.remove('flex');
  
  elements.frontExamplesList.innerHTML = "";
  if (currentAiContext.examples && currentAiContext.examples.length > 0) {
    currentAiContext.examples.forEach(ex => {
      const li = document.createElement('li');
      li.innerHTML = ex; // <strong> 태그 렌더링 허용
      elements.frontExamplesList.appendChild(li);
    });
  }
  elements.frontExamplesArea.classList.remove('hidden');
  elements.frontExamplesArea.classList.add('flex');
  
  // 입력 활성화
  elements.btnSubmit.disabled = false;
  elements.userMeaningInput.focus();
}

// ==========================================
// 4. 답안 제출 및 2차 채점 통신
// ==========================================
async function submitAnswer() {
  const userAnswerText = elements.userMeaningInput.value.trim();
  if (!userAnswerText) {
    alert("단어의 뜻을 유추해 적어주세요!");
    return;
  }

  if (isContextLoading || isGradeLoading || isFlipped) return;
  
  isGradeLoading = true;
  elements.btnSubmit.disabled = true;
  elements.userMeaningInput.disabled = true;
  
  // 서브밋 로딩 UI
  elements.loadingIndicatorGrade.classList.remove('hidden');
  elements.loadingIndicatorGrade.classList.add('flex');

  let gradeResultData = null;

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "grade",
        word: currentWord.word,
        meaning: currentWord.meaning,
        userAnswer: userAnswerText
      })
    });

    if (!response.ok) throw new Error(`Worker Error: ${response.status}`);
    gradeResultData = await response.json(); 
  } catch (error) {
    console.error("AI 채점 실패:", error);
    gradeResultData = {
      isCorrect: "partial",
      feedback: "서버 연결 오류로 자동 채점되었습니다. 실제 뜻을 확인하고 익혀주세요."
    };
  }

  elements.loadingIndicatorGrade.classList.add('hidden');
  elements.loadingIndicatorGrade.classList.remove('flex');
  isGradeLoading = false;

  triggerAutoSpacedRepetition(gradeResultData);
  flipCardAndShowFeedback(gradeResultData);
}

// AI 결과에 따른 LocalStorage 풀오토 등급 반영
function triggerAutoSpacedRepetition(aiGrade) {
  if (!currentWord) return;

  const wordId = currentWord.id;
  if (!userProgress[wordId]) {
    userProgress[wordId] = { status: 'pending', errCount: 0, nextReview: 0 };
  }

  const record = userProgress[wordId];
  const now = Date.now();
  let delay = 0;

  if (aiGrade.isCorrect === 'incorrect') {
    record.status = 'wrong';
    record.errCount += 1;
    delay = 1000 * 60; // 1분 뒤 복습 세팅!
  } else if (aiGrade.isCorrect === 'partial') {
    record.status = 'learning';
    delay = 1000 * 60 * 30; // 부분점수는 30분~1시간 내 복습
  } else { // correct
    record.status = 'mastered';
    delay = 1000 * 60 * 60 * 24 * 3; // 3일 뒤까지 나오지 않음
  }

  record.nextReview = now + delay;
  saveProgress(); // 화면 숫자는 자동으로 updateStats()가 불림 (save안에 존재)
}

function flipCardAndShowFeedback(aiGrade) {
  isFlipped = true;
  
  // 뒤집어지고 세팅될 데이터 (AI 문맥에서 가져온 상세 해설)
  elements.wordBackMeaningDetailed.textContent = currentAiContext.detailedMeaning || "-";
  if (currentAiContext.hanjaBreakdown && currentAiContext.hanjaBreakdown.trim() !== "") {
    elements.wordBackHanjaBreakdown.textContent = currentAiContext.hanjaBreakdown;
    elements.hanjaBreakdownArea.classList.remove('hidden');
  }

  // 뱃지 및 설명 렌더링
  const badge = elements.aiJudgmentBadge;
  elements.aiFeedback.textContent = aiGrade.feedback;
  
  badge.classList.remove("bg-red-500", "bg-yellow-500", "bg-green-500");
  if (aiGrade.isCorrect === 'incorrect') {
    badge.textContent = "아예 틀림 😭 (바로 다시 복습)";
    badge.classList.add("bg-red-500");
  } else if (aiGrade.isCorrect === 'partial') {
    badge.textContent = "조금 아쉬움 🤔 (조금 복습)";
    badge.classList.add("bg-yellow-500");
  } else {
    badge.textContent = "완벽한 정답! 👏 (완벽 마스터)";
    badge.classList.add("bg-green-500");
  }

  // 뒷면 전환 애니메이션
  elements.cardContainer.classList.add('card-flipped');

  // 버튼 교체
  elements.btnSubmit.classList.add('hidden');
  elements.btnContainerNext.classList.remove('hidden');
}

// 앱 실행
document.addEventListener('DOMContentLoaded', initApp);
