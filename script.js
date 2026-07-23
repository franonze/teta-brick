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

const nextFeedingHours = document.getElementById('next-feeding-hours');
const nextFeedingMinutes = document.getElementById('next-feeding-minutes');
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
    const hStr = nextFeedingHours.value;
    const mStr = nextFeedingMinutes.value;
    const h = hStr !== '' ? parseFloat(hStr) : 4;
    const m = mStr !== '' ? parseFloat(mStr) : 0;
    const totalHours = h + (m / 60);

    if (countdownBaseTime && !isNaN(totalHours)) {
        nextFeedingDate = new Date(countdownBaseTime.getTime() + totalHours * 60 * 60 * 1000);
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
nextFeedingHours.addEventListener('input', updateNextFeedingTime);
nextFeedingMinutes.addEventListener('input', updateNextFeedingTime);

const btnRegistrar = document.getElementById('btn-registrar');

// Diaper Action
btnDiaper.addEventListener('click', () => {
    const now = new Date();
    timeDiaper.textContent = formatHHMM(now);
});

const MERGE_WINDOW_MINUTES = 60;
let pendingSessionData = null;

const mergeModal = document.getElementById('merge-modal');
const btnMergeConfirm = document.getElementById('merge-confirm');
const btnMergeCancel = document.getElementById('merge-cancel');

function closeMergeModal() {
    mergeModal.classList.remove('active');
}

btnMergeCancel.addEventListener('click', () => {
    if (pendingSessionData) {
        saveAndResetSession(pendingSessionData, false);
        pendingSessionData = null;
    }
    closeMergeModal();
});

btnMergeConfirm.addEventListener('click', () => {
    if (pendingSessionData) {
        saveAndResetSession(pendingSessionData, true);
        pendingSessionData = null;
    }
    closeMergeModal();
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

    const history = JSON.parse(localStorage.getItem('babyLogHistory')) || [];
    
    if (history.length > 0) {
        const lastRecord = history[history.length - 1];
        const lastRecordDate = new Date(lastRecord.date);
        const now = new Date();
        const diffMinutes = (now - lastRecordDate) / (1000 * 60);

        if (diffMinutes <= MERGE_WINDOW_MINUTES) {
            pendingSessionData = sessionData;
            mergeModal.classList.add('active');
            return; // Wait for user decision
        }
    }

    saveAndResetSession(sessionData, false);
});

function saveAndResetSession(sessionData, merge) {
    const history = JSON.parse(localStorage.getItem('babyLogHistory')) || [];
    
    if (merge && history.length > 0) {
        let lastRecord = history[history.length - 1];
        
        if (sessionData.left.durationSeconds > 0) {
            lastRecord.left.durationSeconds = (lastRecord.left.durationSeconds || 0) + sessionData.left.durationSeconds;
            if (!lastRecord.left.startTime && sessionData.left.startTime) {
                lastRecord.left.startTime = sessionData.left.startTime;
            }
        }
        
        if (sessionData.right.durationSeconds > 0) {
            lastRecord.right.durationSeconds = (lastRecord.right.durationSeconds || 0) + sessionData.right.durationSeconds;
            if (!lastRecord.right.startTime && sessionData.right.startTime) {
                lastRecord.right.startTime = sessionData.right.startTime;
            }
        }
        
        if (sessionData.diapers) {
            lastRecord.diapers = sessionData.diapers;
        }
        
        history[history.length - 1] = lastRecord;
    } else {
        history.push(sessionData);
    }
    
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
}

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
const historyContainer = document.getElementById('history-container');

function formatDate(dateString) {
    const d = new Date(dateString);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Check if it's today
    const today = new Date();
    if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
        return 'Hoy, ' + d.getDate() + ' ' + months[d.getMonth()];
    }
    
    return d.getDate() + ' ' + months[d.getMonth()];
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('babyLogHistory')) || [];
    historyContainer.innerHTML = '';
    
    if (history.length === 0) {
        historyContainer.innerHTML = '<div class="empty-state">No hay registros guardados.</div>';
        return;
    }

    // Group by day string
    const daysMap = {};
    history.forEach(session => {
        const d = new Date(session.date);
        const dayKey = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
        if (!daysMap[dayKey]) {
            daysMap[dayKey] = {
                date: session.date, // keep one for sorting
                sessions: [],
                totalFeedings: 0,
                totalDiapers: 0
            };
        }
        daysMap[dayKey].sessions.push(session);
        
        // Count totals
        let isFeeding = false;
        if (session.left && session.left.startTime) isFeeding = true;
        if (session.right && session.right.startTime) isFeeding = true;
        if (isFeeding) daysMap[dayKey].totalFeedings++;
        
        if (session.diapers) daysMap[dayKey].totalDiapers++;
    });

    const sortedDays = Object.values(daysMap).sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedDays.forEach((dayData, dayIndex) => {
        const dateDisplay = formatDate(dayData.date);
        
        // Sort sessions inside the day
        dayData.sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Build the HTML for the day
        let dayHtml = `
            <div class="daily-group glass-card" style="padding: 15px; margin-bottom: 15px;">
                <div class="daily-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleDay('day-${dayIndex}')">
                    <div style="font-size: 1.1rem; font-weight: 600;">${dateDisplay}</div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="display: flex; align-items: center; gap: 5px; color: var(--text-secondary); font-weight: 600;">
                            <span style="font-size: 1.2rem;">🍼</span> ${dayData.totalFeedings}
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; color: var(--text-secondary); font-weight: 600;">
                            <span style="font-size: 1.2rem;">💩</span> ${dayData.totalDiapers}
                        </div>
                        <svg id="icon-day-${dayIndex}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.3s; ${dayIndex === 0 ? 'transform: rotate(180deg);' : ''}">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </div>
                <div id="day-${dayIndex}" style="display: ${dayIndex === 0 ? 'flex' : 'none'}; flex-direction: column; gap: 10px; margin-top: 15px; border-top: 1px solid var(--card-border); padding-top: 15px;">
        `;
        
        dayData.sessions.forEach(session => {
            const sid = session.date;
            const sessionEvents = [];
            
            // Left feeding
            if (session.left && session.left.startTime) {
                sessionEvents.push({
                    id: sid, key: 'left', timeStr: session.left.startTime, type: 'Toma Izquierda', desc: `${Math.round(session.left.durationSeconds / 60)}min`, icon: '🍼'
                });
            }
            // Right feeding
            if (session.right && session.right.startTime) {
                sessionEvents.push({
                    id: sid, key: 'right', timeStr: session.right.startTime, type: 'Toma Derecha', desc: `${Math.round(session.right.durationSeconds / 60)}min`, icon: '🍼'
                });
            }
            // Diaper
            if (session.diapers) {
                let diaperTime = typeof session.diapers === 'string' ? session.diapers : (session.diapers.poop || session.diapers.pee);
                if (diaperTime) {
                    sessionEvents.push({ id: sid, key: 'diaper', timeStr: diaperTime, type: 'Cambio de pañal', desc: '', icon: '💩' });
                }
            }
            
            if (sessionEvents.length === 0) return;
            sessionEvents.sort((a, b) => b.timeStr.localeCompare(a.timeStr));

            let sessionHtml = `<div class="history-item" style="flex-direction: column; align-items: stretch; gap: 0; background: rgba(0,0,0,0.2); border: none;">`;
            
            sessionEvents.forEach((ev, idx) => {
                const borderTop = idx > 0 ? `border-top: 1px solid rgba(255,255,255,0.05); margin-top: 12px; padding-top: 12px;` : '';
                sessionHtml += `
                    <div style="display: flex; align-items: center; gap: 16px; ${borderTop}">
                        <div class="history-time">${ev.timeStr}</div>
                        <div class="history-content">
                            <div class="history-title"><span>${ev.icon}</span> ${ev.type}</div>
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
            dayHtml += sessionHtml;
        });
        
        dayHtml += `</div></div>`;
        historyContainer.insertAdjacentHTML('beforeend', dayHtml);
    });
}

window.toggleDay = function(dayId) {
    const el = document.getElementById(dayId);
    const icon = document.getElementById('icon-' + dayId);
    if (el.style.display === 'none') {
        el.style.display = 'flex';
        icon.style.transform = 'rotate(180deg)';
    } else {
        el.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
};



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
