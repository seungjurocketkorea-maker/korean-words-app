// DOM Elements
const elements = {
  progressBar: document.getElementById('progress-bar'),
  progressText: document.getElementById('progress-text'),
  statPending: document.getElementById('stat-pending'),
  statLearning: document.getElementById('stat-learning'),
  statMastered: document.getElementById('stat-mastered'),

  gradeSelector: document.getElementById('grade-selector'),
  cardContainer: document.getElementById('word-card-container'),
  cardInner: document.getElementById('word-card-inner'),
  wordFront: document.getElementById('word-front'),
  wordFrontHanja: document.getElementById('word-front-hanja'),
  wordFrontHanjaMeaning: document.getElementById('word-front-hanja-meaning'),
  wordFrontExamples: document.getElementById('word-front-examples'),
  loadingIndicator: document.getElementById('loading-indicator'),
  thinkHint: document.getElementById('think-hint'),

  wordBackMeaning: document.getElementById('word-back-meaning'),
  wordBackNuance: document.getElementById('word-back-nuance'),
  hanjaBreakdownArea: document.getElementById('hanja-breakdown-area'),
  wordBackHanjaBreakdown: document.getElementById('word-back-hanja-breakdown'),

  btnSubmit: document.getElementById('btn-submit'),
  btnContainerActions: document.getElementById('btn-container-actions'),
  btnContainerNext: document.getElementById('btn-container-next'),

  btnMarkWrong: document.getElementById('btn-mark-wrong'),
  btnMarkLearning: document.getElementById('btn-mark-learning'),
  btnMarkMastered: document.getElementById('btn-mark-mastered'),
  btnNext: document.getElementById('btn-next'),

  emptyState: document.getElementById('empty-state'),
  cardArea: document.getElementById('card-area')
};

// State
let allWords = {}; // All words from words_db.js
let currentLevel = 'A';
let sessionWords = []; // Filtered words for current level
let currentWord = null;
let isFlipped = false;
let isLoading = false;

// Config
const WORKER_URL = "https://korean-words.seungju-rocketkorea.workers.dev/api/check";

// Initialize Application
function init() {
  if (typeof wordsDB === 'undefined') {
    alert("words_db.js 파일을 찾을 수 없습니다. 변환기를 먼저 사용해주세요.");
    return;
  }
  
  allWords = wordsDB;
  loadStateFromStorage();
  renderGradeButtons();
  selectLevel(Object.keys(allWords)[0] || 'A'); // Default to first available level
  setupEventListeners();
}

function loadStateFromStorage() {
  const stored = localStorage.getItem('kWordStudyState');
  if (stored) {
    const parsedState = JSON.parse(stored);
    // Merge stored status back into allWords
    Object.keys(parsedState).forEach(level => {
      if (allWords[level]) {
        parsedState[level].forEach(storedItem => {
          const target = allWords[level].find(w => w.id === storedItem.id);
          if (target) target.status = storedItem.status;
        });
      }
    });
  }
}

function saveStateToStorage() {
  const stateToSave = {};
  Object.keys(allWords).forEach(level => {
    stateToSave[level] = allWords[level].map(w => ({ id: w.id, status: w.status }));
  });
  localStorage.setItem('kWordStudyState', JSON.stringify(stateToSave));
  updateDashboard();
}

function renderGradeButtons() {
  elements.gradeSelector.innerHTML = '';
  Object.keys(allWords).sort().forEach(level => {
    const btn = document.createElement('button');
    btn.className = `px-4 py-2 rounded-full text-sm font-bold transition-all border ${level === currentLevel ? 'bg-[#5C664C] text-white border-[#5C664C]' : 'bg-white/50 text-[#84806A] border-[#E0DBC5] hover:bg-white'}`;
    btn.textContent = `${level}등급`;
    btn.onclick = () => selectLevel(level);
    elements.gradeSelector.appendChild(btn);
  });
}

function selectLevel(level) {
  currentLevel = level;
  sessionWords = allWords[level] || [];
  renderGradeButtons();
  updateDashboard();
  loadNextWord();
}

function updateDashboard() {
  if (!sessionWords.length) return;
  
  const total = sessionWords.length;
  const pending = sessionWords.filter(w => w.status === 'pending').length;
  const learning = sessionWords.filter(w => w.status === 'learning' || w.status === 'wrong').length;
  const mastered = sessionWords.filter(w => w.status === 'mastered').length;

  const progressPercent = total === 0 ? 0 : Math.round((mastered / total) * 100);
  elements.progressBar.style.width = `${progressPercent}%`;
  elements.progressText.textContent = `${progressPercent}%`;

  elements.statPending.textContent = pending;
  elements.statLearning.textContent = learning;
  elements.statMastered.textContent = mastered;
}

