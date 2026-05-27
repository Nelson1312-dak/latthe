/**
 * ui.js - UI Rendering & Screen Transitions
 * Handles all DOM manipulation, animations, and visual effects
 */

const UI = {
  // ======== DOM Cache ========
  elements: {},
  _editingPlayerId: null,

  init() {
    // Cache all important elements
    this.elements = {
      app: document.getElementById('app'),
      // Screens
      screenSplash: document.getElementById('screen-splash'),
      screenSetup: document.getElementById('screen-setup'),
      screenGame: document.getElementById('screen-game'),
      screenGameover: document.getElementById('screen-gameover'),
      // Splash
      btnStart: document.getElementById('btn-start'),
      particlesContainer: document.getElementById('particles-container'),
      // Setup
      btnBackSplash: document.getElementById('btn-back-splash'),
      playerNameInput: document.getElementById('player-name-input'),
      btnAddPlayer: document.getElementById('btn-add-player'),
      btnQuickFill: document.getElementById('btn-quick-fill'),
      playerList: document.getElementById('player-list'),
      playerCountBadge: document.getElementById('player-count'),
      btnPlay: document.getElementById('btn-play'),
      intensityBtns: document.querySelectorAll('.intensity-btn'),
      // Game
      currentAvatar: document.getElementById('current-avatar'),
      currentPlayerName: document.getElementById('current-player-name'),
      cardsRemaining: document.getElementById('cards-remaining'),
      btnScoreboard: document.getElementById('btn-scoreboard'),
      cardContainer: document.getElementById('card-container'),
      gameCard: document.getElementById('game-card'),
      cardBack: document.getElementById('card-back'),
      cardTypeBadge: document.getElementById('card-type-badge'),
      cardContent: document.getElementById('card-content'),
      cardPenalty: document.getElementById('card-penalty'),
      btnFlip: document.getElementById('btn-flip'),
      postFlipActions: document.getElementById('post-flip-actions'),
      btnDone: document.getElementById('btn-done'),
      btnDrink: document.getElementById('btn-drink'),
      btnNext: document.getElementById('btn-next'),
      playerCarousel: document.getElementById('player-carousel'),
      // Scoreboard Modal
      modalScoreboard: document.getElementById('modal-scoreboard'),
      scoreboardList: document.getElementById('scoreboard-list'),
      btnCloseScoreboard: document.getElementById('btn-close-scoreboard'),
      // NHIE Modal
      modalNhie: document.getElementById('modal-nhie'),
      nhieContent: document.getElementById('nhie-content'),
      nhiePlayerGrid: document.getElementById('nhie-player-grid'),
      btnNhieDone: document.getElementById('btn-nhie-done'),
      // Vote Modal
      modalVote: document.getElementById('modal-vote'),
      voteContent: document.getElementById('vote-content'),
      votePlayerGrid: document.getElementById('vote-player-grid'),
      btnVoteDone: document.getElementById('btn-vote-done'),
      // Game Over
      finalScoreboard: document.getElementById('final-scoreboard'),
      btnReplay: document.getElementById('btn-replay'),
      btnHome: document.getElementById('btn-home'),
      confettiContainer: document.getElementById('confetti-container'),
    };

    this.createParticles();
    this._initRipple();
  },

  // ======== Screen Navigation ========
  showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    const target = document.getElementById(screenId);
    
    screens.forEach(s => {
      if (s.classList.contains('active')) {
        s.classList.add('leaving');
        s.classList.remove('active');
        setTimeout(() => s.classList.remove('leaving'), 500);
      }
    });

    setTimeout(() => {
      target.classList.add('active');
    }, 100);
  },

  // ======== Splash Screen ========
  createParticles() {
    const container = this.elements.particlesContainer;
    if (!container) return;

    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('span');
      particle.className = 'particle';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDuration = `${10 + Math.random() * 20}s`;
      particle.style.animationDelay = `${Math.random() * 10}s`;
      particle.style.width = particle.style.height = `${4 + Math.random() * 8}px`;
      particle.style.opacity = `${0.1 + Math.random() * 0.3}`;
      container.appendChild(particle);
    }
  },

  // ======== Setup Screen ========
  renderPlayerList(players) {
    const list = this.elements.playerList;
    list.innerHTML = '';

    players.forEach((player, index) => {
      const item = document.createElement('div');
      item.className = 'player-item';
      item.style.animationDelay = `${index * 0.05}s`;
      item.innerHTML = `
        <div class="player-avatar" style="background-color: ${player.color}">
          ${player.initial}
        </div>
        <span class="player-name-text" data-id="${player.id}">${player.name}</span>
        <div class="player-item-actions">
          <button class="btn-edit-player" data-id="${player.id}" aria-label="Sửa ${player.name}">✏️</button>
          <button class="btn-remove-player" data-id="${player.id}" aria-label="Xóa ${player.name}">✕</button>
        </div>
      `;
      list.appendChild(item);
    });

    // Update count badge
    this.elements.playerCountBadge.textContent = `${players.length}/12`;
    
    // Toggle play button
    this.elements.btnPlay.disabled = players.length < 1;
    
    // Toggle add button
    this.elements.btnAddPlayer.disabled = players.length >= 12;
  },

  clearPlayerInput() {
    this.elements.playerNameInput.value = '';
    this.elements.playerNameInput.focus();
  },

  getSelectedIntensity() {
    const active = document.querySelector('.intensity-btn.active');
    return active ? active.dataset.intensity : 'Nhap_Tiec';
  },

  // ======== Game Screen ========
  updateCurrentPlayer(player) {
    this.elements.currentAvatar.style.backgroundColor = player.color;
    this.elements.currentAvatar.textContent = player.initial;
    this.elements.currentPlayerName.textContent = player.name;

    // Animate the player name change
    this.elements.currentPlayerName.classList.remove('animate-in');
    void this.elements.currentPlayerName.offsetWidth; // force reflow
    this.elements.currentPlayerName.classList.add('animate-in');

    // Update card face turn info
    const cardTurnAvatar = document.getElementById('card-turn-avatar');
    const cardTurnName = document.getElementById('card-turn-name');
    if (cardTurnAvatar) {
      cardTurnAvatar.style.backgroundColor = player.color;
      cardTurnAvatar.textContent = player.initial;
    }
    if (cardTurnName) cardTurnName.textContent = player.name;
  },

  updateCardsRemaining(count) {
    this.elements.cardsRemaining.textContent = count;
  },

  renderPlayerCarousel(players, currentIndex) {
    const carousel = this.elements.playerCarousel;
    carousel.innerHTML = '';

    players.forEach((player, index) => {
      const indicator = document.createElement('div');
      indicator.className = `player-indicator ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'done' : ''}`;
      indicator.style.backgroundColor = player.color;
      indicator.textContent = player.initial;
      indicator.title = player.name;
      carousel.appendChild(indicator);
    });
  },

  // ======== Card Rendering ========
  resetCard() {
    this.elements.gameCard.classList.remove('flipped');
    this.elements.cardBack.className = 'card-face card-back';
    this.elements.btnFlip.classList.remove('hidden');
    this.elements.postFlipActions.classList.add('hidden');
    this.elements.btnNext.classList.add('hidden');
  },

  renderCard(card) {
    const typeInfo = CARD_TYPES[card.type];
    
    // Set card type class for styling
    this.elements.cardBack.className = `card-face card-back ${card.type}`;
    
    // Type badge
    const badge = this.elements.cardTypeBadge;
    badge.querySelector('.badge-emoji').textContent = typeInfo.emoji;
    badge.querySelector('.badge-text').textContent = typeInfo.name;
    badge.style.background = typeInfo.gradient;

    // Content
    this.elements.cardContent.textContent = card.content;

    // Penalty
    const shots = '🥃'.repeat(card.penalty);
    this.elements.cardPenalty.textContent = `${shots} × ${card.penalty} shot${card.penalty > 1 ? 's' : ''}`;
  },

  flipCard() {
    hapticFeedback('medium');
    this.elements.gameCard.classList.add('flipped');
    
    // Show appropriate actions after flip animation
    setTimeout(() => {
      this.elements.btnFlip.classList.add('hidden');
    }, 400);
  },

  showPostFlipActions(cardType) {
    // For truth/dare - show done/drink buttons
    // For group/nhie/vote - handled by modals
    if (cardType === 'truth' || cardType === 'dare') {
      this.elements.postFlipActions.classList.remove('hidden');
      this.elements.postFlipActions.classList.add('animate-slide-up');
    } else {
      // For group, just show done/drink
      this.elements.postFlipActions.classList.remove('hidden');
      this.elements.postFlipActions.classList.add('animate-slide-up');
    }
  },

  showNextButton() {
    this.elements.postFlipActions.classList.add('hidden');
    this.elements.btnNext.classList.remove('hidden');
    this.elements.btnNext.classList.add('animate-slide-up');
  },

  // ======== Modals ========
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('showing');
    setTimeout(() => modal.classList.add('visible'), 10);
  },

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('visible');
    setTimeout(() => {
      modal.classList.remove('showing');
      modal.classList.add('hidden');
    }, 300);
  },

  // ======== Never Have I Ever ========
  renderNhieModal(card, players) {
    this.elements.nhieContent.textContent = card.content;
    
    const grid = this.elements.nhiePlayerGrid;
    grid.innerHTML = '';

    players.forEach(player => {
      const btn = document.createElement('button');
      btn.className = 'nhie-player-btn';
      btn.dataset.playerId = player.id;
      btn.innerHTML = `
        <div class="nhie-avatar" style="background-color: ${player.color}">${player.initial}</div>
        <span class="nhie-name">${player.name}</span>
        <span class="nhie-drink-icon">🍺</span>
      `;
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
        hapticFeedback('light');
      });
      grid.appendChild(btn);
    });

    this.showModal('modal-nhie');
  },

  getNhieSelectedPlayers() {
    const selected = document.querySelectorAll('.nhie-player-btn.selected');
    return Array.from(selected).map(btn => btn.dataset.playerId);
  },

  // ======== Vote ========
  renderVoteModal(card, players) {
    this.elements.voteContent.textContent = card.content;
    
    const grid = this.elements.votePlayerGrid;
    grid.innerHTML = '';

    players.forEach(player => {
      const btn = document.createElement('button');
      btn.className = 'vote-player-btn';
      btn.dataset.playerId = player.id;
      btn.innerHTML = `
        <div class="vote-avatar" style="background-color: ${player.color}">${player.initial}</div>
        <span class="vote-name">${player.name}</span>
        <span class="vote-count">0</span>
      `;
      btn.addEventListener('click', () => {
        // Increment vote count
        const countEl = btn.querySelector('.vote-count');
        let count = parseInt(countEl.textContent) + 1;
        countEl.textContent = count;
        btn.classList.add('voted');
        tapBounce(btn);
        hapticFeedback('light');
      });
      grid.appendChild(btn);
    });

    this.showModal('modal-vote');
  },

  getVoteResults() {
    const buttons = document.querySelectorAll('.vote-player-btn');
    let maxVotes = 0;
    let winners = [];

    buttons.forEach(btn => {
      const count = parseInt(btn.querySelector('.vote-count').textContent);
      if (count > maxVotes) {
        maxVotes = count;
        winners = [btn.dataset.playerId];
      } else if (count === maxVotes && count > 0) {
        winners.push(btn.dataset.playerId);
      }
    });

    return winners;
  },

  // ======== Scoreboard ========
  renderScoreboard(rankings, containerId) {
    const container = typeof containerId === 'string' 
      ? document.getElementById(containerId) 
      : containerId;
    
    if (!container) return;
    container.innerHTML = '';

    rankings.forEach((entry, index) => {
      const item = document.createElement('div');
      item.className = `score-item ${index === 0 ? 'champion' : ''}`;
      item.style.animationDelay = `${index * 0.08}s`;
      
      const shotEmojis = entry.player.shots > 0 
        ? '🥃'.repeat(Math.min(entry.player.shots, 10)) 
        : '😇';

      item.innerHTML = `
        <span class="score-rank">${entry.medal || entry.rank}</span>
        <div class="score-avatar" style="background-color: ${entry.player.color}">${entry.player.initial}</div>
        <span class="score-name">${entry.player.name}</span>
        <span class="score-shots">${entry.player.shots} shot${entry.player.shots !== 1 ? 's' : ''}</span>
        <span class="score-emojis">${shotEmojis}</span>
      `;
      container.appendChild(item);
    });
  },

  // ======== Game Over ========
  showGameOver(rankings) {
    this.showScreen('screen-gameover');
    this.renderScoreboard(rankings, 'final-scoreboard');
    this.createConfetti();
  },

  createConfetti() {
    const container = this.elements.confettiContainer;
    container.innerHTML = '';

    const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff66ff', '#ffd700', '#00d4ff'];
    
    for (let i = 0; i < 80; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = `${2 + Math.random() * 3}s`;
      piece.style.animationDelay = `${Math.random() * 2}s`;
      piece.style.width = `${6 + Math.random() * 8}px`;
      piece.style.height = `${6 + Math.random() * 8}px`;
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      container.appendChild(piece);
    }
  },

  // ======== Toast Notification ========
  showToast(message, type = 'info', duration = 2500) {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    (this.elements.app || document.body).appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ======== Card Shake Effect ========
  shakeCard() {
    this.elements.cardContainer.classList.add('shake');
    setTimeout(() => {
      this.elements.cardContainer.classList.remove('shake');
    }, 500);
  },

  // ======== Ripple Effect ========
  _initRipple() {
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('pointerdown', (e) => {
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;
        const ripple = document.createElement('span');
        ripple.className = 'btn-ripple';
        ripple.style.width  = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left   = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top    = (e.clientY - rect.top  - size / 2) + 'px';
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      });
    });
  },

  // ======== Edit Name Popup ========
  showEditPopup(playerId, currentName) {
    this._editingPlayerId = playerId;
    const input = document.getElementById('popup-name-input');
    input.value = currentName;
    document.getElementById('popup-edit-player').classList.remove('hidden');
    setTimeout(() => { input.focus(); input.select(); }, 50);
  },

  hideEditPopup() {
    document.getElementById('popup-edit-player').classList.add('hidden');
    this._editingPlayerId = null;
  },

  // ======== Utility ========
  $(selector) {
    return document.querySelector(selector);
  },

  $$(selector) {
    return document.querySelectorAll(selector);
  }
};
