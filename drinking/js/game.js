/**
 * game.js - Game Engine & State Machine
 * Manages players, turns, deck, scoring for Drinking Games
 */

const PLAYER_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
  '#ff66ff', '#ff8c42', '#00d4ff', '#a855f7',
  '#f472b6', '#34d399', '#fb923c', '#818cf8'
];

const GAME_STATES = {
  IDLE: 'idle',
  SETUP: 'setup',
  PLAYING: 'playing',
  CARD_REVEAL: 'card_reveal',
  WAITING_ACTION: 'waiting_action',
  NEXT_TURN: 'next_turn',
  GAME_OVER: 'game_over'
};

class Player {
  constructor(name, index) {
    this.id = `player_${Date.now()}_${index}`;
    this.name = name;
    this.color = PLAYER_COLORS[index % PLAYER_COLORS.length];
    this.initial = name.charAt(0).toUpperCase();
    this.shots = 0;
    this.challenges_done = 0;
    this.challenges_skipped = 0;
  }

  addShot(count = 1) {
    this.shots += count;
  }

  completedChallenge() {
    this.challenges_done++;
  }

  skippedChallenge() {
    this.challenges_skipped++;
  }

  get totalActions() {
    return this.challenges_done + this.challenges_skipped;
  }
}

class GameEngine {
  constructor() {
    this.state = GAME_STATES.IDLE;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.deck = null;
    this.currentCard = null;
    this.intensity = 'Nhap_Tiec';
    this.roundNumber = 0;
    this.listeners = {};
  }

  // ======== Event System ========
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  }

  // ======== State Management ========
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChange', { from: oldState, to: newState });
  }

  // ======== Player Management ========
  addPlayer(name) {
    if (this.players.length >= 12) {
      return { success: false, error: 'Tối đa 12 người chơi!' };
    }
    
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'Vui lòng nhập tên!' };
    }
    if (trimmed.length > 15) {
      return { success: false, error: 'Tên quá dài (tối đa 15 ký tự)!' };
    }
    
    const duplicate = this.players.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      return { success: false, error: 'Tên này đã có rồi!' };
    }

    const player = new Player(trimmed, this.players.length);
    this.players.push(player);
    this.emit('playerAdded', player);
    return { success: true, player };
  }

  removePlayer(playerId) {
    const index = this.players.findIndex(p => p.id === playerId);
    if (index === -1) return false;
    
    const removed = this.players.splice(index, 1)[0];
    // Reassign colors
    this.players.forEach((p, i) => {
      p.color = PLAYER_COLORS[i % PLAYER_COLORS.length];
    });
    this.emit('playerRemoved', removed);
    return true;
  }

  updatePlayerName(playerId, newName) {
    const trimmed = newName.trim();
    if (!trimmed) {
      return { success: false, error: 'Tên không được để trống!' };
    }
    if (trimmed.length > 15) {
      return { success: false, error: 'Tên quá dài (tối đa 15 ký tự)!' };
    }
    
    const duplicate = this.players.find(p => p.id !== playerId && p.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      return { success: false, error: 'Tên này đã có sẵn!' };
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Không tìm thấy người chơi!' };
    }

    player.name = trimmed;
    player.initial = trimmed.charAt(0).toUpperCase();
    this.emit('playerUpdated', player);
    return { success: true, player };
  }

  get playerCount() {
    return this.players.length;
  }

  get canStart() {
    return this.players.length >= 1;
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex] || null;
  }

  // ======== Game Flow ========
  startGame(intensity = 'Nhap_Tiec', allowedTypes = []) {
    if (!this.canStart) return false;

    this.intensity = intensity;
    this.currentPlayerIndex = 0;
    this.roundNumber = 1;
    this.currentCard = null;

    // Reset player stats
    this.players.forEach(p => {
      p.shots = 0;
      p.challenges_done = 0;
      p.challenges_skipped = 0;
    });

    // Create and shuffle deck
    this.deck = new CardDeck(intensity, allowedTypes);

    this.setState(GAME_STATES.PLAYING);
    this.emit('gameStarted', {
      players: this.players,
      totalCards: this.deck.remaining(),
      intensity: this.intensity
    });

    return true;
  }

  drawCard() {
    if (this.state !== GAME_STATES.PLAYING) return null;

    this.currentCard = this.deck.draw();
    
    if (!this.currentCard) {
      this.endGame();
      return null;
    }

    this.setState(GAME_STATES.CARD_REVEAL);
    this.emit('cardDrawn', {
      card: this.currentCard,
      player: this.currentPlayer,
      remaining: this.deck.remaining()
    });

    return this.currentCard;
  }

  // Player completed the challenge
  completeChallenge() {
    if (this.state !== GAME_STATES.CARD_REVEAL && this.state !== GAME_STATES.WAITING_ACTION) return;
    
    this.currentPlayer.completedChallenge();
    this.setState(GAME_STATES.NEXT_TURN);
    this.emit('challengeCompleted', {
      player: this.currentPlayer,
      card: this.currentCard
    });
  }

  // Player chose to drink instead
  drinkPenalty() {
    if (this.state !== GAME_STATES.CARD_REVEAL && this.state !== GAME_STATES.WAITING_ACTION) return;
    
    const penalty = this.currentCard ? this.currentCard.penalty : 1;
    this.currentPlayer.addShot(penalty);
    this.currentPlayer.skippedChallenge();
    
    this.setState(GAME_STATES.NEXT_TURN);
    this.emit('penaltyDrunk', {
      player: this.currentPlayer,
      card: this.currentCard,
      shots: penalty
    });
  }

  // Add shots to specific players (for NHIE and Vote)
  addShotsToPlayers(playerIds, shotCount = 1) {
    playerIds.forEach(id => {
      const player = this.players.find(p => p.id === id);
      if (player) {
        player.addShot(shotCount);
      }
    });
    this.emit('shotsAdded', { playerIds, shotCount });
  }

  // Move to next player
  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    
    if (this.currentPlayerIndex === 0) {
      this.roundNumber++;
    }

    // Check if deck is empty
    if (this.deck.remaining() === 0) {
      this.endGame();
      return;
    }

    this.currentCard = null;
    this.setState(GAME_STATES.PLAYING);
    this.emit('turnChanged', {
      player: this.currentPlayer,
      round: this.roundNumber,
      remaining: this.deck.remaining()
    });
  }

  endGame() {
    this.setState(GAME_STATES.GAME_OVER);
    
    const rankings = this.getScoreboard();
    this.emit('gameOver', { rankings });
  }

  // ======== Scoreboard ========
  getScoreboard() {
    return [...this.players]
      .sort((a, b) => {
        // Sort by shots descending (most shots = "winner" of drinking)
        if (b.shots !== a.shots) return b.shots - a.shots;
        return b.challenges_skipped - a.challenges_skipped;
      })
      .map((player, index) => ({
        rank: index + 1,
        player,
        medal: index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''
      }));
  }

  // ======== Reset ========
  resetGame() {
    this.state = GAME_STATES.IDLE;
    this.currentPlayerIndex = 0;
    this.roundNumber = 0;
    this.currentCard = null;
    this.deck = null;
    
    this.players.forEach(p => {
      p.shots = 0;
      p.challenges_done = 0;
      p.challenges_skipped = 0;
    });

    this.emit('gameReset', {});
  }

  fullReset() {
    this.resetGame();
    this.players = [];
    this.emit('fullReset', {});
  }
}

// Global instance
const game = new GameEngine();
