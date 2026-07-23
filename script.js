// Utility to format time as mm:ss
function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// Utility to format Date as HH:MM
function formatHHMM(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
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
let countdownBaseTime = null; // Used for next feeding timer so it persists across sessions

const MIN_SECONDS_TO_KEEP = 10;

// DOM Elements
const btnLeft = document.getElementById('btn-left');
const timeLeft = document.getElementById('time-left');
const hourLeft = document.getElementById('hour-left');

const btnRight = document.getElementById('btn-right');
const timeRight = document.getElementById('time-right');
const hourRight = document.getElementById('hour-right');

const nextFeedingInput = document.getElementById('next-feeding-input');
const nextFeedingTime = document.getElementById('next-feeding-time');

const btnDiaper = document.getElementById('btn-diaper');
const timeDiaper = document.getElementById('time-diaper');

const svgPlay = '<svg viewBox="0 0 24 24" class="icon-play"><path d="M8 5v14l11-7z"/></svg>';
const svgPause = '<svg viewBox="0 0 24 24" class="icon-play"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

let countdownInterval = null;
let nextFeedingDate = null;
let alarmInterval = null;
let alarmTriggered = false;
let audioCtx = null;

function playAlarmBeep() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Si el contexto está suspendido (por políticas del navegador), intentamos reanudarlo
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const playBeep = (timeOffset) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + timeOffset);
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + timeOffset);
        gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + timeOffset + 0.05);
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime + timeOffset + 0.15);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + timeOffset + 0.2);
        
        osc.start(audioCtx.currentTime + timeOffset);
        osc.stop(audioCtx.currentTime + timeOffset + 0.25);
    };

    playBeep(0);
    playBeep(0.3);
    playBeep(0.6);
}

function startAlarmLoop() {
    if (alarmInterval) return;
    playAlarmBeep(); 
    alarmInterval = setInterval(playAlarmBeep, 2000); 
}

function stopAlarm() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
    nextFeedingTime.classList.remove('alarm-ringing');
}

// Detener la alarma tocando el temporizador
nextFeedingTime.addEventListener('click', stopAlarm);

function updateNextFeedingTime() {
    const hoursStr = nextFeedingInput.value;
    const hours = hoursStr !== '' ? parseFloat(hoursStr) : 4;
    if (countdownBaseTime && !isNaN(hours)) {
        nextFeedingDate = new Date(countdownBaseTime.getTime() + hours * 60 * 60 * 1000);
        if (!countdownInterval) {
            countdownInterval = setInterval(renderCountdown, 1000);
        }
        renderCountdown();
    } else {
        nextFeedingDate = null;
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        nextFeedingTime.textContent = '--:--';
    }
}

function renderCountdown() {
    if (!nextFeedingDate) return;
    const now = new Date();
    const diff = nextFeedingDate.getTime() - now.getTime();
    
    if (diff <= 0) {
        if (!alarmTriggered) {
            alarmTriggered = true;
            nextFeedingTime.classList.add('alarm-ringing');
            startAlarmLoop();
        }
    } else {
        alarmTriggered = false;
        stopAlarm();
    }
    
    const totalSeconds = Math.floor(Math.abs(diff) / 1000);
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    const sign = diff < 0 && totalSeconds > 0 ? '-' : '';
    nextFeedingTime.textContent = `${sign}${h}:${m}:${s}`;
}

function pauseLeftTimer(isSwap = false) {
    if (leftTimerInterval) {
        clearInterval(leftTimerInterval);
        leftTimerInterval = null;
        btnLeft.innerHTML = svgPlay;
        
        if (!isSwap && leftSeconds < MIN_SECONDS_TO_KEEP) {
            leftSeconds = 0;
            timeLeft.textContent = '00:00';
            hourLeft.textContent = '--:--';
        }
    }
}

function pauseRightTimer(isSwap = false) {
    if (rightTimerInterval) {
        clearInterval(rightTimerInterval);
        rightTimerInterval = null;
        btnRight.innerHTML = svgPlay;
        
        if (!isSwap && rightSeconds < MIN_SECONDS_TO_KEEP) {
            rightSeconds = 0;
            timeRight.textContent = '00:00';
            hourRight.textContent = '--:--';
        }
    }
}