// Logic: Get next word based on status (Spaced Repetition Style)
function getNextWord() {
  // Priority: 1. Wrong/Learning (80% chance) 2. Pending (15% chance) 3. Mastered (5% chance)
  const poolWrong = sessionWords.filter(w => w.status === 'wrong');
  const poolLearning = sessionWords.filter(w => w.status === 'learning');
  const poolPending = sessionWords.filter(w => w.status === 'pending');
  const poolMastered = sessionWords.filter(w => w.status === 'mastered');

  const rand = Math.random();
  let targetPool = [];

  if (rand < 0.7 && (poolWrong.length > 0 || poolLearning.length > 0)) {
    targetPool = [...poolWrong, ...poolLearning];
  } else if (rand < 0.9 && poolPending.length > 0) {
    targetPool = poolPending;
  } else if (poolMastered.length > 0) {
    targetPool = poolMastered;
  } else {
    // If preferred pools are empty, fallback to any available pool in order
    targetPool = poolWrong.length ? poolWrong : 
                 poolLearning.length ? poolLearning : 
                 poolPending.length ? poolPending : poolMastered;
  }

  if (!targetPool || targetPool.length === 0) return null;
  return targetPool[Math.floor(Math.random() * targetPool.length)];
}

async function loadNextWord() {
  currentWord = getNextWord();

  if (!currentWord) {
    elements.cardArea.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    return;
  }

  elements.cardArea.classList.remove('hidden');
  elements.emptyState.classList.add('hidden');

  // UI Initial State
  isFlipped = false;
  isLoading = true;
  elements.cardContainer.classList.remove('card-flipped');
  elements.btnContainerActions.classList.add('hidden');
  elements.btnContainerNext.classList.add('hidden');
  elements.btnSubmit.classList.remove('hidden');
  elements.btnSubmit.disabled = true;
  elements.wordFrontExamples.classList.add('hidden');
  elements.thinkHint.classList.add('hidden');
  elements.loadingIndicator.classList.remove('hidden');

  // Text Front
  elements.wordFront.textContent = currentWord.word;
  elements.wordFrontHanja.textContent = currentWord.hanja ? `(${currentWord.hanja})` : "";
  elements.wordFrontHanjaMeaning.textContent = ""; // Placeholder until AI/DB fully loaded

  // Fetch AI Data (1-call)
  try {
    const aiData = await fetchAIInfo(currentWord);
    renderFrontAI(aiData);
    renderBackAI(aiData);
  } catch (error) {
    console.error("AI Fetch Failed:", error);
    // Fallback if AI fails
    renderFrontFallback();
  } finally {
    isLoading = false;
    elements.loadingIndicator.classList.add('hidden');
    elements.btnSubmit.disabled = false;
  }
}

async function fetchAIInfo(wordObj) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      word: wordObj.word,
      meaning: wordObj.meaning,
      hanja: wordObj.hanja,
      pos: wordObj.pos
    })
  });

  if (!response.ok) throw new Error("Worker Error");
  return await response.json();
}

function renderFrontAI(aiData) {
  elements.wordFrontExamples.innerHTML = aiData.examples.map(ex => `<p>• ${ex}</p>`).join('');
  elements.wordFrontExamples.classList.remove('hidden');
  elements.thinkHint.classList.remove('hidden');
}

function renderBackAI(aiData) {
  elements.wordBackMeaning.textContent = currentWord.meaning || "사전적 의미를 불러올 수 없습니다.";
  elements.wordBackNuance.textContent = aiData.nuance || "";
  
  if (aiData.hanjaBreakdown) {
    elements.hanjaBreakdownArea.classList.remove('hidden');
    elements.wordBackHanjaBreakdown.textContent = aiData.hanjaBreakdown;
  } else {
    elements.hanjaBreakdownArea.classList.add('hidden');
  }
}

function renderFrontFallback() {
  elements.wordFrontExamples.innerHTML = "<p class='text-red-500'>AI 예문을 불러오지 못했습니다. 뜻을 확인해보세요.</p>";
  elements.wordFrontExamples.classList.remove('hidden');
  elements.wordBackMeaning.textContent = currentWord.meaning;
  elements.wordBackNuance.textContent = "통신 오류로 인해 자세한 해설을 불러오지 못했습니다.";
}

function flipCard() {
  if (isLoading || isFlipped) return;
  isFlipped = true;
  elements.cardContainer.classList.add('card-flipped');
  
  setTimeout(() => {
    elements.btnSubmit.classList.add('hidden');
    elements.btnContainerActions.classList.remove('hidden');
  }, 150);
}

function updateStatusAndNext(newStatus) {
  const index = sessionWords.findIndex(w => w.id === currentWord.id);
  if (index !== -1) {
    sessionWords[index].status = newStatus;
    saveStateToStorage();
  }
  
  elements.btnContainerActions.classList.add('hidden');
  elements.btnContainerNext.classList.remove('hidden');
}

function setupEventListeners() {
  elements.btnSubmit.onclick = flipCard;
  elements.btnNext.onclick = loadNextWord;

  elements.btnMarkWrong.onclick = () => updateStatusAndNext('wrong');
  elements.btnMarkLearning.onclick = () => updateStatusAndNext('learning');
  elements.btnMarkMastered.onclick = () => updateStatusAndNext('mastered');

  // Spacebar triggers flip or next
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      if (!isFlipped && !isLoading) flipCard();
      else if (isFlipped && !elements.btnContainerNext.classList.contains('hidden')) loadNextWord();
    }
  });
}

init();
