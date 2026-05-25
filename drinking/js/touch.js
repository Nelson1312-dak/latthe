/**
 * touch.js - Touch Gesture Detection
 * Handles swipe, tap, and long press for mobile interaction
 */

class TouchHandler {
  constructor(element) {
    this.element = element;
    this.listeners = {};
    
    // Touch state
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.isSwiping = false;
    
    // Config
    this.swipeThreshold = 50;     // Min distance for swipe (px)
    this.swipeTimeLimit = 300;    // Max time for swipe (ms)
    this.longPressDelay = 500;    // Long press duration (ms)
    this.tapMaxDistance = 10;     // Max movement for a tap (px)
    
    this.longPressTimer = null;
    
    this._bindEvents();
  }

  // ======== Event System ========
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return this; // chainable
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  }

  // ======== Touch Events ========
  _bindEvents() {
    // Touch events (mobile)
    this.element.addEventListener('touchstart', (e) => this._onStart(e), { passive: true });
    this.element.addEventListener('touchmove', (e) => this._onMove(e), { passive: true });
    this.element.addEventListener('touchend', (e) => this._onEnd(e), { passive: true });
    this.element.addEventListener('touchcancel', () => this._onCancel(), { passive: true });

    // Mouse events (desktop fallback)
    this.element.addEventListener('mousedown', (e) => this._onStart(e));
    this.element.addEventListener('mousemove', (e) => {
      if (this.isSwiping) this._onMove(e);
    });
    this.element.addEventListener('mouseup', (e) => this._onEnd(e));
    this.element.addEventListener('mouseleave', () => this._onCancel());
  }

  _getPoint(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  _onStart(e) {
    const point = this._getPoint(e);
    this.startX = point.x;
    this.startY = point.y;
    this.startTime = Date.now();
    this.isSwiping = true;

    // Long press detection
    this.longPressTimer = setTimeout(() => {
      this.emit('longpress', { x: this.startX, y: this.startY });
      this.isSwiping = false;
    }, this.longPressDelay);
  }

  _onMove(e) {
    if (!this.isSwiping) return;

    const point = this._getPoint(e);
    const dx = point.x - this.startX;
    const dy = point.y - this.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Cancel long press if moved too much
    if (distance > this.tapMaxDistance && this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    this.emit('move', { dx, dy, distance, x: point.x, y: point.y });
  }

  _onEnd(e) {
    if (!this.isSwiping) return;
    this.isSwiping = false;

    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;

    const point = this._getPoint(e);
    const dx = point.x - this.startX;
    const dy = point.y - this.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - this.startTime;

    // Determine gesture type
    if (distance < this.tapMaxDistance && elapsed < this.swipeTimeLimit) {
      // TAP
      this.emit('tap', { x: point.x, y: point.y });
    } else if (distance >= this.swipeThreshold && elapsed < this.swipeTimeLimit) {
      // SWIPE
      const direction = this._getSwipeDirection(dx, dy);
      this.emit('swipe', { direction, dx, dy, distance, velocity: distance / elapsed });
      this.emit(`swipe${direction}`, { dx, dy, distance });
    }

    this.emit('end', { dx, dy, distance, elapsed });
  }

  _onCancel() {
    this.isSwiping = false;
    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }

  _getSwipeDirection(dx, dy) {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy) {
      return dx > 0 ? 'Right' : 'Left';
    } else {
      return dy > 0 ? 'Down' : 'Up';
    }
  }

  // ======== Cleanup ========
  destroy() {
    this.listeners = {};
    clearTimeout(this.longPressTimer);
  }
}

// ======== Haptic Feedback (if supported) ========
function hapticFeedback(type = 'light') {
  if ('vibrate' in navigator) {
    switch (type) {
      case 'light': navigator.vibrate(10); break;
      case 'medium': navigator.vibrate(25); break;
      case 'heavy': navigator.vibrate([30, 10, 30]); break;
      case 'success': navigator.vibrate([10, 50, 10]); break;
      case 'error': navigator.vibrate([50, 30, 50, 30, 50]); break;
    }
  }
}

// ======== Visual Tap Feedback ========
function tapBounce(element) {
  element.style.transform = 'scale(0.95)';
  element.style.transition = 'transform 0.1s ease';
  
  setTimeout(() => {
    element.style.transform = 'scale(1)';
    element.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  }, 100);
}
