// Register Service Worker for push notifications
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW error', err));
}

// Initialize Capacitor Plugins lazily
function getCap() { return window.Capacitor; }
function isNative() {
    const c = getCap();
    if (!c) return false;
    if (typeof c.isNativePlatform === 'function' && c.isNativePlatform()) return true;
    if (c.isNative === true) return true;
    if (typeof c.getPlatform === 'function' && c.getPlatform() !== 'web') return true;
    if (c.platform && c.platform !== 'web') return true;
    return !!(c.Plugins && (c.Plugins.SystemAlarmPlugin || c.Plugins.LocalNotifications));
}
function getSysAlarm() {
    const c = getCap();
    if (!c) return null;
    if (c.Plugins && c.Plugins.SystemAlarmPlugin) return c.Plugins.SystemAlarmPlugin;
    return c.registerPlugin ? c.registerPlugin('SystemAlarmPlugin') : null;
}
function getLocalNotif() {
    const c = getCap();
    if (!c) return null;
    if (c.Plugins && c.Plugins.LocalNotifications) return c.Plugins.LocalNotifications;
    return c.registerPlugin ? c.registerPlugin('LocalNotifications') : null;
}

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

function getDiffSeconds(timeStr) {
    if (timeStr === '--:--') return 0;
    const now = new Date();
    const [h, m] = timeStr.split(':').map(Number);
    const manualDate = new Date();
    manualDate.setHours(h, m, 0, 0);

    let diffSeconds = Math.floor((now.getTime() - manualDate.getTime()) / 1000);
    if (diffSeconds < -12 * 3600) diffSeconds += 24 * 3600;
    else if (diffSeconds > 12 * 3600) diffSeconds -= 24 * 3600;

    return diffSeconds;
}

// State
let leftTimerInterval = null;
let leftSeconds = 0;
let leftStartMillis = null;
let rightTimerInterval = null;
let rightSeconds = 0;
let rightStartMillis = null;
let lastFeedingStartTime = null; // Stores the Date of the last play press
let countdownBaseTime = null; // Used for next feeding timer so it persists across sessions
let currentNotifId = 1;

let bottleMl = 0;
let isBottlePlaying = false;

const MIN_SECONDS_TO_KEEP = CONFIG.app.minSecondsToKeepTimer;

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
let audioUnlocked = false;

// Trick to unlock audio on mobile browsers (Safari/Chrome)
async function unlockAudioContext() {
    if (audioUnlocked) return;

    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Play a silent oscillator
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(0);
    osc.stop(0.1);

    audioUnlocked = true;

    // Solicitar permiso para notificaciones si aún no se ha preguntado
    if (isNative()) {
        const localNotif = getLocalNotif();
        if (localNotif) {
            try {
                await localNotif.requestPermissions();
                await localNotif.createChannel({
                    id: 'default',
                    name: 'Notificaciones Predeterminadas',
                    description: 'Canal principal para notificaciones de la app',
                    importance: 4,
                    visibility: 1
                });
            } catch (e) {
                console.error('Error creating notification channel/permissions:', e);
            }
        }
    } else if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

document.addEventListener('touchstart', unlockAudioContext, { once: true });
document.addEventListener('click', unlockAudioContext, { once: true });

function saveCurrentState() {
    const state = {
        leftSeconds,
        leftStartMillis: leftTimerInterval ? leftStartMillis : null,
        rightSeconds,
        rightStartMillis: rightTimerInterval ? rightStartMillis : null,
        hourLeft: hourLeft.textContent,
        hourRight: hourRight.textContent,
        timeDiaper: timeDiaper.textContent,
        lastFeedingStartTime: lastFeedingStartTime ? lastFeedingStartTime.getTime() : null,
        countdownBaseTime: countdownBaseTime ? countdownBaseTime.getTime() : null,
        currentNotifId: currentNotifId,
        nextFeedingHours: nextFeedingHours.value,
        nextFeedingMinutes: nextFeedingMinutes.value,
        leftHighlight: btnLeft.classList.contains('highlight-next'),
        rightHighlight: btnRight.classList.contains('highlight-next'),
        bottleMl: document.getElementById('ml-bottle').textContent,
        hourBottle: document.getElementById('hour-bottle').textContent
    };
    localStorage.setItem(CONFIG.storage.stateKey, JSON.stringify(state));
}

function loadCurrentState() {
    const saved = localStorage.getItem(CONFIG.storage.stateKey);
    if (!saved) return;

    try {
        const state = JSON.parse(saved);

        leftSeconds = state.leftSeconds || 0;
        rightSeconds = state.rightSeconds || 0;

        if (state.hourLeft) hourLeft.textContent = state.hourLeft;
        if (state.hourRight) hourRight.textContent = state.hourRight;
        if (state.timeDiaper) timeDiaper.textContent = state.timeDiaper;
        if (state.hourBottle) document.getElementById('hour-bottle').textContent = state.hourBottle;

        if (state.bottleMl !== undefined && state.bottleMl !== '--') {
            bottleMl = parseInt(state.bottleMl) || 0;
            document.getElementById('ml-bottle').textContent = state.bottleMl;
        }

        if (state.lastFeedingStartTime) lastFeedingStartTime = new Date(state.lastFeedingStartTime);
        if (state.countdownBaseTime) countdownBaseTime = new Date(state.countdownBaseTime);
        if (state.currentNotifId) currentNotifId = state.currentNotifId;

        if (state.nextFeedingHours !== undefined) nextFeedingHours.value = state.nextFeedingHours;
        else nextFeedingHours.value = CONFIG.app.defaultNextFeedingHours;
        if (state.nextFeedingMinutes !== undefined) nextFeedingMinutes.value = state.nextFeedingMinutes;

        if (state.leftHighlight) btnLeft.classList.add('highlight-next');
        else btnLeft.classList.remove('highlight-next');

        if (state.rightHighlight) btnRight.classList.add('highlight-next');
        else btnRight.classList.remove('highlight-next');

        if (state.leftStartMillis) {
            btnLeft.innerHTML = svgPause;
            leftStartMillis = state.leftStartMillis;
            leftTimerInterval = setInterval(() => {
                leftSeconds = Math.floor((Date.now() - leftStartMillis) / 1000);
                timeLeft.textContent = formatTime(leftSeconds);
                saveCurrentState();
            }, 1000);
        } else {
            timeLeft.textContent = formatTime(leftSeconds);
        }

        if (state.rightStartMillis) {
            btnRight.innerHTML = svgPause;
            rightStartMillis = state.rightStartMillis;
            rightTimerInterval = setInterval(() => {
                rightSeconds = Math.floor((Date.now() - rightStartMillis) / 1000);
                timeRight.textContent = formatTime(rightSeconds);
                saveCurrentState();
            }, 1000);
        } else {
            timeRight.textContent = formatTime(rightSeconds);
        }

        updateNextFeedingTime();
    } catch (e) {
        console.error("Failed to parse saved state", e);
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCurrentState();
});
window.addEventListener('beforeunload', saveCurrentState);

// Future time checker loop
setInterval(() => {
    if (hourLeft.textContent !== '--:--') {
        const diff = getDiffSeconds(hourLeft.textContent);
        if (diff < 0) {
            hourLeft.parentElement.classList.add('future-time');
            if (!leftTimerInterval && leftSeconds <= 0) timeLeft.textContent = '00:00';
        } else {
            hourLeft.parentElement.classList.remove('future-time');
        }
    } else {
        hourLeft.parentElement.classList.remove('future-time');
    }

    if (hourRight.textContent !== '--:--') {
        const diff = getDiffSeconds(hourRight.textContent);
        if (diff < 0) {
            hourRight.parentElement.classList.add('future-time');
            if (!rightTimerInterval && rightSeconds <= 0) timeRight.textContent = '00:00';
        } else {
            hourRight.parentElement.classList.remove('future-time');
        }
    } else {
        hourRight.parentElement.classList.remove('future-time');
    }

    const hourBottle = document.getElementById('hour-bottle');
    if (hourBottle && hourBottle.textContent !== '--:--') {
        const diff = getDiffSeconds(hourBottle.textContent);
        if (diff < 0) {
            hourBottle.parentElement.classList.add('future-time');
        } else {
            hourBottle.parentElement.classList.remove('future-time');
        }
    } else if (hourBottle) {
        hourBottle.parentElement.classList.remove('future-time');
    }
}, 1000);

function playAlarmBeep() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const playBeep = (timeOffset) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(CONFIG.alarm.frequencyHz, audioCtx.currentTime + timeOffset);

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

    alarmTriggered = true;
    nextFeedingTime.classList.add('alarm-ringing');

    let playedNativeSound = false;

    if (isNative()) {
        const sysAlarm = getSysAlarm();
        if (sysAlarm) {
            try {
                sysAlarm.playAlarmSound();
                playedNativeSound = true;
                alarmInterval = setInterval(() => { }, 1000);
            } catch (e) {
                console.error('Failed to play native sound', e);
            }
        }
    }

    if (!playedNativeSound) {
        playAlarmBeep();
        alarmInterval = setInterval(playAlarmBeep, CONFIG.alarm.repeatIntervalMs);
    }
    if (isNative()) {
        const localNotif = getLocalNotif();
        if (localNotif) {
            // Forzamos la notificación inmediata en caso de que la programada haya fallado o estemos en primer plano
            localNotif.schedule({
                notifications: [
                    {
                        title: getTranslation('notif_time_title'),
                        body: getTranslation('notif_time_body'),
                        id: currentNotifId + 10000,
                        channelId: 'default'
                    }
                ]
            }).catch(e => console.error("Error triggering immediate notif:", e));
        }
    } else if ('Notification' in window && Notification.permission === 'granted') {
        if (navigator.serviceWorker) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(getTranslation('notif_time_title'), {
                    body: getTranslation('notif_time_body')
                });
            }).catch(() => {
                new Notification(getTranslation('notif_time_title'), { body: getTranslation('notif_time_body') });
            });
        } else {
            new Notification(getTranslation('notif_time_title'), { body: getTranslation('notif_time_body') });
        }
    }
}

