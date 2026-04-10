const STORAGE_KEY = 'korean_words_progress_v2';
const WORKER_URL = "https://korean-words.seungju-rocketkorea.workers.dev/api/check";

let userProgress = {}; // { 'word_1195': { status: 'wrong|learning|mastered', nextReview: timestamp, errCount: 0 } }
let currentLevel = null;
let currentWord = null;
let isFlipped = false;
let isContextLoading = false;
let isGradeLoading = false;
let currentAiContext = null;

// Review List State
let reviewPoolAll = [];
let currentReviewFilter = 'all'; 
let currentReviewSearch = '';
let currentReviewPage = 1;
const REVIEW_ITEMS_PER_PAGE = 50;

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
  btnTabReview: document.getElementById('btn-tab-review'),
  
  reviewListSection: document.getElementById('review-list-section'),
  reviewWordList: document.getElementById('review-word-list'),
  
  // Review Controls
  reviewSearchInput: document.getElementById('review-search-input'),
  btnPrevPage: document.getElementById('btn-prev-page'),
  btnNextPage: document.getElementById('btn-next-page'),
  reviewPageInfo: document.getElementById('review-page-info'),
  reviewFilterBtns: document.querySelectorAll('.review-filter-btn'),
  
  // Modal
  wordDetailModal: document.getElementById('word-detail-modal'),
  modalWordTitle: document.getElementById('modal-word-title'),
  modalWordPos: document.getElementById('modal-word-pos'),
  modalWordHanja: document.getElementById('modal-word-hanja'),
  modalLoading: document.getElementById('modal-loading'),
  modalContent: document.getElementById('modal-content'),
  modalMeaningBasic: document.getElementById('modal-meaning-basic'),
  modalExamples: document.getElementById('modal-examples'),
  modalMeaningDetailed: document.getElementById('modal-meaning-detailed'),
  modalHanjaArea: document.getElementById('modal-hanja-area'),
  modalHanjaBreakdown: document.getElementById('modal-hanja-breakdown'),
  
  // Dictionary Panel
  dictPanel: document.getElementById('dict-panel'),
  dictEmptyState: document.getElementById('dict-empty-state'),
  dictLoadingState: document.getElementById('dict-loading-state'),
  dictResultState: document.getElementById('dict-result-state'),
  dictWordTitle: document.getElementById('dict-word-title'),
  dictWordMeaning: document.getElementById('dict-word-meaning'),
  btnCloseDict: document.getElementById('btn-close-dict'),

  // User Note Elements
  backUserNoteInput: document.getElementById('back-user-note-input'),
  btnSaveNote: document.getElementById('btn-save-note'),
  noteSaveMsg: document.getElementById('note-save-msg'),
  modalUserNoteArea: document.getElementById('modal-user-note-area'),
  modalUserNote: document.getElementById('modal-user-note')
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
    btn.className = `px-6 py-2 rounded-full font-medium text-sm transition-all border tab-btn bg-[#fdf6e3] text-stone-500 border-[#93a1a1] hover:bg-[#fdf6e3]`;
    btn.dataset.level = level;
    // 맵핑된 이름 출력, 없으면 기존 이름
    btn.textContent = levelNames[level] || `${level} 등급`;
    btn.addEventListener('click', () => selectLevel(level));
    elements.levelTabs.appendChild(btn);
  });

  elements.btnSubmit.addEventListener('click', submitAnswer);
  elements.btnNext.addEventListener('click', loadNextWord);
  
  // Dictionary / Selection Event
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('touchend', handleTextSelection);
  if (elements.btnCloseDict) {
    elements.btnCloseDict.addEventListener('click', closeDictPanel);
  }
  
  // Enter 키로도 제출 가능하게
  elements.userMeaningInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitAnswer();
    }
  });

  // Review List Event Listeners
  elements.reviewSearchInput.addEventListener('input', (e) => {
    currentReviewSearch = e.target.value.trim().toLowerCase();
    currentReviewPage = 1;
    renderReviewList();
  });

  elements.reviewFilterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // 탭 스타일 변경
      elements.reviewFilterBtns.forEach(b => {
        b.classList.remove('active', 'bg-[#859900]', 'text-[#fdf6e3]');
        b.classList.add('bg-[#fdf6e3]', 'text-stone-600');
      });
      const target = e.currentTarget;
      target.classList.remove('bg-[#fdf6e3]', 'text-stone-600');
      target.classList.add('active', 'bg-[#859900]', 'text-[#fdf6e3]');
      
      currentReviewFilter = target.dataset.filter;
      currentReviewPage = 1;
      renderReviewList();
    });
  });

  elements.btnPrevPage.addEventListener('click', () => {
    if (currentReviewPage > 1) {
      currentReviewPage--;
      renderReviewList();
    }
  });

  elements.btnNextPage.addEventListener('click', () => {
    currentReviewPage++;
    renderReviewList();
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
        btn.className = `px-6 py-2 rounded-full font-medium text-sm transition-all border bg-[#cb4b16] text-[#fdf6e3] border-[#cb4b16]`;
      } else {
        btn.className = `px-6 py-2 rounded-full font-medium text-sm transition-all border tab-btn bg-[#586e75] text-[#eee8d5] border-[#586e75]`;
      }
    } else {
      // 해제된 스타일
      if (btn.id === 'btn-tab-review') {
         btn.className = `px-6 py-2 rounded-full font-medium text-sm transition-all border bg-[#fdf6e3] text-[#cb4b16] border-[#93a1a1] hover:bg-[#fdf6e3]`;
      } else {
         btn.className = `px-6 py-2 rounded-full font-medium text-sm transition-all border tab-btn bg-[#fdf6e3] text-stone-500 border-[#93a1a1] hover:bg-[#fdf6e3]`;
      }
    }
  });

  elements.statsSection.classList.remove('hidden');
  updateStats();
  
  // Review 모드 선택 시 플래시카드 즉시 시작 대신에 리스트 우선 표시
  if (level === 'REVIEW') {
     elements.cardArea.classList.add('hidden');
     elements.emptyState.classList.add('hidden');
     
     populateReviewList();
     elements.reviewListSection.classList.remove('hidden');
     elements.reviewListSection.classList.add('flex');
  } else {
     elements.reviewListSection.classList.add('hidden');
     elements.reviewListSection.classList.remove('flex');
     loadNextWord();
  }
}

