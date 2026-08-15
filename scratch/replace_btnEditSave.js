btnEditSave.addEventListener('click', () => {
    let history = JSON.parse(localStorage.getItem(CONFIG.storage.historyKey)) || [];
    let h = parseInt(editHour.value) || 0;
    let m = parseInt(editMinute.value) || 0;
    h = Math.max(0, Math.min(23, h));
    m = Math.max(0, Math.min(59, m));
    const newTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    const editNote = document.getElementById('edit-note');
    const noteVal = editNote ? editNote.value.trim() : '';

    const selectedDate = editDate && editDate.value ? new Date(editDate.value) : new Date();
    
    // Helper to find merge target
    const findMergeTarget = (evDateStr, excludeSessionId) => {
        if (!evDateStr) return null;
        const evDate = new Date(selectedDate);
        const [eh, em] = evDateStr.split(':').map(Number);
        evDate.setHours(eh, em, 0, 0);

        let targetId = null;
        let minDiff = Infinity;
        for (const session of history) {
            if (excludeSessionId && session.date === excludeSessionId) continue;
            const sTimeStr = session.left?.startTime || session.right?.startTime || session.bottle?.startTime || (session.diapers && (session.diapers.time || session.diapers));
            if (sTimeStr && typeof sTimeStr === 'string') {
                const sDate = new Date(session.date);
                const [sh, sm] = sTimeStr.split(':').map(Number);
                sDate.setHours(sh, sm, 0, 0);
                let diffMins = Math.abs((evDate - sDate) / (1000 * 60));
                // Handle crossing midnight
                if (diffMins > 12 * 60) diffMins = 24 * 60 - diffMins;
                if (diffMins <= CONFIG.app.mergeWindowMinutes && diffMins < minDiff) {
                    minDiff = diffMins;
                    targetId = session.date;
                }
            }
        }
        return targetId;
    };

    if (isAddingNew) {
        const type = eventType ? eventType.value : 'left';
        const now = new Date();
        now.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        let newSession = { date: now.toISOString() };

        let mins = parseInt(editDuration.value) || 0;
        if (type === 'left') newSession.left = { startTime: newTime, durationSeconds: mins * 60, note: noteVal };
        else if (type === 'right') newSession.right = { startTime: newTime, durationSeconds: mins * 60, note: noteVal };
        else if (type === 'bottle') newSession.bottle = { startTime: newTime, ml: mins, note: noteVal };
        else if (type === 'diaper') newSession.diapers = { time: newTime, note: noteVal };

        // Overlap Check
        if (checkOverlap(history, null, type, newTime, (type === 'left' || type === 'right') ? mins * 60 : 0, now)) {
            alert(getTranslation('error_overlap'));
            return;
        }

        const mergeTargetId = findMergeTarget(newTime, null);
        if (mergeTargetId) {
            mergeContext = 'manual';
            pendingSessionData = {
                ...newSession,
                targetSessionId: mergeTargetId,
                fullSession: newSession
            };
            mergeModal.classList.add('active');
            return;
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
    // Deep clone the session to manipulate it safely
    session = JSON.parse(JSON.stringify(session));

    const d = new Date(session.date);
    d.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    session.date = d.toISOString();

    const targetKey = eventType ? eventType.value : currentEditKey;
    
    // Overlap Check
    let mins = parseInt(editDuration.value) || 0;
    if (checkOverlap(history, currentEditId, targetKey, newTime, (targetKey === 'left' || targetKey === 'right') ? mins * 60 : 0, d)) {
        alert(getTranslation('error_overlap'));
        return;
    }

    // Build the isolated event data for potential merging
    let eventDataObj = {};
    if (targetKey === 'left' || targetKey === 'right') {
        eventDataObj[targetKey] = { startTime: newTime, durationSeconds: Math.max(0, mins) * 60, note: noteVal };
    } else if (targetKey === 'bottle') {
        eventDataObj.bottle = { startTime: newTime, ml: Math.max(0, mins), note: noteVal };
    } else if (targetKey === 'diaper') {
        eventDataObj.diapers = { time: newTime, note: noteVal };
    }

    // Update the session in memory
    const oldProp = currentEditKey === 'diaper' ? 'diapers' : currentEditKey;
    const newProp = targetKey === 'diaper' ? 'diapers' : targetKey;
    
    if (targetKey !== currentEditKey) {
        delete session[oldProp];
    }
    
    if (targetKey === 'left') {
        session.left = { ...session.left, ...eventDataObj.left };
    } else if (targetKey === 'right') {
        session.right = { ...session.right, ...eventDataObj.right };
    } else if (targetKey === 'bottle') {
        session.bottle = { ...session.bottle, ...eventDataObj.bottle };
    } else if (targetKey === 'diaper') {
        let oldObj = typeof session.diapers === 'object' ? session.diapers : {};
        if (targetKey !== currentEditKey) oldObj = {};
        session.diapers = { ...oldObj, ...eventDataObj.diapers };
    }

    const mergeTargetId = findMergeTarget(newTime, currentEditId);

    if (mergeTargetId) {
        mergeContext = 'edit';
        pendingSessionData = {
            ...eventDataObj,
            isEdit: true,
            id: currentEditId,
            editKey: currentEditKey,
            targetSessionId: mergeTargetId,
            fullSession: session
        };
        mergeModal.classList.add('active');
        return;
    }

    history[index] = session;
    localStorage.setItem(CONFIG.storage.historyKey, JSON.stringify(history));
    recalculateNextFeedingFromHistory(history);
    renderHistory();
    closeEditModal();
});