function stopAlarm() {
    alarmTriggered = false;
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }

    if (isNative()) {
        const sysAlarm = getSysAlarm();
        if (sysAlarm) {
            sysAlarm.stopAlarmSound();
        }
        const localNotif = getLocalNotif();
        if (localNotif) {
            localNotif.cancel({ notifications: [{ id: currentNotifId }] }).catch(console.error);
        }
    }

    nextFeedingTime.classList.remove('alarm-ringing');
}

// Detener la alarma tocando el temporizador
nextFeedingTime.addEventListener('click', stopAlarm);

function updateNextFeedingTime() {
    const hStr = nextFeedingHours.value;
    const mStr = nextFeedingMinutes.value;
    const h = hStr !== '' ? parseFloat(hStr) : CONFIG.app.defaultNextFeedingHours;
    const m = mStr !== '' ? parseFloat(mStr) : 0;
    const totalHours = h + (m / 60);

    if (countdownBaseTime && !isNaN(totalHours)) {
        nextFeedingDate = new Date(countdownBaseTime.getTime() + totalHours * 60 * 60 * 1000);
        if (!countdownInterval) {
            countdownInterval = setInterval(renderCountdown, 1000);
        }

        if (isNative()) {
            const sysAlarm = getSysAlarm();
            if (sysAlarm) {
                sysAlarm.checkExactAlarmPermission().catch(e => console.error('Error checking alarm permission:', e));
            }

            const localNotif = getLocalNotif();
            if (localNotif) {
                currentNotifId = Math.floor(Math.random() * 1000000) + 1;
                saveCurrentState(); // Guardamos el nuevo ID para poder cancelarlo si cerramos la app

                localNotif.createChannel({ id: 'default', name: 'Default', importance: 4, visibility: 1 })
                    .then(() => {
                        if (nextFeedingDate.getTime() <= Date.now()) {
                            // Solo mostramos alerta para que el usuario sepa que está intentando probar una alarma en el pasado
                            // console.log("La alarma está en el pasado");
                        }
                        return localNotif.schedule({
                            notifications: [
                                {
                                    title: getTranslation('notif_time_title'),
                                    body: getTranslation('notif_time_body'),
                                    id: currentNotifId,
                                    schedule: { at: nextFeedingDate, allowWhileIdle: true },
                                    channelId: 'default'
                                }
                            ]
                        });
                    })
                    .then(() => {
                        // Solo mostramos alerta en desarrollo para diagnosticar
                        // alert("Alarma real programada para: " + nextFeedingDate.toLocaleTimeString());
                    }).catch(e => console.error('Error scheduling local notification:', e));
            }
        }

        renderCountdown();
    } else {
        nextFeedingDate = null;
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        if (isNative()) {
            const localNotif = getLocalNotif();
            if (localNotif) {
                localNotif.cancel({ notifications: [{ id: currentNotifId }] }).catch(e => console.error(e));
            }
        }

        nextFeedingTime.textContent = '--:--';
    }
    saveCurrentState();
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

    const totalSeconds = diff <= 0 ? 0 : Math.floor(diff / 1000);
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    nextFeedingTime.textContent = `${h}:${m}:${s}`;
}

function pauseLeftTimer(isSwap = false) {
    if (leftTimerInterval) {
        clearInterval(leftTimerInterval);
        leftTimerInterval = null;
        btnLeft.innerHTML = svgPlay;

        if (!isSwap && leftSeconds >= 0 && leftSeconds < MIN_SECONDS_TO_KEEP) {
            leftSeconds = 0;
            timeLeft.textContent = '00:00';
            hourLeft.textContent = '--:--';
        }
        saveCurrentState();
    }
}