function startReviewCards() {
  elements.reviewListSection.classList.add('hidden');
  elements.reviewListSection.classList.remove('flex');
  loadNextWord();
}

function populateReviewList() {
  reviewPoolAll = getReviewPool();
  currentReviewPage = 1; // 탭 진입 시 페이지 초기화
  
  // 시급한 복습 단어(틀린단어)가 앞쪽에 오도록 1차 정렬 (상태 > 단어명)
  reviewPoolAll.sort((a,b) => {
     const statusOrder = { 'wrong': 0, 'learning': 1, 'mastered': 2 };
     const sa = userProgress[a.id]?.status || 'mastered';
     const sb = userProgress[b.id]?.status || 'mastered';
     if(statusOrder[sa] !== statusOrder[sb]) return statusOrder[sa] - statusOrder[sb];
     return a.word.localeCompare(b.word);
  });

  renderReviewList();
}

function renderReviewList() {
  let filtered = reviewPoolAll;
  
  // State Filter
  if (currentReviewFilter !== 'all') {
    filtered = filtered.filter(w => userProgress[w.id]?.status === currentReviewFilter);
  }
  
  // Search Filter
  if (currentReviewSearch !== '') {
    filtered = filtered.filter(w => 
      w.word.toLowerCase().includes(currentReviewSearch) || 
      w.meaning.toLowerCase().includes(currentReviewSearch)
    );
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / REVIEW_ITEMS_PER_PAGE));
  if (currentReviewPage > totalPages) {
    currentReviewPage = totalPages;
  }
  
  const startIndex = (currentReviewPage - 1) * REVIEW_ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIndex, startIndex + REVIEW_ITEMS_PER_PAGE);

  // Update UI Pagination Info
  elements.reviewPageInfo.textContent = `${currentReviewPage} / ${totalPages}`;
  elements.btnPrevPage.disabled = currentReviewPage <= 1;
  elements.btnNextPage.disabled = currentReviewPage >= totalPages;

  elements.reviewWordList.innerHTML = '';
  
  if (filtered.length === 0) {
     elements.reviewWordList.innerHTML = '<li class="p-6 text-center text-stone-500 text-sm font-medium">검색된 단어가 없습니다. 먼저 등급 탭에서 단어를 학습해보세요!</li>';
     return;
  }
  
  paginated.forEach(w => {
     const st = userProgress[w.id]?.status;
     let dot = '🟢';
     let badgeColor = 'text-green-700 bg-green-100/80';
     let badgeText = '완벽 암기';
     
     if(st === 'wrong') { 
       dot = '🔴'; badgeColor = 'text-red-700 bg-red-100/80'; badgeText = '복습 시급'; 
     } else if(st === 'learning') { 
       dot = '🟡'; badgeColor = 'text-yellow-700 bg-yellow-100/80'; badgeText = '학습 중'; 
     }
     
     const li = document.createElement('li');
     li.className = 'flex flex-col sm:flex-row sm:items-center justify-between p-5 md:p-6 bg-[#fdf6e3] border border-[#eee8d5] rounded-2xl transition-all gap-3 cursor-pointer border-l-4 hover:-translate-y-1 relative group';
     li.style.borderLeftColor = st === 'wrong' ? '#EF4444' : (st === 'learning' ? '#F59E0B' : '#10B981');
     li.onclick = () => openWordModal(w); // 클릭 시 모달창 띄우기

     li.innerHTML = `
        <div class="flex flex-col gap-2 w-full pr-10 sm:pr-12">
          <div class="flex items-center gap-3">
            <span class="text-[0.65rem] px-2 py-1 rounded-md font-medium whitespace-nowrap border border-[#eee8d5] ${badgeColor}">${dot} ${badgeText}</span>
            <div class="flex flex-col">
              <div class="flex items-baseline gap-2">
                <span class="font-medium font-serif text-[#586e75] text-xl md:text-2xl">${w.word}</span>
                <span class="text-xs text-[#268bd2] font-medium tracking-wide">${w.pos}</span>
              </div>
              <span class="text-[0.65rem] text-[#859900] tracking-widest font-medium">${w.hanja && w.hanja !== '고유어' ? w.hanja : ''}</span>
            </div>
          </div>
          <div class="text-xs text-stone-600 sm:max-w-full break-keep leading-tight pl-1 border-l-2 border-[#93a1a1]/50">
            ${w.meaning}
          </div>
        </div>
        
        <!-- Delete Button (항상 표시, 연한 색깔에서 호버 시 강조됨) -->
        <button class="absolute top-3 right-3 sm:top-1/2 sm:-translate-y-1/2 p-2 text-stone-300 hover:text-red-500 bg-transparent hover:bg-stone-100 transition-all rounded-full z-10 hover:shadow-sm" onclick="deleteWordFromReview(event, '${w.id}')" title="이 단어 기록 지우기">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
     `;
     elements.reviewWordList.appendChild(li);
  });
}

