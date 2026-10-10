const demo = document.getElementById('demo');
const opacity = document.getElementById('opacity');
const output = document.getElementById('amount');
const modes = document.querySelectorAll('[data-mode]');
const values = { dark: 65, light: 35 };
let mode = 'dark';
function update() {
  demo.style.setProperty('--alpha', String(1 - Number(opacity.value) / 100));
  output.value = `${opacity.value}%`;
}
opacity.addEventListener('input', () => { values[mode] = Number(opacity.value); update(); });
for (const button of modes) button.addEventListener('click', () => {
  mode = button.dataset.mode;
  demo.classList.toggle('light', mode === 'light');
  for (const item of modes) item.setAttribute('aria-pressed', String(item === button));
  opacity.value = values[mode]; update();
});
const motion = document.getElementById('motion');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function renderMotion() {
  if (reduced.matches) { motion.disabled = true; motion.textContent = '已遵循减弱动态设置'; return; }
  motion.disabled = false;
  motion.textContent = demo.classList.contains('paused') ? '播放动态 ▷' : '暂停动态 Ⅱ';
}
motion.addEventListener('click', () => { demo.classList.toggle('paused'); motion.setAttribute('aria-pressed', String(demo.classList.contains('paused'))); renderMotion(); });
reduced.addEventListener('change', renderMotion);
renderMotion(); update();