function pauseRightTimer(isSwap = false) {
    if (rightTimerInterval) {
        clearInterval(rightTimerInterval);
        rightTimerInterval = null;
        btnRight.innerHTML = svgPlay;

        if (!isSwap && rightSeconds >= 0 && rightSeconds < MIN_SECONDS_TO_KEEP) {
            rightSeconds = 0;
            timeRight.textContent = '00:00';
            hourRight.textContent = '--:--';
        }
        saveCurrentState();
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

        const hr = document.getElementById('hour-right').textContent;
        const hb = document.getElementById('hour-bottle');
        const hbText = hb ? hb.textContent : '--:--';
        if (hourLeft.textContent === '--:--' && hr === '--:--' && hbText === '--:--') {
            lastFeedingStartTime = null;
        }

        const now = new Date();
        if (hourLeft.textContent === '--:--') {
            hourLeft.textContent = formatHHMM(now);
            if (!lastFeedingStartTime) {
                lastFeedingStartTime = now;
                countdownBaseTime = now;
            }
        } else if (leftSeconds <= 0) {
            leftSeconds = getDiffSeconds(hourLeft.textContent);

            if (!lastFeedingStartTime) {
                const [h, m] = hourLeft.textContent.split(':');
                const manualDate = new Date();
                manualDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
                lastFeedingStartTime = manualDate;
                countdownBaseTime = manualDate;
            }
        } else {
            if (!lastFeedingStartTime) {
                lastFeedingStartTime = now;
                countdownBaseTime = now;
            }
        }

        updateNextFeedingTime(); // Update calculation based on new start time

        btnLeft.innerHTML = svgPause;
        leftStartMillis = Date.now() - leftSeconds * 1000;
        leftTimerInterval = setInterval(() => {
            leftSeconds = Math.floor((Date.now() - leftStartMillis) / 1000);
            timeLeft.textContent = leftSeconds < 0 ? '00:00' : formatTime(leftSeconds);
            saveCurrentState();
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

        const hl = document.getElementById('hour-left').textContent;
        const hb = document.getElementById('hour-bottle');
        const hbText = hb ? hb.textContent : '--:--';
        if (hl === '--:--' && hourRight.textContent === '--:--' && hbText === '--:--') {
            lastFeedingStartTime = null;
        }

        const now = new Date();
        if (hourRight.textContent === '--:--') {
            hourRight.textContent = formatHHMM(now);
            if (!lastFeedingStartTime) {
                lastFeedingStartTime = now;
                countdownBaseTime = now;
            }
        } else if (rightSeconds <= 0) {
            rightSeconds = getDiffSeconds(hourRight.textContent);

            if (!lastFeedingStartTime) {
                const [h, m] = hourRight.textContent.split(':');
                const manualDate = new Date();
                manualDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
                lastFeedingStartTime = manualDate;
                countdownBaseTime = manualDate;
            }
        } else {
            if (!lastFeedingStartTime) {
                lastFeedingStartTime = now;
                countdownBaseTime = now;
            }
        }

        updateNextFeedingTime(); // Update calculation based on new start time

        btnRight.innerHTML = svgPause;
        rightStartMillis = Date.now() - rightSeconds * 1000;
        rightTimerInterval = setInterval(() => {
            rightSeconds = Math.floor((Date.now() - rightStartMillis) / 1000);
            timeRight.textContent = rightSeconds < 0 ? '00:00' : formatTime(rightSeconds);
            saveCurrentState();
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

    const hr = document.getElementById('hour-right').textContent;
    const hb = document.getElementById('hour-bottle');
    const hbText = hb ? hb.textContent : '--:--';
    if (hr === '--:--' && hbText === '--:--') {
        lastFeedingStartTime = null;
    }

    saveCurrentState();
});

const btnResetRight = document.getElementById('btn-reset-right');
btnResetRight.addEventListener('click', () => {
    pauseRightTimer();
    rightSeconds = 0;
    timeRight.textContent = '00:00';
    hourRight.textContent = '--:--';

    const hl = document.getElementById('hour-left').textContent;
    const hb = document.getElementById('hour-bottle');
    const hbText = hb ? hb.textContent : '--:--';
    if (hl === '--:--' && hbText === '--:--') {
        lastFeedingStartTime = null;
    }

    saveCurrentState();
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

    timeLeft.textContent = leftSeconds < 0 ? '00:00' : formatTime(leftSeconds);
    timeRight.textContent = rightSeconds < 0 ? '00:00' : formatTime(rightSeconds);

    // Swap hours
    const tempHour = hourLeft.textContent;
    hourLeft.textContent = hourRight.textContent;
    hourRight.textContent = tempHour;

    // Resume appropriately
    if (leftWasPlaying) {
        btnRight.innerHTML = svgPause;
        rightStartMillis = Date.now() - rightSeconds * 1000;
        rightTimerInterval = setInterval(() => {
            rightSeconds = Math.floor((Date.now() - rightStartMillis) / 1000);
            timeRight.textContent = rightSeconds < 0 ? '00:00' : formatTime(rightSeconds);
            saveCurrentState();
        }, 1000);
    } else if (rightWasPlaying) {
        btnLeft.innerHTML = svgPause;
        leftStartMillis = Date.now() - leftSeconds * 1000;
        leftTimerInterval = setInterval(() => {
            leftSeconds = Math.floor((Date.now() - leftStartMillis) / 1000);
            timeLeft.textContent = leftSeconds < 0 ? '00:00' : formatTime(leftSeconds);
            saveCurrentState();
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
    saveCurrentState();
});

// --- Bottle Logic ---
const btnBottle = document.getElementById('btn-bottle');
const mlBottle = document.getElementById('ml-bottle');
const hourBottle = document.getElementById('hour-bottle');

const mlModal = document.getElementById('ml-modal');
const modalMlInput = document.getElementById('modal-ml-input');
const mlCancel = document.getElementById('ml-cancel');
const mlSave = document.getElementById('ml-save');

modalMlInput.addEventListener('focus', function () { this.select(); });

function openMlModal() {
    modalMlInput.value = bottleMl > 0 ? bottleMl : '';
    mlModal.classList.add('active');
}

btnBottle.addEventListener('click', () => {
    if (isBottlePlaying) {
        openMlModal();
    } else {
        pauseLeftTimer();
        pauseRightTimer();

        const hl = document.getElementById('hour-left').textContent;
        const hr = document.getElementById('hour-right').textContent;
        if (hl === '--:--' && hr === '--:--' && hourBottle.textContent === '--:--') {
            lastFeedingStartTime = null;
        }

        const now = new Date();
        if (hourBottle.textContent === '--:--') {
            hourBottle.textContent = formatHHMM(now);
            if (!lastFeedingStartTime) {
                lastFeedingStartTime = now;
                countdownBaseTime = now;
            }
        }

        if (!lastFeedingStartTime) {
            const [h, m] = hourBottle.textContent.split(':');
            const manualDate = new Date();
            manualDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
            lastFeedingStartTime = manualDate;
            countdownBaseTime = manualDate;
        }

        updateNextFeedingTime();

        btnBottle.innerHTML = svgPause;
        isBottlePlaying = true;
        saveCurrentState();
    }
});

mlCancel.addEventListener('click', () => {
    mlModal.classList.remove('active');
    if (isBottlePlaying) {
        btnBottle.innerHTML = svgPlay;
        isBottlePlaying = false;
        saveCurrentState();
    }
});

mlSave.addEventListener('click', () => {
    const val = parseInt(modalMlInput.value);
    if (!isNaN(val) && val > 0) {
        bottleMl = val;
        mlBottle.textContent = bottleMl;
    } else {
        bottleMl = 0;
        mlBottle.textContent = '--';
    }

    btnBottle.innerHTML = svgPlay;
    isBottlePlaying = false;

    mlModal.classList.remove('active');
    saveCurrentState();
});

mlModal.addEventListener('click', (e) => {
    if (e.target === mlModal) {
        mlCancel.click();
    }
});

// Next feeding input logic
nextFeedingHours.addEventListener('input', updateNextFeedingTime);
nextFeedingMinutes.addEventListener('input', updateNextFeedingTime);
nextFeedingHours.addEventListener('focus', function () { this.select(); });
nextFeedingMinutes.addEventListener('focus', function () { this.select(); });

const btnRegistrar = document.getElementById('btn-registrar');

// Diaper Action
btnDiaper.addEventListener('click', () => {
    const now = new Date();
    timeDiaper.textContent = formatHHMM(now);
    saveCurrentState();
});

const MERGE_WINDOW_MINUTES = CONFIG.app.mergeWindowMinutes;
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
    let baseDate = new Date();
    
    // Find the earliest start time among active timers to correctly determine the session date
    let earliestTimeStr = '23:59';
    if (hourLeft.textContent !== '--:--' && hourLeft.textContent < earliestTimeStr) earliestTimeStr = hourLeft.textContent;
    if (hourRight.textContent !== '--:--' && hourRight.textContent < earliestTimeStr) earliestTimeStr = hourRight.textContent;
    const hbEl = document.getElementById('hour-bottle');
    if (hbEl && hbEl.textContent !== '--:--' && hbEl.textContent < earliestTimeStr) earliestTimeStr = hbEl.textContent;

    if (earliestTimeStr !== '23:59') {
        const [eh] = earliestTimeStr.split(':').map(Number);
        const currH = baseDate.getHours();
        // If the earliest start time is > 12 hours ahead of the current time (e.g. 23 > 0 + 12), it started yesterday
        if (eh > currH + 12) {
            baseDate.setDate(baseDate.getDate() - 1);
        }
    }

    // 1. Gather current state
    const sessionData = {
        date: baseDate.toISOString(),
        left: {
            durationSeconds: leftSeconds,
            startTime: hourLeft.textContent !== '--:--' ? hourLeft.textContent : null
        },
        right: {
            durationSeconds: rightSeconds,
            startTime: hourRight.textContent !== '--:--' ? hourRight.textContent : null
        },
        bottle: {
            ml: bottleMl,
            startTime: hourBottle.textContent !== '--:--' ? hourBottle.textContent : null
        },
        diapers: timeDiaper.textContent !== '--:--' ? timeDiaper.textContent : null
    };

    // Check if there is anything to save
    if (leftSeconds === 0 && rightSeconds === 0 && bottleMl === 0 && !sessionData.diapers) {
        alert('No hay datos activos para registrar.');
        return;
    }

    const history = JSON.parse(localStorage.getItem(CONFIG.storage.historyKey)) || [];

    if (deduplicateHistoryDates(history)) {
        localStorage.setItem(CONFIG.storage.historyKey, JSON.stringify(history));
    }

    if (history.length > 0) {
        const lastRecord = history[history.length - 1];

        // Find earliest start time of last record
        let lastEarliestStr = '23:59';
        if (lastRecord.left && lastRecord.left.startTime && lastRecord.left.startTime < lastEarliestStr) lastEarliestStr = lastRecord.left.startTime;
        if (lastRecord.right && lastRecord.right.startTime && lastRecord.right.startTime < lastEarliestStr) lastEarliestStr = lastRecord.right.startTime;
        if (lastRecord.bottle && lastRecord.bottle.startTime && lastRecord.bottle.startTime < lastEarliestStr) lastEarliestStr = lastRecord.bottle.startTime;

        // Find earliest start time of current session
        let currEarliestStr = '23:59';
        if (sessionData.left.startTime && sessionData.left.startTime < currEarliestStr) currEarliestStr = sessionData.left.startTime;
        if (sessionData.right.startTime && sessionData.right.startTime < currEarliestStr) currEarliestStr = sessionData.right.startTime;
        if (sessionData.bottle.startTime && sessionData.bottle.startTime < currEarliestStr) currEarliestStr = sessionData.bottle.startTime;

        if (lastEarliestStr !== '23:59' && currEarliestStr !== '23:59') {
            const lastDate = new Date(lastRecord.date);
            const [lh, lm] = lastEarliestStr.split(':');
            lastDate.setHours(parseInt(lh, 10), parseInt(lm, 10), 0, 0);

            const currDate = new Date(sessionData.date);
            const [ch, cm] = currEarliestStr.split(':');
            currDate.setHours(parseInt(ch, 10), parseInt(cm, 10), 0, 0);

            const diffMinutes = (currDate - lastDate) / (1000 * 60);

            if (diffMinutes >= 0 && diffMinutes <= MERGE_WINDOW_MINUTES) {
                pendingSessionData = sessionData;
                mergeModal.classList.add('active');
                return; // Wait for user decision
            }
        } else {
            // Fallback if no start times are available
            const lastRecordDate = new Date(lastRecord.date);
            const now = new Date();
            const diffMinutes = (now - lastRecordDate) / (1000 * 60);

            if (diffMinutes >= 0 && diffMinutes <= MERGE_WINDOW_MINUTES) {
                pendingSessionData = sessionData;
                mergeModal.classList.add('active');
                return; // Wait for user decision
            }
        }
    }

    saveAndResetSession(sessionData, false);
});

function saveAndResetSession(sessionData, merge) {
    const history = JSON.parse(localStorage.getItem(CONFIG.storage.historyKey)) || [];

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

        if (sessionData.bottle && sessionData.bottle.ml > 0) {
            lastRecord.bottle = lastRecord.bottle || { ml: 0, startTime: null };
            lastRecord.bottle.ml += sessionData.bottle.ml;
            if (!lastRecord.bottle.startTime && sessionData.bottle.startTime) {
                lastRecord.bottle.startTime = sessionData.bottle.startTime;
            }
        }

        if (sessionData.diapers) {
            lastRecord.diapers = sessionData.diapers;
        }

        history[history.length - 1] = lastRecord;
    } else {
        history.push(sessionData);
    }

    localStorage.setItem(CONFIG.storage.historyKey, JSON.stringify(history));

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

    bottleMl = 0;
    isBottlePlaying = false;
    const btnBottleEl = document.getElementById('btn-bottle');
    if (btnBottleEl) btnBottleEl.innerHTML = svgPlay;

    // Optional: Visual feedback
    timeLeft.textContent = '00:00';
    timeRight.textContent = '00:00';
    hourLeft.textContent = '--:--';
    hourRight.textContent = '--:--';

    const mlBottleEl = document.getElementById('ml-bottle');
    if (mlBottleEl) mlBottleEl.textContent = '--';
    const hourBottleEl = document.getElementById('hour-bottle');
    if (hourBottleEl) hourBottleEl.textContent = '--:--';

    timeDiaper.textContent = '--:--';

    if (merge && history.length > 0) {
        let lastRecord = history[history.length - 1];
        let earliestTime = '23:59';
        if (lastRecord.left && lastRecord.left.startTime && lastRecord.left.startTime < earliestTime) earliestTime = lastRecord.left.startTime;
        if (lastRecord.right && lastRecord.right.startTime && lastRecord.right.startTime < earliestTime) earliestTime = lastRecord.right.startTime;
        if (lastRecord.bottle && lastRecord.bottle.startTime && lastRecord.bottle.startTime < earliestTime) earliestTime = lastRecord.bottle.startTime;

        if (earliestTime !== '23:59') {
            const d = new Date(lastRecord.date);
            const [h, m] = earliestTime.split(':');
            d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
            countdownBaseTime = d;
            updateNextFeedingTime();
        }
    }

    saveCurrentState();

    const originalText = btnRegistrar.textContent;
    btnRegistrar.textContent = getTranslation('registered');
    btnRegistrar.style.backgroundColor = 'var(--accent-primary)';

    setTimeout(() => {
        btnRegistrar.textContent = originalText;
        btnRegistrar.style.backgroundColor = '';
    }, 2000);
}

// Reset next feed logic
const btnResetNext = document.getElementById('btn-reset-next');
if (btnResetNext) {
    btnResetNext.addEventListener('click', () => {
        countdownBaseTime = new Date();
        alarmTriggered = false;
        stopAlarm();
        updateNextFeedingTime();
    });
}

// Stop next feed logic
const btnStopNext = document.getElementById('btn-stop-next');
if (btnStopNext) {
    btnStopNext.addEventListener('click', () => {
        countdownBaseTime = null;
        nextFeedingDate = null;
        alarmTriggered = false;
        stopAlarm();
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        nextFeedingTime.textContent = '--:--';
        saveCurrentState();
    });
}

// --- Navigation Logic ---
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');
        if (!targetId) return;

        // Update active class on nav items
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Show target view

        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetId) {
                view.classList.add('active');
            }
        });

        // Hide shared sections in history
        const sharedSections = document.getElementById('shared-sections');
        if (sharedSections) {
            if (targetId === 'view-historial' || targetId === 'view-ajustes') {
                sharedSections.style.display = 'none';
            } else {
                sharedSections.style.display = 'flex';
            }
        }

        // If history view is opened, render history
        if (targetId === 'view-historial') {
            renderHistory();
        }
    });
});

