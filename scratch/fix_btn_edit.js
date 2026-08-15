const fs = require('fs');
const scriptPath = 'www/script.js';

let content = fs.readFileSync(scriptPath, 'utf8');

// The faulty findMergeTarget block:
const faultyFindMergeTargetStr = `    const findMergeTarget = (evDateStr, excludeSessionId) => {
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
    };`;

const newFindMergeTargetStr = `    const findMergeTarget = (evDateStr, excludeSessionId) => {
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
                
                // Since evDate and sDate are complete dates with year, month, day, hour, and minute, 
                // the absolute difference in minutes naturally accounts for crossing midnight correctly!
                let diffMins = Math.abs((evDate - sDate) / (1000 * 60));
                
                if (diffMins <= CONFIG.app.mergeWindowMinutes && diffMins < minDiff) {
                    minDiff = diffMins;
                    targetId = session.date;
                }
            }
        }
        return targetId;
    };`;

content = content.replace(faultyFindMergeTargetStr, newFindMergeTargetStr);


// Now fix the closeEditModal positions.
const oldManualMergeBlock = `        if (mergeTargetId) {
            mergeContext = 'manual';
            pendingSessionData = {
                ...newSession,
                targetSessionId: mergeTargetId,
                fullSession: newSession
            };
            mergeModal.classList.add('active');
            return;
        }`;

const newManualMergeBlock = `        if (mergeTargetId) {
            mergeContext = 'manual';
            pendingSessionData = {
                ...newSession,
                targetSessionId: mergeTargetId,
                fullSession: newSession
            };
            closeEditModal();
            mergeModal.classList.add('active');
            return;
        }`;

content = content.replace(oldManualMergeBlock, newManualMergeBlock);


const oldEditMergeBlock = `    if (mergeTargetId) {
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
    }`;

const newEditMergeBlock = `    if (mergeTargetId) {
        mergeContext = 'edit';
        pendingSessionData = {
            ...eventDataObj,
            isEdit: true,
            id: currentEditId,
            editKey: currentEditKey,
            targetSessionId: mergeTargetId,
            fullSession: session
        };
        closeEditModal();
        mergeModal.classList.add('active');
        return;
    }`;

content = content.replace(oldEditMergeBlock, newEditMergeBlock);

fs.writeFileSync(scriptPath, content, 'utf8');
console.log("Bug fixed!");
