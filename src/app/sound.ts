// Âm thanh bàn cờ, tổng hợp bằng WebAudio ngay trong trình duyệt.
//
// Không dùng file âm thanh tải về: khỏi lo giấy phép, khỏi tải thêm, và chỉnh
// được bằng vài con số. Mỗi tiếng đều rất ngắn (dưới 120ms) để không gây khó chịu
// khi đi nhanh.

export type SoundName = 'move' | 'capture' | 'check' | 'end' | 'tick' | 'wrong';

let ctx: AudioContext | null = null;
let enabled = true;

try {
  enabled = localStorage.getItem('sound') !== 'off';
} catch {
  /* chế độ riêng tư: cứ bật */
}

export function soundEnabled(): boolean {
  return enabled;
}

/** Tắt tiếng riêng cửa sổ này, không đổi cài đặt đã lưu (bàn cờ nổi: chơi ở chỗ làm). */
export function muteHere(): void {
  enabled = false;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem('sound', on ? 'on' : 'off');
  } catch {
    /* bỏ qua */
  }
}

/** AudioContext chỉ được tạo sau thao tác đầu tiên của người dùng. */
function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Một tiếng gõ: dao động hình sin tắt nhanh, nghe như quân cờ đặt xuống gỗ. */
function blip(freq: number, ms: number, gain: number, type: OscillatorType = 'sine', delay = 0): void {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  // Hạ dần tần số một chút cho giống tiếng gõ vào vật cứng
  osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.7), t0 + ms / 1000);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + ms / 1000 + 0.02);
}

export function playSound(name: SoundName): void {
  switch (name) {
    case 'move':
      blip(230, 70, 0.16);
      break;
    case 'capture':
      // Hai tiếng sát nhau: quân bị nhấc ra rồi quân mới đặt xuống
      blip(300, 50, 0.14, 'triangle');
      blip(170, 90, 0.2, 'sine', 0.035);
      break;
    case 'check':
      blip(620, 70, 0.13, 'triangle');
      blip(820, 90, 0.12, 'triangle', 0.07);
      break;
    case 'end':
      blip(500, 110, 0.13, 'sine');
      blip(380, 140, 0.13, 'sine', 0.1);
      blip(250, 220, 0.14, 'sine', 0.2);
      break;
    case 'tick':
      blip(950, 35, 0.09, 'square');
      break;
    case 'wrong':
      blip(150, 110, 0.15, 'square');
      break;
  }
}