// --- History Rendering Logic ---
const historyContainer = document.getElementById('history-container');

function deduplicateHistoryDates(history) {
    let dates = new Set();
    let modified = false;
    for (let s of history) {
        while (dates.has(s.date)) {
            let d = new Date(s.date);
            d.setMilliseconds(d.getMilliseconds() + 1);
            s.date = d.toISOString();
            modified = true;
        }
        dates.add(s.date);
    }
    return modified;
}

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
    const history = JSON.parse(localStorage.getItem(CONFIG.storage.historyKey)) || [];
    historyContainer.innerHTML = '';

    if (history.length === 0) {
        historyContainer.innerHTML = `<div class="empty-state">${getTranslation('empty_history')}</div>`;
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
        if (session.bottle && session.bottle.startTime) isFeeding = true;
        if (isFeeding) daysMap[dayKey].totalFeedings++;

        if (session.diapers) daysMap[dayKey].totalDiapers++;
    });

    const sortedDays = Object.values(daysMap).sort((a, b) => new Date(b.date) - new Date(a.date));

    function getSessionSortTime(session) {
        let latestTime = '';
        if (session.left && session.left.startTime && session.left.startTime > latestTime) latestTime = session.left.startTime;
        if (session.right && session.right.startTime && session.right.startTime > latestTime) latestTime = session.right.startTime;
        if (session.bottle && session.bottle.startTime && session.bottle.startTime > latestTime) latestTime = session.bottle.startTime;
        if (session.diapers) {
            let diaperTime = typeof session.diapers === 'string' ? session.diapers : (session.diapers.poop || session.diapers.pee || session.diapers.time);
            if (diaperTime && diaperTime > latestTime) latestTime = diaperTime;
        }
        return latestTime || '00:00';
    }

    sortedDays.forEach((dayData, dayIndex) => {
        const dateDisplay = formatDate(dayData.date);

        // Sort sessions inside the day by their actual event times
        dayData.sessions.sort((a, b) => getSessionSortTime(b).localeCompare(getSessionSortTime(a)));

        // Build the HTML for the day
        let dayHtml = `
            <div class="daily-group glass-card" style="padding: 15px;">
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
                    id: sid, key: 'left', timeStr: session.left.startTime, type: `${getTranslation('tab_pecho')} ${getTranslation('breast_left')}`, desc: `${Math.round(session.left.durationSeconds / 60)}min`, icon: '🍼', note: session.left.note || ''
                });
            }
            // Right feeding
            if (session.right && session.right.startTime) {
                sessionEvents.push({
                    id: sid, key: 'right', timeStr: session.right.startTime, type: `${getTranslation('tab_pecho')} ${getTranslation('breast_right')}`, desc: `${Math.round(session.right.durationSeconds / 60)}min`, icon: '🍼', note: session.right.note || ''
                });
            }
            // Bottle feeding
            if (session.bottle && session.bottle.startTime) {
                sessionEvents.push({
                    id: sid, key: 'bottle', timeStr: session.bottle.startTime, type: getTranslation('tab_biberon'), desc: `${session.bottle.ml} mL`, icon: '🍼', note: session.bottle.note || ''
                });
            }
            // Diaper
            if (session.diapers) {
                let diaperTime = typeof session.diapers === 'string' ? session.diapers : (session.diapers.poop || session.diapers.pee || session.diapers.time);
                let diaperNote = typeof session.diapers === 'object' ? (session.diapers.note || '') : '';
                if (diaperTime) {
                    sessionEvents.push({ id: sid, key: 'diaper', timeStr: diaperTime, type: getTranslation('diaper_change'), desc: '', icon: '💩', note: diaperNote });
                }
            }

            if (sessionEvents.length === 0) return;
            sessionEvents.sort((a, b) => b.timeStr.localeCompare(a.timeStr));

            let containerPadding = appSettings.compactHistory ? 'padding: 6px 12px;' : '';
            let sessionHtml = `<div class="history-item" style="flex-direction: column; align-items: stretch; gap: 0; ${containerPadding}">`;

            sessionEvents.forEach((ev, idx) => {
                const borderTop = idx > 0 ? (appSettings.compactHistory ? `border-top: 1px solid var(--card-border); margin-top: 6px; padding-top: 6px;` : `border-top: 1px solid var(--card-border); margin-top: 8px; padding-top: 8px;`) : '';

                if (appSettings.compactHistory) {
                    const noteHtml = ev.note ? `<div class="history-note-content" contenteditable="true" onblur="saveInlineNote('${ev.id}', '${ev.key}', this.innerText)" onclick="event.stopPropagation();" style="display: none; width: 100%; margin-top: 8px; padding: 8px 10px; background: rgba(0,0,0,0.05); border-radius: 8px; font-size: 0.9rem; color: var(--text-secondary); white-space: pre-wrap; line-height: 1.3; outline: none; cursor: text;">${ev.note}</div>` : '';
                    const infoBadge = ev.note ? `<div class="info-badge" style="position: absolute; top: -6px; left: -6px; background: rgba(96, 165, 250, 0.85); color: white; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.2); z-index: 10;">i</div>` : '';
                    const toggleClass = ev.note ? 'has-note' : '';
                    const clickHandler = ev.note ? `onclick="const nc = this.querySelector('.history-note-content'); nc.style.display = nc.style.display === 'none' ? 'block' : 'none';"` : '';
                    const cursorStyle = ev.note ? `cursor: pointer;` : '';

                    sessionHtml += `
                        <div class="history-event-row ${toggleClass}" ${clickHandler} style="display: flex; flex-direction: column; width: 100%; ${borderTop} ${cursorStyle}; padding-top: 2px; padding-bottom: 2px;">
                            <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                                <!-- Left Column: Time & Duration -->
                                <div style="position: relative; display: flex; flex-direction: column; align-items: center; min-width: 55px; margin-top: 4px;">
                                    ${infoBadge}
                                    <div class="history-time" style="font-size: 1.1rem; font-weight: 600; line-height: 1.1;">${ev.timeStr}</div>
                                    ${ev.desc ? `<div class="history-desc" style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; margin-top: 2px; line-height: 1.1;">${ev.desc}</div>` : ''}
                                </div>
                                
                                <!-- Right Column: Type & Actions -->
                                <div style="display: flex; align-items: center; justify-content: space-between; flex: 1;">
                                    <div class="history-title" style="font-size: 0.95rem; font-weight: 500; line-height: 1.2;">${ev.type}</div>
                                    <div class="history-actions" style="display: flex; gap: 4px; flex-shrink: 0; align-items: center;">
                                        <span style="font-size: 1.1rem; margin-right: 4px;">${ev.icon}</span>
                                        <button class="action-btn edit-btn" onclick="editEvent('${ev.id}', '${ev.key}'); event.stopPropagation();" title="Editar">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        </button>
                                        <button class="action-btn delete-btn" onclick="deleteEvent('${ev.id}', '${ev.key}'); event.stopPropagation();" title="Borrar">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            ${noteHtml}
                        </div>
                    `;
                } else {
                    const noteValue = ev.note || '';

                    sessionHtml += `
                        <div class="history-event-row" style="display: flex; width: 100%; gap: 12px; align-items: center; ${borderTop}">
                            <!-- Left Column: Time & Duration -->
                            <div style="display: flex; flex-direction: column; align-items: center; min-width: 65px;">
                                <div class="history-time" style="font-size: 1.1rem; font-weight: 600;">${ev.timeStr}</div>
                                ${ev.desc ? `<div class="history-desc" style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; margin-top: 2px;">${ev.desc}</div>` : ''}
                            </div>
                            
                            <!-- Right Column: Type, Actions & Notes -->
                            <div style="display: flex; flex-direction: column; flex: 1;">
                                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                                    <div class="history-title" style="font-size: 0.95rem; font-weight: 500; line-height: 1.2;">${ev.type}</div>
                                    <div class="history-actions" style="display: flex; gap: 4px; flex-shrink: 0; align-items: center;">
                                        <span style="font-size: 1.1rem; margin-right: 4px;">${ev.icon}</span>
                                        <button class="action-btn edit-btn" onclick="editEvent('${ev.id}', '${ev.key}')" title="Editar">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        </button>
                                        <button class="action-btn delete-btn" onclick="deleteEvent('${ev.id}', '${ev.key}')" title="Borrar">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                </div>
                                <div style="margin-top: 6px; font-size: 0.9rem; color: var(--text-secondary); width: 100%;">
                                    <strong>Notas:</strong>
                                    <span contenteditable="true" 
                                          onblur="saveInlineNote('${ev.id}', '${ev.key}', this.innerText)" 
                                          style="outline: none; border-bottom: 1px dashed rgba(0,0,0,0.15); cursor: text; white-space: pre-wrap; break-word: break-word;">${noteValue}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });

            sessionHtml += `</div>`;
            dayHtml += sessionHtml;
        });

        dayHtml += `</div></div>`;
        historyContainer.insertAdjacentHTML('beforeend', dayHtml);
    });
}