// Left Button Logic
btnLeft.addEventListener('click', () => {
    btnLeft.classList.remove('highlight-next');
    if (leftTimerInterval) {
        // Is playing, so pause it
        pauseLeftTimer();
    } else {
        // Start playing left, so pause right first
        pauseRightTimer();
        
        const now = new Date();
        if (!lastFeedingStartTime) {
            lastFeedingStartTime = now;
            countdownBaseTime = now;
        }
        if (hourLeft.textContent === '--:--') {
            hourLeft.textContent = formatHHMM(now);
        }
        updateNextFeedingTime(); // Update calculation based on new start time

        btnLeft.innerHTML = svgPause;
        const startMillis = Date.now() - leftSeconds * 1000;
        leftTimerInterval = setInterval(() => {
            leftSeconds = Math.floor((Date.now() - startMillis) / 1000);
            timeLeft.textContent = formatTime(leftSeconds);
        }, 1000);
    }
});

// Right Button Logic
btnRight.addEventListener('click', () => {
    btnRight.classList.remove('highlight-next');
    if (rightTimerInterval) {
        // Is playing, so pause it
        pauseRightTimer();
    } else {
        // Start playing right, so pause left first
        pauseLeftTimer();
        
        const now = new Date();
        if (!lastFeedingStartTime) {
            lastFeedingStartTime = now;
            countdownBaseTime = now;
        }
        if (hourRight.textContent === '--:--') {
            hourRight.textContent = formatHHMM(now);
        }
        updateNextFeedingTime(); // Update calculation based on new start time

        btnRight.innerHTML = svgPause;
        const startMillis = Date.now() - rightSeconds * 1000;
        rightTimerInterval = setInterval(() => {
            rightSeconds = Math.floor((Date.now() - startMillis) / 1000);
            timeRight.textContent = formatTime(rightSeconds);
        }, 1000);
    }
});

// Reset logic
const btnResetLeft = document.getElementById('btn-reset-left');
btnResetLeft.addEventListener('click', () => {
    pauseLeftTimer();
    leftSeconds = 0;
    timeLeft.textContent = '00:00';
    hourLeft.textContent = '--:--';
});

const btnResetRight = document.getElementById('btn-reset-right');
btnResetRight.addEventListener('click', () => {
    pauseRightTimer();
    rightSeconds = 0;
    timeRight.textContent = '00:00';
    hourRight.textContent = '--:--';
});

// Swap logic
const btnSwap = document.getElementById('btn-swap');
btnSwap.addEventListener('click', () => {
    const leftWasPlaying = !!leftTimerInterval;
    const rightWasPlaying = !!rightTimerInterval;
    
    pauseLeftTimer(true);
    pauseRightTimer(true);
    
    // Swap seconds
    const tempSeconds = leftSeconds;
    leftSeconds = rightSeconds;
    rightSeconds = tempSeconds;
    
    timeLeft.textContent = formatTime(leftSeconds);
    timeRight.textContent = formatTime(rightSeconds);
    
    // Swap hours
    const tempHour = hourLeft.textContent;
    hourLeft.textContent = hourRight.textContent;
    hourRight.textContent = tempHour;
    
    // Resume appropriately
    if (leftWasPlaying) {
        btnRight.innerHTML = svgPause;
        const startMillis = Date.now() - rightSeconds * 1000;
        rightTimerInterval = setInterval(() => {
            rightSeconds = Math.floor((Date.now() - startMillis) / 1000);
            timeRight.textContent = formatTime(rightSeconds);
        }, 1000);
    } else if (rightWasPlaying) {
        btnLeft.innerHTML = svgPause;
        const startMillis = Date.now() - leftSeconds * 1000;
        leftTimerInterval = setInterval(() => {
            leftSeconds = Math.floor((Date.now() - startMillis) / 1000);
            timeLeft.textContent = formatTime(leftSeconds);
        }, 1000);
    }
    
    // Swap highlights if applicable
    const leftHasHighlight = btnLeft.classList.contains('highlight-next');
    const rightHasHighlight = btnRight.classList.contains('highlight-next');
    
    if (leftHasHighlight) {
        btnLeft.classList.remove('highlight-next');
        btnRight.classList.add('highlight-next');
    } else if (rightHasHighlight) {
        btnRight.classList.remove('highlight-next');
        btnLeft.classList.add('highlight-next');
    }
});