// 삭제 기능
window.deleteWordFromReview = function(event, wordId) {
  event.stopPropagation(); // 상위(li)의 onClick(모달) 실행을 막음
  
  if (!confirm("이 단어의 현재 학습 상태를 목록에서 삭제하시겠습니까?\n(삭제 시 '미학습' 단어로 초기화됩니다)")) {
    return;
  }
  
  if (userProgress[wordId]) {
    delete userProgress[wordId];
    saveProgress(); // 탭 상단의 통계치들도 같이 갱신됨
    
    // 현재 리뷰 풀에서 제거하고, 화면 새로 렌더링 (페이지 번호 및 검색어 등 유지)
    reviewPoolAll = reviewPoolAll.filter(w => w.id !== wordId);
    
    // 만약 현재 페이지의 마지막 단어를 지워서 페이지가 텅 비게 되면, 이전 페이지로 당김
    const totalPages = Math.max(1, Math.ceil(reviewPoolAll.length / REVIEW_ITEMS_PER_PAGE));
    if (currentReviewPage > totalPages) {
      currentReviewPage = totalPages;
    }
    
    renderReviewList();
  }
}

// ==========================================
// 2.5 단어 상세 설명 모달창 (Modal)
// ==========================================
async function openWordModal(wObj) {
  const modal = elements.wordDetailModal;
  modal.classList.remove('hidden');
  
  // Tailwind 애니메이션을 위해 아주 살짝 대기 후 opacity 1
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modal.firstElementChild.classList.remove('scale-95');
    modal.firstElementChild.classList.add('scale-100');
  }, 10);

  // 헤더 세팅
  elements.modalWordTitle.textContent = wObj.word;
  elements.modalWordPos.textContent = wObj.pos;
  elements.modalWordHanja.textContent = wObj.hanja && wObj.hanja !== '고유어' ? `(${wObj.hanja})` : '';

  // 컨텐츠 숨기고 로딩 띄우기
  elements.modalContent.classList.add('hidden');
  elements.modalLoading.classList.remove('hidden');

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "context",
        word: wObj.word,
        meaning: wObj.meaning,
        pos: wObj.pos,
        hanja: wObj.hanja
      })
    });

    if (!response.ok) throw new Error("네트워크 오류");
    const data = await response.json();

    // 데이터 주입
    elements.modalMeaningBasic.textContent = wObj.meaning || data.basicMeaning || data.detailedMeaning || "정보가 없습니다.";
    elements.modalMeaningDetailed.textContent = data.detailedMeaning || "정보가 없습니다.";
    
    // 한자 어원
    if (data.hanjaBreakdown && data.hanjaBreakdown.trim() !== "") {
      elements.modalHanjaBreakdown.textContent = data.hanjaBreakdown;
      elements.modalHanjaArea.classList.remove('hidden');
    } else {
      elements.modalHanjaArea.classList.add('hidden');
    }

    // 예문
    elements.modalExamples.innerHTML = '';
    if (data.examples && data.examples.length > 0) {
      data.examples.forEach(ex => {
        const li = document.createElement('li');
        li.innerHTML = ex;
        elements.modalExamples.appendChild(li);
      });
    } else {
      elements.modalExamples.innerHTML = '<li>예문이 없습니다.</li>';
    }

    // 사용자 노트 영역 세팅
    if (data.userNote && data.userNote.trim() !== "") {
      elements.modalUserNote.textContent = data.userNote;
      elements.modalUserNoteArea.classList.remove('hidden');
    } else {
      elements.modalUserNoteArea.classList.add('hidden');
    }

  } catch (error) {
    console.error(error);
    elements.modalMeaningBasic.textContent = wObj.meaning || "사전 정보를 불러올 수 없습니다.";
    elements.modalMeaningDetailed.textContent = "서버 통신에 실패하여 상세 정보를 불러오지 못했습니다.";
    elements.modalExamples.innerHTML = '<li>네트워크 연결을 확인해주세요.</li>';
    elements.modalHanjaArea.classList.add('hidden');
  }

  // 로딩 숨기고 컨텐츠 띄우기
  elements.modalLoading.classList.add('hidden');
  elements.modalContent.classList.remove('hidden');
}

