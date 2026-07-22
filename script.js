// Utility to format time as mm:ss
function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// Utility to get current time as HH:MM
function getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}h`;
}

// Add hours to current time and format as HH:MM
function addHoursToCurrentTime(hoursToAdd) {
    if (!hoursToAdd || isNaN(hoursToAdd)) return '--:--';
    
    const now = new Date();
    const futureTime = new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000);
    return `${futureTime.getHours().toString().padStart(2, '0')}:${futureTime.getMinutes().toString().padStart(2, '0')}h`;
}

// State
let leftTimerInterval = null;
let leftSeconds = 0;
let rightTimerInterval = null;
let rightSeconds = 0;

// DOM Elements
const btnLeft = document.getElementById('btn-left');
const timeLeft = document.getElementById('time-left');
const hourLeft = document.getElementById('hour-left');

const btnRight = document.getElementById('btn-right');
const timeRight = document.getElementById('time-right');
const hourRight = document.getElementById('hour-right');

const nextFeedingInput = document.getElementById('next-feeding-input');
const nextFeedingTime = document.getElementById('next-feeding-time');

const btnPoop = document.getElementById('btn-poop');
const timePoop = document.getElementById('time-poop');

const btnPee = document.getElementById('btn-pee');
const timePee = document.getElementById('time-pee');

const svgPlay = '<svg viewBox="0 0 24 24" class="icon-play"><path d="M8 5v14l11-7z"/></svg>';
const svgPause = '<svg viewBox="0 0 24 24" class="icon-play"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

// Left Button Logic
btnLeft.addEventListener('click', () => {
    if (leftTimerInterval) {
        // Pause
        clearInterval(leftTimerInterval);
        leftTimerInterval = null;
        btnLeft.innerHTML = svgPlay;
    } else {
        // Play
        if (leftSeconds === 0) {
            hourLeft.textContent = getCurrentTime();
        }
        btnLeft.innerHTML = svgPause;
        leftTimerInterval = setInterval(() => {
            leftSeconds++;
            timeLeft.textContent = formatTime(leftSeconds);
        }, 1000);
    }
});

// Right Button Logic
btnRight.addEventListener('click', () => {
    if (rightTimerInterval) {
        // Pause
        clearInterval(rightTimerInterval);
        rightTimerInterval = null;
        btnRight.innerHTML = svgPlay;
    } else {
        // Play
        if (rightSeconds === 0) {
            hourRight.textContent = getCurrentTime();
        }
        btnRight.innerHTML = svgPause;
        rightTimerInterval = setInterval(() => {
            rightSeconds++;
            timeRight.textContent = formatTime(rightSeconds);
        }, 1000);
    }
});

// Next feeding input logic
nextFeedingInput.addEventListener('input', (e) => {
    const hours = parseFloat(e.target.value);
    nextFeedingTime.textContent = addHoursToCurrentTime(hours);
});

// Diaper buttons logic
btnPoop.addEventListener('click', () => {
    timePoop.textContent = getCurrentTime();
});

btnPee.addEventListener('click', () => {
    timePee.textContent = getCurrentTime();
});