window.toggleDay = function (dayId) {
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

function recalculateNextFeedingFromHistory(history) {
    const hourLeftEl = document.getElementById('hour-left');
    const hourRightEl = document.getElementById('hour-right');
    const hourBottleEl = document.getElementById('hour-bottle');
    if (hourLeftEl && hourLeftEl.textContent === '--:--' &&
        hourRightEl && hourRightEl.textContent === '--:--' &&
        hourBottleEl && hourBottleEl.textContent === '--:--') {

        let foundLastFeedingTime = null;
        for (let i = 0; i < history.length; i++) {
            const s = history[i];
            const times = [];
            if (s.left && s.left.startTime) times.push(s.left.startTime);
            if (s.right && s.right.startTime) times.push(s.right.startTime);
            if (s.bottle && s.bottle.startTime) times.push(s.bottle.startTime);
            
            times.forEach(timeStr => {
                const d = new Date(s.date);
                const [h, m] = timeStr.split(':');
                d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
                if (!foundLastFeedingTime || d > foundLastFeedingTime) {
                    foundLastFeedingTime = d;
                }
            });
        }
        if (foundLastFeedingTime) {
            countdownBaseTime = foundLastFeedingTime;
            lastFeedingStartTime = foundLastFeedingTime;
        } else {
            countdownBaseTime = null;
            lastFeedingStartTime = null;
        }
        updateNextFeedingTime();
    }
}

let currentDeleteId = null;
let currentDeleteKey = null;

let currentEditId = null;
let currentEditKey = null;

// Delete Modal Logic
const deleteModal = document.getElementById('delete-modal');
const btnDeleteConfirm = document.getElementById('delete-confirm');
const btnDeleteCancel = document.getElementById('delete-cancel');

window.deleteEvent = function (id, key) {
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

    let history = JSON.parse(localStorage.getItem(CONFIG.storage.historyKey)) || [];
    const index = history.findIndex(s => s.date === currentDeleteId);
    if (index !== -1) {
        if (currentDeleteKey === 'left') {
            history[index].left.startTime = null;
            history[index].left.durationSeconds = 0;
        } else if (currentDeleteKey === 'right') {
            history[index].right.startTime = null;
            history[index].right.durationSeconds = 0;
        } else if (currentDeleteKey === 'bottle') {
            history[index].bottle = null;
        } else if (currentDeleteKey === 'diaper') {
            history[index].diapers = null;
        }

        // If session is completely empty, remove it entirely
        if (!history[index].left?.startTime && !history[index].right?.startTime && !history[index].bottle?.startTime && !history[index].diapers) {
            history.splice(index, 1);
        }

        localStorage.setItem(CONFIG.storage.historyKey, JSON.stringify(history));

        // Recalculate next feeding time from previous history record if no active feeding is ongoing
        recalculateNextFeedingFromHistory(history);

        renderHistory();
    }
    closeDeleteModal();
});

