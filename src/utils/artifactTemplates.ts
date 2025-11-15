// Artifact templates for common use cases

export interface ArtifactTemplate {
  title: string;
  html: string;
  css: string;
  javascript: string;
}

export const POMODORO_TIMER: ArtifactTemplate = {
  title: 'Pomodoro Timer',
  html: `<div class="pomodoro">
  <h1 id="time">25:00</h1>
  <div class="controls">
    <button id="start">Start</button>
    <button id="pause">Pause</button>
    <button id="reset">Reset</button>
  </div>
</div>`,
  css: `body {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: white;
  margin: 0;
}
.pomodoro {
  text-align: center;
  background: rgba(255,255,255,0.1);
  padding: 40px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}
#time {
  font-size: 5em;
  margin: 0;
  font-weight: 300;
}
.controls {
  margin-top: 30px;
  display: flex;
  gap: 15px;
  justify-content: center;
}
button {
  padding: 15px 30px;
  font-size: 1.1em;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  background: white;
  color: #667eea;
  font-weight: 600;
  transition: transform 0.2s;
}
button:hover {
  transform: scale(1.05);
}`,
  javascript: `let minutes = 25;
let seconds = 0;
let interval = null;
let isRunning = false;

const timeDisplay = document.getElementById('time');
const startBtn = document.getElementById('start');
const pauseBtn = document.getElementById('pause');
const resetBtn = document.getElementById('reset');

function updateDisplay() {
  const m = String(minutes).padStart(2, '0');
  const s = String(seconds).padStart(2, '0');
  timeDisplay.textContent = m + ':' + s;
}

function tick() {
  if (seconds === 0) {
    if (minutes === 0) {
      clearInterval(interval);
      interval = null;
      isRunning = false;
      alert('Pomodoro complete!');
      return;
    }
    minutes--;
    seconds = 59;
  } else {
    seconds--;
  }
  updateDisplay();
}

startBtn.addEventListener('click', () => {
  if (!isRunning) {
    interval = setInterval(tick, 1000);
    isRunning = true;
  }
});

pauseBtn.addEventListener('click', () => {
  clearInterval(interval);
  interval = null;
  isRunning = false;
});

resetBtn.addEventListener('click', () => {
  clearInterval(interval);
  interval = null;
  minutes = 25;
  seconds = 0;
  isRunning = false;
  updateDisplay();
});`
};

export const CALCULATOR: ArtifactTemplate = {
  title: 'Calculator',
  html: `<div class="calculator">
  <input type="text" id="display" readonly value="0">
  <div class="buttons">
    <button onclick="clearDisplay()">C</button>
    <button onclick="appendNumber('7')">7</button>
    <button onclick="appendNumber('8')">8</button>
    <button onclick="appendNumber('9')">9</button>
    <button onclick="setOperation('/')">/</button>
    <button onclick="appendNumber('4')">4</button>
    <button onclick="appendNumber('5')">5</button>
    <button onclick="appendNumber('6')">6</button>
    <button onclick="setOperation('*')">×</button>
    <button onclick="appendNumber('1')">1</button>
    <button onclick="appendNumber('2')">2</button>
    <button onclick="appendNumber('3')">3</button>
    <button onclick="setOperation('-')">-</button>
    <button onclick="appendNumber('0')">0</button>
    <button onclick="appendNumber('.')">.</button>
    <button onclick="calculate()">=</button>
    <button onclick="setOperation('+')">+</button>
  </div>
</div>`,
  css: `body {
  background: #1a1a2e;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  margin: 0;
}
.calculator {
  background: #16213e;
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
#display {
  width: 100%;
  padding: 20px;
  font-size: 2em;
  text-align: right;
  border: none;
  background: #0f3460;
  color: #e94560;
  border-radius: 10px;
  margin-bottom: 20px;
  box-sizing: border-box;
}
.buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
button {
  padding: 20px;
  font-size: 1.5em;
  border: none;
  background: #533483;
  color: white;
  border-radius: 10px;
  cursor: pointer;
  transition: 0.2s;
}
button:hover {
  background: #e94560;
}`,
  javascript: `let currentValue = '0';
let previousValue = null;
let operation = null;

function updateDisplay() {
  document.getElementById('display').value = currentValue;
}

function clearDisplay() {
  currentValue = '0';
  previousValue = null;
  operation = null;
  updateDisplay();
}

function appendNumber(num) {
  if (currentValue === '0') {
    currentValue = num;
  } else {
    currentValue += num;
  }
  updateDisplay();
}

function setOperation(op) {
  if (previousValue === null) {
    previousValue = parseFloat(currentValue);
    currentValue = '0';
    operation = op;
  } else {
    calculate();
    operation = op;
  }
}

function calculate() {
  if (previousValue !== null && operation) {
    const current = parseFloat(currentValue);
    let result;
    switch(operation) {
      case '+': result = previousValue + current; break;
      case '-': result = previousValue - current; break;
      case '*': result = previousValue * current; break;
      case '/': result = previousValue / current; break;
    }
    currentValue = String(result);
    previousValue = null;
    operation = null;
    updateDisplay();
  }
}`
};

export function generatePieChart(data: Record<string, number>, title: string = 'Chart'): ArtifactTemplate {
  const dataJson = JSON.stringify(data, null, 2);

  return {
    title: `${title} - Pie Chart`,
    html: `<div class="chart-container">
  <h2>${title}</h2>
  <canvas id="chart" width="600" height="600"></canvas>
</div>`,
    css: `body {
  background: #1a1a2e;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  color: white;
  font-family: Arial, sans-serif;
  margin: 0;
}
.chart-container {
  text-align: center;
}
h2 {
  margin-bottom: 20px;
  color: #e6edf3;
}`,
    javascript: `const data = ${dataJson};

const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

const total = Object.values(data).reduce((a, b) => a + b, 0);
const centerX = 300;
const centerY = 300;
const radius = 200;

let currentAngle = 0;
Object.entries(data).forEach(([label, value], i) => {
  const sliceAngle = (value / total) * 2 * Math.PI;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
  ctx.lineTo(centerX, centerY);
  ctx.fillStyle = colors[i % colors.length];
  ctx.fill();

  const labelAngle = currentAngle + sliceAngle / 2;
  const labelX = centerX + Math.cos(labelAngle) * (radius + 50);
  const labelY = centerY + Math.sin(labelAngle) * (radius + 50);
  ctx.fillStyle = '#e6edf3';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(
    label + ': ' + value + ' (' + ((value/total)*100).toFixed(1) + '%)',
    labelX, labelY
  );

  currentAngle += sliceAngle;
});`
  };
}

export function customizeTimer(minutes: number): ArtifactTemplate {
  const template = { ...POMODORO_TIMER };
  template.title = `${minutes}-Minute Timer`;
  template.html = template.html.replace('25:00', `${minutes}:00`);
  template.javascript = template.javascript.replace(/let minutes = 25;/g, `let minutes = ${minutes};`);
  template.javascript = template.javascript.replace(/minutes = 25;/g, `minutes = ${minutes};`);
  return template;
}

export function detectArtifactType(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('timer') || lower.includes('pomodoro')) return 'timer';
  if (lower.includes('calculat')) return 'calculator';
  if (lower.includes('chart') || lower.includes('graph') || lower.includes('pie')) return 'chart';
  return 'custom';
}