function closeWordModal() {
  const modal = elements.wordDetailModal;
  modal.classList.add('opacity-0');
  modal.firstElementChild.classList.remove('scale-100');
  modal.firstElementChild.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

// 모달 외부 영억 클릭 시 닫기
document.getElementById('word-detail-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    closeWordModal();
  }
});

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

  const now = Date.now();

  if (currentLevel !== 'REVIEW') {
    // 1. 일반 단계 학습: 오직 공부한 적 없는 (pending 상태인) "새 단어"만 순서대로 출제
    const activePool = pool.filter(w => {
      const record = userProgress[w.id];
      return !record || record.status === 'pending';
    });
    
    if (activePool.length === 0) return null; // 해당 등급 마스터
    return activePool[0]; // 순서대로 (빈도 높은 순) 반환
  }

  // 2. 내 복습장 (REVIEW) 모드: 오직 1번 이상 채점해서 기록이 생긴 풀에서만 출제
  const wrongPool = [];
  const learningPool = [];
  const masteredPool = [];

  pool.forEach(w => {
    const record = userProgress[w.id];
    if (!record || record.status === 'pending') return;

    if (record.status === 'wrong') {
      if (now >= record.nextReview) wrongPool.push(w);
    } else if (record.status === 'learning') {
      if (now >= record.nextReview) learningPool.push(w);
    } else if (record.status === 'mastered') {
      if (now >= record.nextReview) masteredPool.push(w);
    }
  });

  // 비율 기반 뽑기 (틀린 거 우선)
  let r = Math.random();
  let candidateGroup = [];

  if (r < 0.6 && wrongPool.length > 0) candidateGroup = wrongPool;
  else if (r < 0.9 && learningPool.length > 0) candidateGroup = learningPool;
  else if (masteredPool.length > 0) candidateGroup = masteredPool;
  
  // 대체 그룹 보정
  if (candidateGroup.length === 0) {
    if (wrongPool.length > 0) candidateGroup = wrongPool;
    else if (learningPool.length > 0) candidateGroup = learningPool;
    else if (masteredPool.length > 0) candidateGroup = masteredPool;
  }
  
  if (candidateGroup.length === 0) return null; // 당장 복습 주기 도달한 단어가 없음

  // 복습 단어 그룹 안에서 무작위 출제
  const randomIndex = Math.floor(Math.random() * candidateGroup.length);
  return candidateGroup[randomIndex];
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
  
  // 카드가 뒤집히는 애니메이션 중(약 150ms)에 텍스트가 바로 바뀌면 어색하므로 살짝 대기
  await new Promise(resolve => setTimeout(resolve, 150));

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
  elements.wordBackMeaningBasic.textContent = "-";
  elements.wordBackMeaningDetailed.textContent = "";
  elements.wordBackHanjaBreakdown.textContent = "";
  elements.hanjaBreakdownArea.classList.add('hidden');
  elements.aiFeedback.textContent = "";
  if(elements.backUserNoteInput) elements.backUserNoteInput.value = "";
  if(elements.noteSaveMsg) elements.noteSaveMsg.classList.add('hidden');

  isContextLoading = true;
  await fetchWordContext(currentWord);
}