// Edit Modal Logic
const editModal = document.getElementById('edit-modal');
const editDate = document.getElementById('edit-date');
const editHour = document.getElementById('edit-hour');
const editMinute = document.getElementById('edit-minute');
const editDurationContainer = document.getElementById('edit-duration-container');
const editDuration = document.getElementById('edit-duration');
const btnEditSave = document.getElementById('edit-save');
const btnEditCancel = document.getElementById('edit-cancel');

let isAddingNew = false;

editHour.addEventListener('focus', function () { this.select(); });
editMinute.addEventListener('focus', function () { this.select(); });
editDuration.addEventListener('focus', function () { this.select(); });

const btnAddEvent = document.getElementById('btn-add-event');
const eventType = document.getElementById('event-type');

if (btnAddEvent) {
    btnAddEvent.addEventListener('click', () => {
        isAddingNew = true;
        document.getElementById('modal-title').textContent = "Añadir registro";
        eventType.style.display = 'block';
        eventType.value = 'left';

        if (editDate) {
            editDate.innerHTML = '';
            const todayOnly = new Date();
            todayOnly.setHours(0, 0, 0, 0);

            const prevDate = new Date(todayOnly);
            prevDate.setDate(prevDate.getDate() - 1);

            const currOpt = document.createElement('option');
            currOpt.value = todayOnly.toISOString();
            currOpt.textContent = formatDate(todayOnly.toISOString());
            currOpt.selected = true;
            editDate.appendChild(currOpt);

            const prevOpt = document.createElement('option');
            prevOpt.value = prevDate.toISOString();
            prevOpt.textContent = formatDate(prevDate.toISOString());
            editDate.appendChild(prevOpt);
        }

        const now = new Date();
        editHour.value = now.getHours().toString().padStart(2, '0');
        editMinute.value = now.getMinutes().toString().padStart(2, '0');
        editDuration.value = '';
        const editNote = document.getElementById('edit-note');
        if (editNote) editNote.value = '';

        eventType.dispatchEvent(new Event('change'));
        editModal.classList.add('active');
    });
}

if (eventType) {
    eventType.addEventListener('change', () => {
        const val = eventType.value;
        if (val === 'left' || val === 'right') {
            editDurationContainer.style.display = 'flex';
            document.querySelector('#edit-duration-container .sub-label').textContent = 'Duración (minutos)';
            editDuration.placeholder = 'Min';
        } else if (val === 'bottle') {
            editDurationContainer.style.display = 'flex';
            document.querySelector('#edit-duration-container .sub-label').textContent = 'Cantidad (mL)';
            editDuration.placeholder = 'mL';
        } else if (val === 'diaper') {
            editDurationContainer.style.display = 'none';
        }
    });
}

window.saveInlineNote = function (id, key, newNoteText) {
    let history = JSON.parse(localStorage.getItem(CONFIG.storage.historyKey)) || [];
    const index = history.findIndex(s => s.date === id);
    if (index === -1) return;

    let session = history[index];
    let noteVal = newNoteText.trim();

    if (key === 'left') {
        session.left.note = noteVal;
    } else if (key === 'right') {
        session.right.note = noteVal;
    } else if (key === 'bottle') {
        session.bottle.note = noteVal;
    } else if (key === 'diaper') {
        let oldObj = typeof session.diapers === 'object' ? session.diapers : { time: session.diapers };
        session.diapers = { ...oldObj, note: noteVal };
    }

    history[index] = session;
    localStorage.setItem(CONFIG.storage.historyKey, JSON.stringify(history));
    // No need to re-render, the UI is already showing the new text!
};