// Next feeding input logic
nextFeedingInput.addEventListener('input', updateNextFeedingTime);

const btnRegistrar = document.getElementById('btn-registrar');

// Diaper Action
btnDiaper.addEventListener('click', () => {
    const now = new Date();
    timeDiaper.textContent = formatHHMM(now);
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
        diapers: timeDiaper.textContent !== '--:--' ? timeDiaper.textContent : null
    };

    // Check if there is anything to save
    if (leftSeconds === 0 && rightSeconds === 0 && !sessionData.diapers) {
        alert('No hay datos activos para registrar.');
        return;
    }

    // 2. Save to local storage
    const history = JSON.parse(localStorage.getItem('babyLogHistory')) || [];
    history.push(sessionData);
    localStorage.setItem('babyLogHistory', JSON.stringify(history));

    // Highlight logic
    btnLeft.classList.remove('highlight-next');
    btnRight.classList.remove('highlight-next');
    if (leftSeconds > 0 && rightSeconds === 0) {
        btnRight.classList.add('highlight-next');
    } else if (rightSeconds > 0 && leftSeconds === 0) {
        btnLeft.classList.add('highlight-next');
    }

    // 3. Clear the screen (Reset state and UI)
    pauseLeftTimer();
    pauseRightTimer();
    leftSeconds = 0;
    rightSeconds = 0;
    lastFeedingStartTime = null;
    
    // Optional: Visual feedback
    timeLeft.textContent = '00:00';
    timeRight.textContent = '00:00';
    hourLeft.textContent = '--:--';
    hourRight.textContent = '--:--';
    
    timeDiaper.textContent = '--:--';

    const originalText = btnRegistrar.textContent;
    btnRegistrar.textContent = '¡REGISTRADO!';
    btnRegistrar.style.backgroundColor = 'var(--accent-primary)';
    
    setTimeout(() => {
        btnRegistrar.textContent = originalText;
        btnRegistrar.style.backgroundColor = '';
    }, 2000);
});