// 1차 통신: 예문과 해설 가져오기 (이제 캐시는 백엔드 Worker의 KV가 담당합니다)
async function fetchWordContext(wordObj, force = false) {
  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "context",
        word: wordObj.word,
        meaning: wordObj.meaning,
        pos: wordObj.pos,
        hanja: wordObj.hanja,
        force: force
      })
    });

    if (!response.ok) {
      const errObj = await response.json().catch(() => ({}));
      throw new Error(`Worker Error: ${response.status} - ${errObj.error || ''} \n${errObj.stack || ''}`);
    }
    const data = await response.json();
    currentAiContext = data;

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
        pos: currentWord.pos,
        userAnswer: userAnswerText
      })
    });

    if (!response.ok) {
      const errObj = await response.json().catch(() => ({}));
      throw new Error(`Worker Error: ${response.status} - ${errObj.error || ''} \n${errObj.stack || ''}`);
    }
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
  elements.wordBackMeaningBasic.textContent = currentWord.meaning || currentAiContext.basicMeaning || currentAiContext.detailedMeaning || "정보가 없습니다.";
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

  // 사용자 노트 값 바인딩
  if (elements.backUserNoteInput && currentAiContext) {
    elements.backUserNoteInput.value = currentAiContext.userNote || "";
    elements.noteSaveMsg.classList.add('hidden');
  }

  // 버튼 교체
  elements.btnSubmit.classList.add('hidden');
  elements.btnContainerNext.classList.remove('hidden');
}

// ==========================================
// 5. 드래그 빠른 사전 통신
// ==========================================
let quickDictTimer = null;
let lastSelectedText = "";

function handleTextSelection(e) {
  // 닫기 버튼 등을 클릭했을 때 선택 이벤트가 발동되는 것을 방지
  if (e.target.closest('#dict-panel')) return;

  setTimeout(() => {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    
    // 유효한 텍스트 (한글, 영문 등, 길이 1~20)인지 판별
    if (text && text.length > 0 && text.length <= 20) {
      if (text === lastSelectedText) return; // 같은 텍스트 중첩 호출 방지
      // 길이가 긴 문구인 경우 무시
      if (text.includes(" ") && text.length > 10) return; 

      lastSelectedText = text;

      // 중복 호출 방지용 디바운스
      clearTimeout(quickDictTimer);
      quickDictTimer = setTimeout(() => {
        openDictPanelForWord(text);
      }, 300);
    }
  }, 100);
}