window.editEvent = function (id, key) {
    let history = JSON.parse(localStorage.getItem(CONFIG.storage.historyKey)) || [];
    const index = history.findIndex(s => s.date === id);
    if (index === -1) return;

    currentEditId = id;
    currentEditKey = key;
    let session = history[index];
    let currentTimeStr = '';
    const editNote = document.getElementById('edit-note');
    if (editNote) editNote.value = '';

    isAddingNew = false;
    document.getElementById('modal-title').textContent = "Editar registro";
    if (eventType) eventType.style.display = 'none';

    if (editDate) {
        editDate.innerHTML = '';
        const sessionDate = new Date(session.date);
        const today = new Date();

        const sDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isToday = sDateOnly.getTime() === todayOnly.getTime();

        const prevDate = new Date(sDateOnly);
        prevDate.setDate(prevDate.getDate() - 1);

        const nextDate = new Date(sDateOnly);
        nextDate.setDate(nextDate.getDate() + 1);

        if (!isToday) {
            const nextOpt = document.createElement('option');
            nextOpt.value = nextDate.toISOString();
            nextOpt.textContent = formatDate(nextDate.toISOString());
            editDate.appendChild(nextOpt);
        }

        const currOpt = document.createElement('option');
        currOpt.value = sDateOnly.toISOString();
        currOpt.textContent = formatDate(sDateOnly.toISOString());
        currOpt.selected = true;
        editDate.appendChild(currOpt);

        const prevOpt = document.createElement('option');
        prevOpt.value = prevDate.toISOString();
        prevOpt.textContent = formatDate(prevDate.toISOString());
        editDate.appendChild(prevOpt);
    }

    if (key === 'left') {
        currentTimeStr = session.left.startTime;
        editDuration.value = Math.round(session.left.durationSeconds / 60);
        editDurationContainer.style.display = 'flex';
        document.querySelector('#edit-duration-container .sub-label').textContent = 'Duración (minutos)';
        editDuration.placeholder = 'Min';
        if (editNote) editNote.value = session.left.note || '';
    } else if (key === 'right') {
        currentTimeStr = session.right.startTime;
        editDuration.value = Math.round(session.right.durationSeconds / 60);
        editDurationContainer.style.display = 'flex';
        document.querySelector('#edit-duration-container .sub-label').textContent = 'Duración (minutos)';
        editDuration.placeholder = 'Min';
        if (editNote) editNote.value = session.right.note || '';
    } else if (key === 'bottle') {
        currentTimeStr = session.bottle.startTime;
        editDuration.value = session.bottle.ml;
        editDurationContainer.style.display = 'flex';
        document.querySelector('#edit-duration-container .sub-label').textContent = 'Cantidad (mL)';
        editDuration.placeholder = 'mL';
        if (editNote) editNote.value = session.bottle.note || '';
    } else if (key === 'diaper') {
        let diaperTime = null;
        if (typeof session.diapers === 'string') {
            diaperTime = session.diapers;
        } else if (typeof session.diapers === 'object') {
            diaperTime = session.diapers.poop || session.diapers.pee || session.diapers.time;
            if (editNote) editNote.value = session.diapers.note || '';
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
    let history = JSON.parse(localStorage.getItem(CONFIG.storage.historyKey)) || [];
    let h = parseInt(editHour.value) || 0;
    let m = parseInt(editMinute.value) || 0;
    h = Math.max(0, Math.min(23, h));
    m = Math.max(0, Math.min(59, m));
    const newTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    const editNote = document.getElementById('edit-note');
    const noteVal = editNote ? editNote.value.trim() : '';

    if (isAddingNew) {
        const type = eventType ? eventType.value : 'left';
        const selectedDate = editDate && editDate.value ? new Date(editDate.value) : new Date();
        const now = new Date();
        now.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        let newSession = { date: now.toISOString() };

        let mins = parseInt(editDuration.value) || 0;
        if (type === 'left') {
            newSession.left = { startTime: newTime, durationSeconds: mins * 60, note: noteVal };
        } else if (type === 'right') {
            newSession.right = { startTime: newTime, durationSeconds: mins * 60, note: noteVal };
        } else if (type === 'bottle') {
            newSession.bottle = { startTime: newTime, ml: mins, note: noteVal };
        } else if (type === 'diaper') {
            newSession.diapers = { time: newTime, note: noteVal };
        }

        history.push(newSession);
        localStorage.setItem(CONFIG.storage.historyKey, JSON.stringify(history));
        recalculateNextFeedingFromHistory(history);
        renderHistory();
        closeEditModal();
        return;
    }

    if (!currentEditId || !currentEditKey) return;

    const index = history.findIndex(s => s.date === currentEditId);
    if (index === -1) {
        closeEditModal();
        return;
    }

    let session = history[index];

    if (editDate && editDate.value) {
        const d = new Date(session.date);
        const selectedDate = new Date(editDate.value);
        d.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        session.date = d.toISOString();
    }

    if (currentEditKey === 'left') {
        session.left.startTime = newTime;
        let mins = parseInt(editDuration.value) || 0;
        session.left.durationSeconds = Math.max(0, mins) * 60;
        session.left.note = noteVal;
    } else if (currentEditKey === 'right') {
        session.right.startTime = newTime;
        let mins = parseInt(editDuration.value) || 0;
        session.right.durationSeconds = Math.max(0, mins) * 60;
        session.right.note = noteVal;
    } else if (currentEditKey === 'bottle') {
        session.bottle.startTime = newTime;
        let val = parseInt(editDuration.value) || 0;
        session.bottle.ml = Math.max(0, val);
        session.bottle.note = noteVal;
    } else if (currentEditKey === 'diaper') {
        let oldObj = typeof session.diapers === 'object' ? session.diapers : {};
        session.diapers = { ...oldObj, time: newTime, note: noteVal };
    }

    history[index] = session;
    localStorage.setItem(CONFIG.storage.historyKey, JSON.stringify(history));
    recalculateNextFeedingFromHistory(history);
    renderHistory();
    closeEditModal();
});

// --- Time Modal Logic ---
const timeModal = document.getElementById('time-modal');
const modalHour = document.getElementById('modal-hour');
const modalMinute = document.getElementById('modal-minute');
const modalSave = document.getElementById('modal-save');
const modalCancel = document.getElementById('modal-cancel');

modalHour.addEventListener('focus', function () { this.select(); });
modalMinute.addEventListener('focus', function () { this.select(); });
let currentTargetId = null;

// Open modal
document.querySelectorAll('.time-clickable').forEach(el => {
    el.addEventListener('click', () => {
        const targetId = el.getAttribute('data-target');

        if (targetId === 'ml-bottle') {
            openMlModal();
            return;
        }

        currentTargetId = targetId;
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

        if (currentTargetId === 'hour-left' || currentTargetId === 'hour-right' || currentTargetId === 'hour-bottle') {
            const oldTimeStr = targetEl.textContent;
            if (oldTimeStr !== '--:--') {
                const [oldH, oldM] = oldTimeStr.split(':').map(Number);
                let diffMins = (h * 60 + m) - (oldH * 60 + oldM);

                if (diffMins > 12 * 60) diffMins -= 24 * 60;
                else if (diffMins < -12 * 60) diffMins += 24 * 60;

                const diffSeconds = diffMins * 60;

                if (currentTargetId === 'hour-left' && leftSeconds !== 0) {
                    leftSeconds -= diffSeconds;
                    if (leftStartMillis) leftStartMillis += diffSeconds * 1000;
                    timeLeft.textContent = leftSeconds < 0 ? '00:00' : formatTime(leftSeconds);
                } else if (currentTargetId === 'hour-right' && rightSeconds !== 0) {
                    rightSeconds -= diffSeconds;
                    if (rightStartMillis) rightStartMillis += diffSeconds * 1000;
                    timeRight.textContent = rightSeconds < 0 ? '00:00' : formatTime(rightSeconds);
                }
            }
        }

        targetEl.textContent = `${formattedH}:${formattedM}`;

        // Update the next feeding time calculation based on the earliest active timer
        if (currentTargetId === 'hour-left' || currentTargetId === 'hour-right' || currentTargetId === 'hour-bottle') {
            let earliestStr = '23:59';
            const hl = document.getElementById('hour-left').textContent;
            const hr = document.getElementById('hour-right').textContent;
            const hb = document.getElementById('hour-bottle');
            const hbText = hb ? hb.textContent : '--:--';
            
            if (hl !== '--:--' && hl < earliestStr) earliestStr = hl;
            if (hr !== '--:--' && hr < earliestStr) earliestStr = hr;
            if (hbText !== '--:--' && hbText < earliestStr) earliestStr = hbText;

            if (earliestStr !== '23:59') {
                const now = new Date();
                const [eh, em] = earliestStr.split(':').map(Number);
                now.setHours(eh, em, 0, 0);
                
                if (lastFeedingStartTime && lastFeedingStartTime.getDate() !== now.getDate()) {
                    now.setFullYear(lastFeedingStartTime.getFullYear(), lastFeedingStartTime.getMonth(), lastFeedingStartTime.getDate());
                } else if (eh > new Date().getHours() + 12) {
                    now.setDate(now.getDate() - 1);
                }

                lastFeedingStartTime = now;
                countdownBaseTime = now;
                updateNextFeedingTime();
            }
        }
    }
    saveCurrentState();
    closeModal();
});

// --- Settings and i18n Logic ---
let currentLang = CONFIG.app.defaultLang;
let appSettings = {};

// Initialize on load
loadCurrentState();

function saveSettings(settings) {
    localStorage.setItem(CONFIG.storage.settingsKey, JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem(CONFIG.storage.settingsKey);
    let settings = {
        lang: CONFIG.app.defaultLang,
        theme: CONFIG.app.defaultTheme,
        defaultTab: CONFIG.app.defaultTab,
        cloudColor: CONFIG.app.defaultCloudColor,
        compactHistory: CONFIG.app.defaultCompactHistory !== undefined ? CONFIG.app.defaultCompactHistory : true
    };
    if (saved) {
        try {
            settings = { ...settings, ...JSON.parse(saved) };
        } catch (e) { }
    }

    // Apply Settings
    currentLang = settings.lang;
    document.getElementById('settings-lang').value = currentLang;
    applyLanguage(currentLang);

    document.getElementById('settings-theme').checked = (settings.theme === 'light');
    applyTheme(settings.theme);

    const savedColor = settings.cloudColor || CONFIG.app.defaultCloudColor;
    document.querySelectorAll('.color-circle').forEach(btn => {
        if (btn.getAttribute('data-color').toUpperCase() === savedColor.toUpperCase()) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    applyCloudColor(savedColor);

    document.getElementById('settings-default-tab').value = settings.defaultTab;

    document.getElementById('settings-compact-history').checked = settings.compactHistory;

    appSettings = settings;

    // Switch to the default tab on load
    const targetBtn = document.querySelector('.nav-item[data-target="' + settings.defaultTab + '"]');
    if (targetBtn && !targetBtn.classList.contains('active')) {
        targetBtn.click();
    }
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

function applyCloudColor(hex) {
    if (!hex) return;
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    document.documentElement.style.setProperty('--cloud-color-rgb', `${r}, ${g}, ${b}`);

    const darkR = Math.floor(r * 0.20 + 35);
    const darkG = Math.floor(g * 0.20 + 35);
    const darkB = Math.floor(b * 0.20 + 40);
    document.documentElement.style.setProperty('--bg-color-dark', `rgb(${darkR}, ${darkG}, ${darkB})`);
}

function getTranslation(key) {
    return TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key] ? TRANSLATIONS[currentLang][key] : TRANSLATIONS['es'][key];
}

function applyLanguage(lang) {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
            el.textContent = TRANSLATIONS[lang][key];
        } else if (TRANSLATIONS['es'][key]) {
            el.textContent = TRANSLATIONS['es'][key]; // fallback to es
        }
    });

    // Refresh history if we are currently looking at it
    const activeView = document.querySelector('.view.active');
    if (activeView && activeView.id === 'view-historial') {
        renderHistory();
    }
}

// Event Listeners for Settings
document.getElementById('settings-lang').addEventListener('change', (e) => {
    currentLang = e.target.value;
    applyLanguage(currentLang);
    updateSettingsStorage();
});

document.getElementById('settings-theme').addEventListener('change', (e) => {
    const theme = e.target.checked ? 'light' : 'dark';
    applyTheme(theme);
    updateSettingsStorage();
});

document.getElementById('settings-default-tab').addEventListener('change', (e) => {
    updateSettingsStorage();
});

document.getElementById('settings-compact-history').addEventListener('change', (e) => {
    updateSettingsStorage();
    if (document.querySelector('.view.active') && document.querySelector('.view.active').id === 'view-historial') {
        renderHistory();
    }
});

// Permission buttons
const btnPermAlarms = document.getElementById('btn-perm-alarms');
const btnPermNotif = document.getElementById('btn-perm-notif');

if (btnPermAlarms) {
    btnPermAlarms.addEventListener('click', () => {
        if (isNative()) {
            const sysAlarm = getSysAlarm();
            if (sysAlarm) {
                sysAlarm.openExactAlarmSettings().catch(e => console.error(e));
            }
        }
    });
}

if (btnPermNotif) {
    btnPermNotif.addEventListener('click', async () => {
        if (isNative()) {
            const sysAlarm = getSysAlarm();
            if (sysAlarm) {
                sysAlarm.openNotificationSettings().catch(e => console.error(e));
            }

            const localNotif = getLocalNotif();
            if (localNotif) {
                localNotif.requestPermissions().catch(e => console.error(e));
            }
        }
    });
}

document.querySelectorAll('.color-circle').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const color = btn.getAttribute('data-color');

        document.querySelectorAll('.color-circle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        applyCloudColor(color);
        updateSettingsStorage(color);
    });
});