// Reset next feed logic
const btnResetNext = document.getElementById('btn-reset-next');
btnResetNext.addEventListener('click', () => {
    countdownBaseTime = null;
    nextFeedingDate = null;
    alarmTriggered = false;
    stopAlarm();
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    nextFeedingTime.textContent = '--:--';
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
const countFeedings = document.getElementById('count-feedings');
const countDiaper = document.getElementById('count-diaper');
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
    
    let totalFeedings = 0;
    let totalDiapers = 0;

    // We'll prepare a structured array of sessions to render, sorted newest first
    todaySessions.sort((a, b) => new Date(b.date) - new Date(a.date));

    historyContainer.innerHTML = '';
    
    if (todaySessions.length === 0) {
        historyContainer.innerHTML = '<div class="empty-state">No hay registros para hoy.</div>';
        return;
    }

    todaySessions.forEach(session => {
        let isFeeding = false;
        const sid = session.date;
        const sessionEvents = [];
        
        // Left feeding
        if (session.left && session.left.startTime) {
            isFeeding = true;
            sessionEvents.push({
                id: sid,
                key: 'left',
                timeStr: session.left.startTime,
                type: 'Toma Izquierda',
                desc: `${Math.round(session.left.durationSeconds / 60)}min`,
                icon: '🍼'
            });
        }
        // Right feeding
        if (session.right && session.right.startTime) {
            isFeeding = true;
            sessionEvents.push({
                id: sid,
                key: 'right',
                timeStr: session.right.startTime,
                type: 'Toma Derecha',
                desc: `${Math.round(session.right.durationSeconds / 60)}min`,
                icon: '🍼'
            });
        }
        
        if (isFeeding) {
            totalFeedings++;
        }

        // Diaper
        if (session.diapers) {
            let diaperTime = null;
            if (typeof session.diapers === 'string') {
                diaperTime = session.diapers;
            } else if (typeof session.diapers === 'object') {
                diaperTime = session.diapers.poop || session.diapers.pee;
            }
            
            if (diaperTime) {
                totalDiapers++;
                sessionEvents.push({
                    id: sid,
                    key: 'diaper',
                    timeStr: diaperTime,
                    type: 'Cambio de pañal',
                    desc: '',
                    icon: '💩'
                });
            }
        }
        
        // If there are no events in this session (e.g. everything was deleted), skip it
        if (sessionEvents.length === 0) return;

        // Sort events inside the session by time descending just in case
        sessionEvents.sort((a, b) => {
            const timeA = typeof a.timeStr === 'string' ? a.timeStr : '';
            const timeB = typeof b.timeStr === 'string' ? b.timeStr : '';
            return timeB.localeCompare(timeA);
        });

        // Build HTML for the entire session group
        let sessionHtml = `<div class="history-item" style="flex-direction: column; align-items: stretch; gap: 0;">`;
        
        sessionEvents.forEach((ev, idx) => {
            const borderTop = idx > 0 ? `border-top: 1px solid rgba(255,255,255,0.05); margin-top: 12px; padding-top: 12px;` : '';
            sessionHtml += `
                <div style="display: flex; align-items: center; gap: 16px; ${borderTop}">
                    <div class="history-time">${ev.timeStr}</div>
                    <div class="history-content">
                        <div class="history-title">
                            <span>${ev.icon}</span> ${ev.type}
                        </div>
                        ${ev.desc ? `<div class="history-desc">${ev.desc}</div>` : ''}
                    </div>
                    <div class="history-actions">
                        <button class="action-btn edit-btn" onclick="editEvent('${ev.id}', '${ev.key}')" title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button class="action-btn delete-btn" onclick="deleteEvent('${ev.id}', '${ev.key}')" title="Borrar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        });

        sessionHtml += `</div>`;
        historyContainer.insertAdjacentHTML('beforeend', sessionHtml);
    });
    
    // Update summary counts
    countFeedings.textContent = totalFeedings;
    countDiaper.textContent = totalDiapers;
}

// Logic for Editing and Deleting History Events
let currentDeleteId = null;
let currentDeleteKey = null;

let currentEditId = null;
let currentEditKey = null;

// Delete Modal Logic
const deleteModal = document.getElementById('delete-modal');
const btnDeleteConfirm = document.getElementById('delete-confirm');
const btnDeleteCancel = document.getElementById('delete-cancel');

window.deleteEvent = function(id, key) {
    currentDeleteId = id;
    currentDeleteKey = key;
    deleteModal.classList.add('active');
};

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    currentDeleteId = null;
    currentDeleteKey = null;
}
btnDeleteCancel.addEventListener('click', closeDeleteModal);
deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
});

btnDeleteConfirm.addEventListener('click', () => {
    if (!currentDeleteId || !currentDeleteKey) return;
    
    let history = JSON.parse(localStorage.getItem('babyLogHistory')) || [];
    const index = history.findIndex(s => s.date === currentDeleteId);
    if (index !== -1) {
        if (currentDeleteKey === 'left') {
            history[index].left.startTime = null;
            history[index].left.durationSeconds = 0;
        } else if (currentDeleteKey === 'right') {
            history[index].right.startTime = null;
            history[index].right.durationSeconds = 0;
        } else if (currentDeleteKey === 'diaper') {
            history[index].diapers = null;
        }
        
        // If session is completely empty, remove it entirely
        if (!history[index].left.startTime && !history[index].right.startTime && !history[index].diapers) {
            history.splice(index, 1);
        }
        
        localStorage.setItem('babyLogHistory', JSON.stringify(history));
        renderHistory();
    }
    closeDeleteModal();
});

// Edit Modal Logic
const editModal = document.getElementById('edit-modal');
const editHour = document.getElementById('edit-hour');
const editMinute = document.getElementById('edit-minute');
const editDurationContainer = document.getElementById('edit-duration-container');
const editDuration = document.getElementById('edit-duration');
const btnEditSave = document.getElementById('edit-save');
const btnEditCancel = document.getElementById('edit-cancel');

window.editEvent = function(id, key) {
    let history = JSON.parse(localStorage.getItem('babyLogHistory')) || [];
    const index = history.findIndex(s => s.date === id);
    if (index === -1) return;
    
    currentEditId = id;
    currentEditKey = key;
    let session = history[index];
    let currentTimeStr = '';
    
    if (key === 'left') {
        currentTimeStr = session.left.startTime;
        editDuration.value = Math.round(session.left.durationSeconds / 60);
        editDurationContainer.style.display = 'flex';
    } else if (key === 'right') {
        currentTimeStr = session.right.startTime;
        editDuration.value = Math.round(session.right.durationSeconds / 60);
        editDurationContainer.style.display = 'flex';
    } else if (key === 'diaper') {
        let diaperTime = null;
        if (typeof session.diapers === 'string') {
            diaperTime = session.diapers;
        } else if (typeof session.diapers === 'object') {
            diaperTime = session.diapers.poop || session.diapers.pee;
        }
        currentTimeStr = diaperTime;
        editDurationContainer.style.display = 'none';
    }
    
    if (currentTimeStr && currentTimeStr.includes(':')) {
        const [h, m] = currentTimeStr.split(':');
        editHour.value = h;
        editMinute.value = m;
    }
    
    editModal.classList.add('active');
};

function closeEditModal() {
    editModal.classList.remove('active');
    currentEditId = null;
    currentEditKey = null;
}
btnEditCancel.addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});

btnEditSave.addEventListener('click', () => {
    if (!currentEditId || !currentEditKey) return;
    
    let history = JSON.parse(localStorage.getItem('babyLogHistory')) || [];
    const index = history.findIndex(s => s.date === currentEditId);
    if (index === -1) {
        closeEditModal();
        return;
    }
    
    let h = parseInt(editHour.value) || 0;
    let m = parseInt(editMinute.value) || 0;
    h = Math.max(0, Math.min(23, h));
    m = Math.max(0, Math.min(59, m));
    const newTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    
    let session = history[index];
    
    if (currentEditKey === 'left') {
        session.left.startTime = newTime;
        let mins = parseInt(editDuration.value) || 0;
        session.left.durationSeconds = Math.max(0, mins) * 60;
    } else if (currentEditKey === 'right') {
        session.right.startTime = newTime;
        let mins = parseInt(editDuration.value) || 0;
        session.right.durationSeconds = Math.max(0, mins) * 60;
    } else if (currentEditKey === 'diaper') {
        session.diapers = newTime;
    }
    
    history[index] = session;
    localStorage.setItem('babyLogHistory', JSON.stringify(history));
    renderHistory();
    closeEditModal();
});

// --- Time Modal Logic ---
const timeModal = document.getElementById('time-modal');
const modalHour = document.getElementById('modal-hour');
const modalMinute = document.getElementById('modal-minute');
const modalSave = document.getElementById('modal-save');
const modalCancel = document.getElementById('modal-cancel');
let currentTargetId = null;

// Open modal
document.querySelectorAll('.time-clickable').forEach(el => {
    el.addEventListener('click', () => {
        currentTargetId = el.getAttribute('data-target');
        const currentVal = document.getElementById(currentTargetId).textContent;
        
        if (currentVal !== '--:--') {
            const [h, m] = currentVal.split(':');
            modalHour.value = h;
            modalMinute.value = m;
        } else {
            const now = new Date();
            modalHour.value = now.getHours().toString().padStart(2, '0');
            modalMinute.value = now.getMinutes().toString().padStart(2, '0');
        }
        
        timeModal.classList.add('active');
    });
});

// Close modal
function closeModal() {
    timeModal.classList.remove('active');
    currentTargetId = null;
}
modalCancel.addEventListener('click', closeModal);
timeModal.addEventListener('click', (e) => {
    if (e.target === timeModal) closeModal();
});

// Save modal
modalSave.addEventListener('click', () => {
    if (currentTargetId) {
        let h = parseInt(modalHour.value) || 0;
        let m = parseInt(modalMinute.value) || 0;
        
        // Boundaries
        h = Math.max(0, Math.min(23, h));
        m = Math.max(0, Math.min(59, m));
        
        const formattedH = h.toString().padStart(2, '0');
        const formattedM = m.toString().padStart(2, '0');
        
        const targetEl = document.getElementById(currentTargetId);
        targetEl.textContent = `${formattedH}:${formattedM}`;
        
        // If left/right changed and lastFeedingStartTime is null, we can optionally set it.
        // But for simplicity, we just update the text content. 
        if (currentTargetId === 'hour-left' || currentTargetId === 'hour-right' || currentTargetId === 'time-diaper') {
            // Update the next feeding time calculation if this is the first breast time set
            if (!lastFeedingStartTime) {
                const now = new Date();
                now.setHours(h, m, 0, 0);
                lastFeedingStartTime = now;
                countdownBaseTime = now;
                updateNextFeedingTime();
            }
        }
    }
    closeModal();
});
