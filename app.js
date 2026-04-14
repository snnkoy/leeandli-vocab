/* ============================================
   理律法律英文單字 PWA - Main Application Logic
   ============================================ */

(function () {
  'use strict';

  // ============================================
  // State
  // ============================================
  let vocabData = [];
  let proficiency = {}; // { id: number (0-100) }
  let currentFilter = 'all';
  let searchQuery = '';
  let expandedItemId = null;

  // Quiz state
  let quizWords = [];
  let quizIndex = 0;
  let quizCorrect = [];
  let quizWrong = [];
  let isCardFlipped = false;
  let quizCategory = '';
  let isAppealRound = false;

  // ============================================
  // DOM References
  // ============================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const vocabListContainer = $('#vocab-list-container');
  const quizContent = $('#quiz-content');
  const searchInput = $('#search-input');
  const toast = $('#toast');

  // ============================================
  // Init
  // ============================================
  async function init() {
    loadProficiency();
    await loadVocab();
    renderVocabList();
    updateStats();
    setupEventListeners();
    registerServiceWorker();
  }

  // ============================================
  // Data Loading
  // ============================================
  async function loadVocab() {
    try {
      const response = await fetch('./vocab.json');
      vocabData = await response.json();
    } catch (err) {
      console.error('Failed to load vocab:', err);
      vocabData = [];
    }
  }

  function loadProficiency() {
    try {
      const stored = localStorage.getItem('leeandli_proficiency');
      if (stored) {
        proficiency = JSON.parse(stored);
      }
    } catch (err) {
      proficiency = {};
    }
  }

  function saveProficiency() {
    try {
      localStorage.setItem('leeandli_proficiency', JSON.stringify(proficiency));
    } catch (err) {
      console.error('Failed to save proficiency:', err);
    }
  }

  function getProf(id) {
    return proficiency[id] || 0;
  }

  function getProfLevel(val) {
    if (val >= 80) return 'high';
    if (val >= 40) return 'mid';
    return 'low';
  }

  function getProfLevelLabel(level) {
    if (level === 'high') return '熟練';
    if (level === 'mid') return '待加強';
    return '不熟';
  }

  // ============================================
  // Service Worker
  // ============================================
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch((err) => console.error('SW registration failed:', err));
    }
  }

  // ============================================
  // Stats
  // ============================================
  function updateStats() {
    let high = 0, mid = 0, low = 0;
    vocabData.forEach((w) => {
      const level = getProfLevel(getProf(w.id));
      if (level === 'high') high++;
      else if (level === 'mid') mid++;
      else low++;
    });

    $('#stat-high').textContent = high;
    $('#stat-mid').textContent = mid;
    $('#stat-low').textContent = low;
    $('#filter-count-all').textContent = vocabData.length;
  }

  // ============================================
  // Render Vocab List
  // ============================================
  function getFilteredWords() {
    let words = vocabData;

    // Filter by proficiency level
    if (currentFilter !== 'all') {
      words = words.filter((w) => getProfLevel(getProf(w.id)) === currentFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      words = words.filter((w) =>
        w.english.toLowerCase().includes(q) ||
        w.chinese.includes(q) ||
        (w.note && w.note.includes(q))
      );
    }

    return words;
  }

  function renderVocabList() {
    const words = getFilteredWords();

    if (words.length === 0) {
      vocabListContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-emoji">🔎</span>
          <h3>找不到符合條件的單字</h3>
          <p>試試其他搜尋關鍵字或篩選條件</p>
        </div>
      `;
      return;
    }

    vocabListContainer.innerHTML = words.map((w, i) => {
      const prof = getProf(w.id);
      const level = getProfLevel(prof);
      const isExpanded = expandedItemId === w.id;
      return `
        <div class="vocab-item ${isExpanded ? 'expanded' : ''}" data-id="${w.id}" style="animation-delay:${Math.min(i * 0.02, 0.3)}s">
          <div class="vocab-item-header" data-id="${w.id}">
            <span class="word-number">${w.id}</span>
            <span class="word-english">${escapeHtml(w.english)}</span>
            <span class="proficiency-badge level-${level}">${prof}%</span>
            <span class="vocab-expand-icon">▼</span>
          </div>
          <div class="vocab-item-detail">
            <div class="vocab-detail-content">
              <div class="detail-english">${escapeHtml(w.english)}</div>
              <div class="detail-row">
                <span class="label">中文</span>
                <span class="value">${escapeHtml(w.chinese)}</span>
              </div>
              ${w.note ? `
              <div class="detail-row">
                <span class="label">說明</span>
                <span class="value">${escapeHtml(w.note)}</span>
              </div>` : ''}
              ${w.example ? `
              <div class="detail-row">
                <span class="label">例句</span>
                <span class="value">${escapeHtml(w.example)}</span>
              </div>` : ''}
              <div class="proficiency-bar-container">
                <div class="proficiency-bar-label">熟練度 ${prof}%</div>
                <div class="proficiency-bar">
                  <div class="proficiency-bar-fill ${level}" style="width:${prof}%"></div>
                </div>
              </div>
              <div class="vocab-actions">
                <button class="btn-memorized" data-id="${w.id}">✅ 我記住了！</button>
                <button class="btn-retry" data-id="${w.id}">🔄 我再背背！</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================
  // Event Listeners
  // ============================================
  function setupEventListeners() {
    // Tab switching
    $$('.tab-item').forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        switchTab(tabName);
      });
    });

    // Vocab list click delegation
    vocabListContainer.addEventListener('click', handleVocabClick);

    // Search
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      expandedItemId = null;
      renderVocabList();
    });

    // Filter pills
    $$('.filter-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        $$('.filter-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.dataset.filter;
        expandedItemId = null;
        renderVocabList();
      });
    });

    // Quiz content click delegation
    quizContent.addEventListener('click', handleQuizClick);
  }

  function switchTab(tabName) {
    // Update tab buttons
    $$('.tab-item').forEach((t) => t.classList.remove('active'));
    $(`[data-tab="${tabName}"]`).classList.add('active');

    // Update pages
    $$('.page').forEach((p) => p.classList.remove('active'));
    $(`#page-${tabName}`).classList.add('active');

    // Show/hide header elements
    if (tabName === 'quiz') {
      renderQuizStart();
    }
  }

  // ============================================
  // Vocab Click Handler
  // ============================================
  function handleVocabClick(e) {
    // Handle expand/collapse
    const header = e.target.closest('.vocab-item-header');
    if (header) {
      const id = parseInt(header.dataset.id);
      expandedItemId = expandedItemId === id ? null : id;
      renderVocabList();
      return;
    }

    // Handle memorized button
    const memBtn = e.target.closest('.btn-memorized');
    if (memBtn) {
      const id = parseInt(memBtn.dataset.id);
      const current = getProf(id);
      proficiency[id] = Math.min(100, current + 20);
      saveProficiency();
      updateStats();
      renderVocabList();
      showToast('✅ 熟練度 +20%');
      return;
    }

    // Handle retry button
    const retryBtn = e.target.closest('.btn-retry');
    if (retryBtn) {
      const id = parseInt(retryBtn.dataset.id);
      const current = getProf(id);
      proficiency[id] = Math.max(0, current - 20);
      saveProficiency();
      updateStats();
      renderVocabList();
      showToast('🔄 熟練度 -20%');
      return;
    }
  }

  // ============================================
  // Quiz Logic
  // ============================================
  function renderQuizStart() {
    const counts = { high: 0, mid: 0, low: 0 };
    vocabData.forEach((w) => {
      counts[getProfLevel(getProf(w.id))]++;
    });

    quizContent.innerHTML = `
      <div class="quiz-start-screen">
        <span class="quiz-emoji">📖</span>
        <h2>我要來讀書了！</h2>
        <p>選擇要測驗的單字類別開始翻卡測驗</p>
        <div class="quiz-category-btns">
          <button class="quiz-cat-btn green" data-category="high" ${counts.high === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
            <span>🟢 熟練的單字<br><small style="font-weight:400;font-size:0.7rem;color:var(--text-muted)">熟練度 80% 以上</small></span>
            <span class="cat-count">${counts.high} 個</span>
          </button>
          <button class="quiz-cat-btn orange" data-category="mid" ${counts.mid === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
            <span>🟡 待加強的單字<br><small style="font-weight:400;font-size:0.7rem;color:var(--text-muted)">熟練度 40% ～ 79%</small></span>
            <span class="cat-count">${counts.mid} 個</span>
          </button>
          <button class="quiz-cat-btn red" data-category="low" ${counts.low === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
            <span>🔴 不熟的單字<br><small style="font-weight:400;font-size:0.7rem;color:var(--text-muted)">熟練度 39% 以下</small></span>
            <span class="cat-count">${counts.low} 個</span>
          </button>
        </div>
      </div>
    `;
  }

  function startQuiz(category, wordPool, appeal) {
    quizCategory = category;
    isAppealRound = !!appeal;

    // Shuffle and take up to 10
    const shuffled = shuffleArray([...wordPool]);
    quizWords = shuffled.slice(0, 10);
    quizIndex = 0;
    quizCorrect = [];
    quizWrong = [];
    isCardFlipped = false;

    renderQuizCard();
  }

  function renderQuizCard() {
    if (quizIndex >= quizWords.length) {
      renderQuizResult();
      return;
    }

    const word = quizWords[quizIndex];
    const progress = ((quizIndex) / quizWords.length) * 100;

    quizContent.innerHTML = `
      <div style="padding:20px 4px;">
        <div class="quiz-progress">
          <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width:${progress}%"></div>
          </div>
          <span class="quiz-progress-text">${quizIndex + 1}/${quizWords.length}</span>
        </div>

        <div class="flashcard-container" id="flashcard-container">
          <div class="flashcard" id="flashcard">
            <div class="flashcard-front">
              <div class="card-english">${escapeHtml(word.english)}</div>
              <div class="tap-hint">👆 點擊「看答案」翻開卡片</div>
            </div>
            <div class="flashcard-back">
              <div class="card-back-english">${escapeHtml(word.english)}</div>
              <div class="detail-row">
                <span class="label">中文</span>
                <span class="value">${escapeHtml(word.chinese)}</span>
              </div>
              ${word.note ? `
              <div class="detail-row">
                <span class="label">說明</span>
                <span class="value">${escapeHtml(word.note)}</span>
              </div>` : ''}
              ${word.example ? `
              <div class="detail-row">
                <span class="label">例句</span>
                <span class="value">${escapeHtml(word.example)}</span>
              </div>` : ''}
            </div>
          </div>
        </div>

        <div id="quiz-action-area">
          <button class="btn-reveal" id="btn-reveal">看答案 👀</button>
        </div>
      </div>
    `;

    isCardFlipped = false;
  }

  function flipCard() {
    if (isCardFlipped) return;
    isCardFlipped = true;

    const flashcard = $('#flashcard');
    flashcard.classList.add('flipped');

    const actionArea = $('#quiz-action-area');
    actionArea.innerHTML = `
      <div class="quiz-answer-btns">
        <button class="btn-quiz-correct" id="btn-quiz-correct">✅ 答對了！</button>
        <button class="btn-quiz-wrong" id="btn-quiz-wrong">❌ 答錯了…</button>
      </div>
    `;
  }

  function handleQuizAnswer(isCorrect) {
    const word = quizWords[quizIndex];
    if (isCorrect) {
      quizCorrect.push(word);
      // Increase proficiency
      proficiency[word.id] = Math.min(100, getProf(word.id) + 20);
    } else {
      quizWrong.push(word);
      // Decrease proficiency
      proficiency[word.id] = Math.max(0, getProf(word.id) - 20);
    }
    saveProficiency();
    updateStats();

    quizIndex++;
    renderQuizCard();
  }

  function renderQuizResult() {
    const total = quizCorrect.length + quizWrong.length;
    const correct = quizCorrect.length;
    let emoji, message;

    if (isAppealRound) {
      // Appeal round messages
      if (quizWrong.length === 0) {
        emoji = '⚖️';
        message = '恭喜儲小寶寶上訴成功，撤銷原判決，你太厲害了！';
      } else if (correct > 0) {
        emoji = '💪';
        message = '儲小寶寶非常不錯喔，還差一點，再上訴一次！';
      } else {
        emoji = '🥺';
        message = '沒事！再背一次，儲小寶寶一定可以的！';
      }
    } else {
      // Normal round messages
      if (correct >= 8) {
        emoji = '🎉';
        message = '儲小寶寶真是太棒了！怎麼這麼優秀！';
      } else if (correct >= 4) {
        emoji = '💪';
        message = '儲小寶寶很不錯喔！要繼續加油變的更棒！';
      } else {
        emoji = '🥺';
        message = '歐歐，儲小寶寶要再繼續加加油才行了！';
      }
    }

    let html = `
      <div class="quiz-result">
        <div class="result-header">
          <span class="result-emoji">${emoji}</span>
          <div class="result-message">${message}</div>
          <div class="result-score">答對 ${correct} / ${total} 題</div>
        </div>
    `;

    if (quizCorrect.length > 0) {
      html += `
        <div class="result-section">
          <div class="result-section-title">✅ 答對的單字 (${quizCorrect.length})</div>
          ${quizCorrect.map((w) => renderResultCard(w, true)).join('')}
        </div>
      `;
    }

    if (quizWrong.length > 0) {
      html += `
        <div class="result-section">
          <div class="result-section-title">❌ 答錯的單字 (${quizWrong.length})</div>
          ${quizWrong.map((w) => renderResultCard(w, false)).join('')}
        </div>
        <button class="btn-appeal" id="btn-appeal">⚖️ 上訴！上訴！</button>
      `;
    } else {
      // All correct!
      if (isAppealRound) {
        html += `
          <div class="all-correct-celebration">
            <span class="celebrate-emoji">⚖️</span>
            <h2>上訴成功！撤銷原判決！</h2>
            <p>恭喜儲小寶寶上訴成功，你太厲害了！</p>
          </div>
        `;
      } else {
        html += `
          <div class="all-correct-celebration">
            <span class="celebrate-emoji">🏆</span>
            <h2>全部答對了！</h2>
            <p>太厲害了，所有單字都記住了！</p>
          </div>
        `;
      }
    }

    html += `
        <button class="btn-back-home" id="btn-back-home">返回選擇</button>
      </div>
    `;

    quizContent.innerHTML = html;
  }

  function renderResultCard(word, isCorrect) {
    return `
      <div class="result-word-card ${isCorrect ? 'correct' : 'wrong'}">
        <div class="rw-english">${escapeHtml(word.english)}</div>
        <div class="rw-chinese">${escapeHtml(word.chinese)}</div>
        ${word.note ? `<div class="rw-note">📌 ${escapeHtml(word.note)}</div>` : ''}
        ${word.example ? `<div class="rw-example">💬 ${escapeHtml(word.example)}</div>` : ''}
      </div>
    `;
  }

  // ============================================
  // Quiz Click Handler
  // ============================================
  function handleQuizClick(e) {
    // Category selection
    const catBtn = e.target.closest('.quiz-cat-btn');
    if (catBtn && !catBtn.disabled) {
      const category = catBtn.dataset.category;
      const wordPool = vocabData.filter((w) => getProfLevel(getProf(w.id)) === category);
      if (wordPool.length > 0) {
        startQuiz(category, wordPool);
      }
      return;
    }

    // Reveal button
    if (e.target.closest('#btn-reveal')) {
      flipCard();
      return;
    }

    // Correct button
    if (e.target.closest('#btn-quiz-correct')) {
      handleQuizAnswer(true);
      return;
    }

    // Wrong button
    if (e.target.closest('#btn-quiz-wrong')) {
      handleQuizAnswer(false);
      return;
    }

    // Appeal button - retry only wrong ones
    if (e.target.closest('#btn-appeal')) {
      if (quizWrong.length > 0) {
        startQuiz(quizCategory, [...quizWrong], true);
      }
      return;
    }

    // Back to home
    if (e.target.closest('#btn-back-home')) {
      renderQuizStart();
      return;
    }
  }

  // ============================================
  // Utilities
  // ============================================
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 1800);
  }

  // ============================================
  // Start
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