async function openDictPanelForWord(wordText) {
  const panel = elements.dictPanel;
  
  // 모바일 슬라이드 패널 열기
  if (panel && panel.classList.contains('translate-y-full')) {
    panel.classList.remove('translate-y-full');
  }

  // UI 상태 전환 (로딩되게 전환)
  elements.dictEmptyState.classList.add('hidden');
  elements.dictResultState.classList.remove('flex');
  elements.dictResultState.classList.add('hidden');
  elements.dictLoadingState.classList.remove('hidden');
  elements.dictLoadingState.classList.add('flex');

  // API 호출
  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "quick_dict",
        word: wordText
      })
    });

    if (!response.ok) throw new Error("네트워크 오류");
    const data = await response.json();
    
    // 결과 UI 업데이트
    elements.dictWordTitle.textContent = wordText;
    elements.dictWordMeaning.textContent = data.meaning || "단어의 뜻을 찾을 수 없습니다.";
    
  } catch (err) {
    console.error("사전 API 에러:", err);
    elements.dictWordTitle.textContent = wordText;
    elements.dictWordMeaning.textContent = "데이터를 불러오는 중 오류가 발생했습니다.";
  } finally {
    // 로딩 숨기고 결과 보이기
    elements.dictLoadingState.classList.remove('flex');
    elements.dictLoadingState.classList.add('hidden');
    elements.dictResultState.classList.remove('hidden');
    elements.dictResultState.classList.add('flex');
  }
}

function closeDictPanel() {
  const panel = elements.dictPanel;
  if (panel) {
    panel.classList.add('translate-y-full'); // 모바일에서 패널 닫기 (아래로 슬라이드 다운)
    lastSelectedText = ""; // 닫았을 땐 다음 선택 시 다시 허용
  }
}

// -------------------------------------------------------------
// 사용자 사전 노트 저장 기능
// -------------------------------------------------------------
async function saveUserNote() {
  if (!currentWord) return;
  
  const noteText = elements.backUserNoteInput.value.trim();
  const btn = elements.btnSaveNote;
  
  btn.textContent = "저장 중...";
  btn.classList.add("opacity-50");
  btn.classList.remove("cursor-pointer");

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_note",
        word: currentWord.word,
        pos: currentWord.pos,
        note: noteText
      })
    });

    if (!response.ok) throw new Error("네트워크 오류");
    
    elements.noteSaveMsg.classList.remove('hidden');
    // 현재 세션 로컬에도 씌우기
    if (currentAiContext) {
      currentAiContext.userNote = noteText;
    }
    setTimeout(() => {
      elements.noteSaveMsg.classList.add('hidden');
    }, 3500);
  } catch (e) {
    alert("노트 저장에 실패했습니다.");
  } finally {
    btn.textContent = "저장하기";
    btn.classList.remove("opacity-50");
    btn.classList.add("cursor-pointer");
  }
}

// -------------------------------------------------------------
// AI 답변 재요청 기능
// -------------------------------------------------------------
async function retryFetchContext() {
  if (!currentWord) return;
  if (!confirm("AI에게 뜻풀이와 예문을 새롭게 다시 생성하도록 요청할까요? (시간이 약간 소요될 수 있습니다)")) return;

  // 로딩 상태로 변경
  elements.wordBackMeaningBasic.textContent = "-";
  elements.wordBackMeaningDetailed.textContent = "AI 선생님이 답변을 새로 만들고 있습니다...";
  elements.wordBackHanjaBreakdown.textContent = "";

  isContextLoading = true;
  await fetchWordContext(currentWord, true);

  // 새로 가져온 데이터로 업데이트
  elements.wordBackMeaningBasic.textContent = currentWord.meaning || currentAiContext.basicMeaning || currentAiContext.detailedMeaning || "정보가 없습니다.";
  elements.wordBackMeaningDetailed.textContent = currentAiContext.detailedMeaning || "-";
  if (currentAiContext.hanjaBreakdown && currentAiContext.hanjaBreakdown.trim() !== "") {
    elements.wordBackHanjaBreakdown.textContent = currentAiContext.hanjaBreakdown;
    elements.hanjaBreakdownArea.classList.remove('hidden');
  } else {
    elements.hanjaBreakdownArea.classList.add('hidden');
  }
}

// 앱 실행
document.addEventListener('DOMContentLoaded', initApp);