function updateSettingsStorage(overrideColor = null) {
    let cloudColor = overrideColor;
    if (!cloudColor) {
        const activeBtn = document.querySelector('.color-circle.active');
        cloudColor = activeBtn ? activeBtn.getAttribute('data-color') : CONFIG.app.defaultCloudColor;
    }

    const newSettings = {
        lang: document.getElementById('settings-lang').value,
        theme: document.getElementById('settings-theme').checked ? 'light' : 'dark',
        defaultTab: document.getElementById('settings-default-tab').value,
        cloudColor: cloudColor,
        compactHistory: document.getElementById('settings-compact-history').checked
    };
    appSettings = newSettings;
    saveSettings(newSettings);
}

const infoAlarmModal = document.getElementById('info-alarm-modal');
const btnInfoAlarmOk = document.getElementById('btn-info-alarm-ok');
const btnInfoAlarm = document.getElementById('btn-info-alarm');

if (btnInfoAlarm && infoAlarmModal && btnInfoAlarmOk) {
    btnInfoAlarm.addEventListener('click', (e) => {
        e.stopPropagation();
        infoAlarmModal.classList.add('active');
    });
    btnInfoAlarmOk.addEventListener('click', () => {
        infoAlarmModal.classList.remove('active');
    });
}

const bugModal = document.getElementById('bug-modal');
const bugDescription = document.getElementById('bug-description');
const btnReportBug = document.getElementById('btn-report-bug');
const bugCancel = document.getElementById('bug-cancel');
const bugSend = document.getElementById('bug-send');

btnReportBug.addEventListener('click', () => {
    bugDescription.value = '';
    bugModal.classList.add('active');
    setTimeout(() => bugDescription.focus(), 100);
});

bugCancel.addEventListener('click', () => {
    bugModal.classList.remove('active');
});

bugSend.addEventListener('click', () => {
    const desc = bugDescription.value.trim();
    if (!desc) return;

    bugSend.textContent = 'Enviando...';
    bugSend.disabled = true;

    const templateParams = {
        title: 'Reporte de Bug',
        name: 'Usuario Teta Brick',
        time: new Date().toLocaleString(),
        message: desc,
        email: 'noreply@tetabrick.app'
    };

    // Enviar correo con EmailJS
    emailjs.send('service_lj04q27', 'template_378ihes', templateParams)
        .then(() => {
            alert('¡Error reportado! Gracias por avisar.');
            bugModal.classList.remove('active');
        })
        .catch((err) => {
            alert('Hubo un problema al enviar el reporte. Por favor, revisa la conexión o la configuración de EmailJS.');
            console.error('EmailJS Error:', err);
        })
        .finally(() => {
            bugSend.textContent = 'Enviar';
            bugSend.disabled = false;
        });
});

bugModal.addEventListener('click', (e) => {
    if (e.target === bugModal) bugModal.classList.remove('active');
});

// Load settings on startup
window.addEventListener('DOMContentLoaded', () => {
    setupAllWheelPickers();
    loadSettings();
});

/* --- Wheel Picker Logic --- */
function setupAllWheelPickers() {
    document.querySelectorAll('.wheel-picker').forEach(pickerEl => {
        const min = parseInt(pickerEl.getAttribute('data-min') || '0');
        const max = parseInt(pickerEl.getAttribute('data-max') || '59');
        const targetId = pickerEl.getAttribute('data-target');
        const hiddenInput = document.getElementById(targetId);
        
        const isMini = pickerEl.classList.contains('mini-wheel');
        const itemHeight = isMini ? 40 : 50;
        
        const range = [];
        for(let i=min; i<=max; i++) range.push(i);
        
        pickerEl.innerHTML = '';
        // Add top padding
        pickerEl.insertAdjacentHTML('beforeend', `<div class="wheel-padding" style="height: ${itemHeight}px;"></div>`);
        
        const numBlocks = 5;
        for(let b=0; b<numBlocks; b++) {
            for(let i=0; i<range.length; i++) {
                const val = range[i].toString().padStart(2, '0');
                pickerEl.insertAdjacentHTML('beforeend', `<div class="wheel-item" data-val="${val}">${val}</div>`);
            }
        }
        
        // Add bottom padding
        pickerEl.insertAdjacentHTML('beforeend', `<div class="wheel-padding" style="height: ${itemHeight}px;"></div>`);
        
        const blockHeight = range.length * itemHeight;
        
        pickerEl.setValue = (val) => {
            val = parseInt(val);
            if (isNaN(val)) val = min;
            let idx = val - min;
            if (idx < 0) idx = 0;
            const targetScroll = (2 * blockHeight) + (idx * itemHeight);
            pickerEl.scrollTo({ top: targetScroll, behavior: 'instant' });
            if (hiddenInput && hiddenInput.value !== val.toString().padStart(2, '0')) {
                const originalSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                originalSetter.call(hiddenInput, val.toString().padStart(2, '0'));
                hiddenInput.dispatchEvent(new Event('input'));
            }
        };

        let isScrolling = null;
        pickerEl.addEventListener('scroll', () => {
            clearTimeout(isScrolling);
            isScrolling = setTimeout(() => {
                const st = pickerEl.scrollTop;
                const centerIdx = Math.round(st / itemHeight);
                
                const currentBlock = Math.floor(centerIdx / range.length);
                const localIdx = centerIdx % range.length;
                
                if (currentBlock <= 0 || currentBlock >= numBlocks - 1) {
                    const targetScroll = (2 * blockHeight) + (localIdx * itemHeight);
                    pickerEl.scrollTo({ top: targetScroll, behavior: 'instant' });
                }
                
                const actualVal = range[localIdx].toString().padStart(2, '0');
                if (hiddenInput && hiddenInput.value !== actualVal) {
                    const originalSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    originalSetter.call(hiddenInput, actualVal);
                    hiddenInput.dispatchEvent(new Event('input'));
                }
            }, 150);
        });

        // Drag to scroll for non-touch devices (Windows/Mouse)
        let isDragging = false;
        let startY;
        let scrollTop;
        pickerEl.addEventListener('pointerdown', (e) => {
            isDragging = true;
            startY = e.pageY;
            scrollTop = pickerEl.scrollTop;
            pickerEl.style.scrollSnapType = 'none'; // Disable snapping while dragging
            pickerEl.setPointerCapture(e.pointerId);
        });
        pickerEl.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            pickerEl.style.scrollSnapType = 'y mandatory';
            pickerEl.releasePointerCapture(e.pointerId);
            
            // Trigger snap by doing a tiny programmatic scroll
            pickerEl.scrollBy(0, 1);
            pickerEl.scrollBy(0, -1);
        });
        pickerEl.addEventListener('pointercancel', (e) => {
            if (!isDragging) return;
            isDragging = false;
            pickerEl.style.scrollSnapType = 'y mandatory';
        });
        pickerEl.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const y = e.pageY;
            const walk = (y - startY) * 1.5; // Scroll speed multiplier
            pickerEl.scrollTop = scrollTop - walk;
        });

        // Initialize value if hidden input has one
        if (hiddenInput && hiddenInput.value) {
            pickerEl.setValue(hiddenInput.value);
        } else {
            pickerEl.setValue(min);
        }

        // Overwrite hiddenInput setter to allow script to control picker
        if (hiddenInput) {
            const originalSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            Object.defineProperty(hiddenInput, "value", {
                set: function(val) {
                    originalSetter.call(this, val);
                    if (!this._isUpdating) {
                        this._isUpdating = true;
                        pickerEl.setValue(val);
                        this._isUpdating = false;
                    }
                },
                get: function() {
                    return Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").get.call(this);
                }
            });
        }

        // When modals open (element becomes visible), ensure scroll position is correct
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && hiddenInput) {
                    pickerEl.setValue(hiddenInput.value);
                }
            });
        });
        observer.observe(pickerEl);
    });
}
