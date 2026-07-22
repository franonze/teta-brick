// Utility to format time as mm:ss
function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// Utility to format Date as HH:MMh
function formatHHMM(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}h`;
}

// Utility to get current time as HH:MMh
function getCurrentTime() {
    return formatHHMM(new Date());
}

// Add hours to a specific date and format as HH:MMh
function addHoursToTime(baseDate, hoursToAdd) {
    if (!hoursToAdd || isNaN(hoursToAdd) || !baseDate) return '--:--';
    
    const futureTime = new Date(baseDate.getTime() + hoursToAdd * 60 * 60 * 1000);
    return formatHHMM(futureTime);
}

// State
let leftTimerInterval = null;
let leftSeconds = 0;
let rightTimerInterval = null;
let rightSeconds = 0;
let lastFeedingStartTime = null; // Stores the Date of the last play press

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

function updateNextFeedingTime() {
    const hours = parseFloat(nextFeedingInput.value);
    if (lastFeedingStartTime && !isNaN(hours)) {
        nextFeedingTime.textContent = addHoursToTime(lastFeedingStartTime, hours);
    } else {
        nextFeedingTime.textContent = '--:--';
    }
}

function pauseLeftTimer() {
    if (leftTimerInterval) {
        clearInterval(leftTimerInterval);
        leftTimerInterval = null;
        btnLeft.innerHTML = svgPlay;
    }
}

function pauseRightTimer() {
    if (rightTimerInterval) {
        clearInterval(rightTimerInterval);
        rightTimerInterval = null;
        btnRight.innerHTML = svgPlay;
    }
}

// Left Button Logic
btnLeft.addEventListener('click', () => {
    if (leftTimerInterval) {
        // Is playing, so pause it
        pauseLeftTimer();
    } else {
        // Start playing left, so pause right first
        pauseRightTimer();
        
        lastFeedingStartTime = new Date();
        hourLeft.textContent = formatHHMM(lastFeedingStartTime);
        updateNextFeedingTime(); // Update calculation based on new start time

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
        // Is playing, so pause it
        pauseRightTimer();
    } else {
        // Start playing right, so pause left first
        pauseLeftTimer();
        
        lastFeedingStartTime = new Date();
        hourRight.textContent = formatHHMM(lastFeedingStartTime);
        updateNextFeedingTime(); // Update calculation based on new start time

        btnRight.innerHTML = svgPause;
        rightTimerInterval = setInterval(() => {
            rightSeconds++;
            timeRight.textContent = formatTime(rightSeconds);
        }, 1000);
    }
});

// Next feeding input logic
nextFeedingInput.addEventListener('input', updateNextFeedingTime);

const btnRegistrar = document.getElementById('btn-registrar');

// Diaper buttons logic
btnPoop.addEventListener('click', () => {
    timePoop.textContent = getCurrentTime();
});

btnPee.addEventListener('click', () => {
    timePee.textContent = getCurrentTime();
});

// Registrar Session
btnRegistrar.addEventListener('click', () => {
    // 1. Gather current state
    const sessionData = {
        date: new Date().toISOString(),
        left: {
            durationSeconds: leftSeconds,
            startTime: hourLeft.textContent !== '--:--' ? hourLeft.textContent : null
        },
        right: {
            durationSeconds: rightSeconds,
            startTime: hourRight.textContent !== '--:--' ? hourRight.textContent : null
        },
        diapers: {
            poop: timePoop.textContent !== '--:--' ? timePoop.textContent : null,
            pee: timePee.textContent !== '--:--' ? timePee.textContent : null
        }
    };

    // Check if there is anything to save
    if (leftSeconds === 0 && rightSeconds === 0 && !sessionData.diapers.poop && !sessionData.diapers.pee) {
        alert('No hay datos activos para registrar.');
        return;
    }

    // 2. Save to local storage
    const history = JSON.parse(localStorage.getItem('babyLogHistory')) || [];
    history.push(sessionData);
    localStorage.setItem('babyLogHistory', JSON.stringify(history));

    // 3. Clear the screen (Reset state and UI)
    pauseLeftTimer();
    pauseRightTimer();
    leftSeconds = 0;
    rightSeconds = 0;
    lastFeedingStartTime = null;

    timeLeft.textContent = '00:00';
    timeRight.textContent = '00:00';
    hourLeft.textContent = '--:--';
    hourRight.textContent = '--:--';
    
    timePoop.textContent = '--:--';
    timePee.textContent = '--:--';
    
    nextFeedingInput.value = '';
    nextFeedingTime.textContent = '--:--';

    // Optional: Visual feedback
    const originalText = btnRegistrar.textContent;
    btnRegistrar.textContent = '¡REGISTRADO!';
    btnRegistrar.style.backgroundColor = 'var(--accent-primary)';
    
    setTimeout(() => {
        btnRegistrar.textContent = originalText;
        btnRegistrar.style.backgroundColor = '';
    }, 2000);
});

// --- Navigation Logic ---
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Update active class on nav items
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Show target view
        const targetId = item.getAttribute('data-target');
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetId) {
                view.classList.add('active');
            }
        });

        // If history view is opened, render history
        if (targetId === 'view-historial') {
            renderHistory();
        }
    });
});

// --- History Rendering Logic ---
const countPoop = document.getElementById('count-poop');
const countPee = document.getElementById('count-pee');
const historyContainer = document.getElementById('history-container');

function isToday(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('babyLogHistory')) || [];
    
    // Filter to today only
    const todaySessions = history.filter(session => isToday(session.date));
    
    // Calculate totals for poop and pee
    let totalPoops = 0;
    let totalPees = 0;
    
    // Extract single events for the timeline
    let events = [];

    todaySessions.forEach(session => {
        // Left feeding
        if (session.left.startTime) {
            events.push({
                timeStr: session.left.startTime,
                type: 'izq',
                desc: `${Math.round(session.left.durationSeconds / 60)}min`,
                icon: '🍼'
            });
        }
        // Right feeding
        if (session.right.startTime) {
            events.push({
                timeStr: session.right.startTime,
                type: 'dcha',
                desc: `${Math.round(session.right.durationSeconds / 60)}min`,
                icon: '🍼'
            });
        }
        // Poop
        if (session.diapers.poop) {
            totalPoops++;
            events.push({
                timeStr: session.diapers.poop,
                type: 'caca',
                desc: '',
                icon: '💩'
            });
        }
        // Pee
        if (session.diapers.pee) {
            totalPees++;
            events.push({
                timeStr: session.diapers.pee,
                type: 'pis',
                desc: '',
                icon: '💧'
            });
        }
    });

    // Update summary counts
    countPoop.textContent = totalPoops;
    countPee.textContent = totalPees;

    // Sort events by time (descending - newest first)
    events.sort((a, b) => b.timeStr.localeCompare(a.timeStr));

    // Render HTML
    historyContainer.innerHTML = '';
    
    if (events.length === 0) {
        historyContainer.innerHTML = '<div class="empty-state">No hay registros para hoy.</div>';
        return;
    }

    events.forEach(ev => {
        const itemHtml = `
            <div class="history-item">
                <div class="history-time">${ev.timeStr}</div>
                <div class="history-content">
                    <div class="history-title">
                        <span>${ev.icon}</span> ${ev.type.charAt(0).toUpperCase() + ev.type.slice(1)}
                    </div>
                    ${ev.desc ? `<div class="history-desc">${ev.desc}</div>` : ''}
                </div>
            </div>
        `;
        historyContainer.insertAdjacentHTML('beforeend', itemHtml);
    });
}
