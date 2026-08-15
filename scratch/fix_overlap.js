// Definition of checkOverlap
window.checkOverlap = function(history, ignoreDateStr, currentType, newTime, newDurationSeconds, selectedDateObj) {
    if (['left', 'right', 'bottle'].indexOf(currentType) === -1) return false;

    // Convert new event to absolute timestamps
    // newTime is "HH:MM"
    const [nH, nM] = newTime.split(':').map(Number);
    const newStart = new Date(selectedDateObj);
    newStart.setHours(nH, nM, 0, 0);
    const newStartMs = newStart.getTime();
    const newEndMs = newStartMs + (newDurationSeconds * 1000);

    for (let session of history) {
        if (ignoreDateStr && session.date === ignoreDateStr) continue;

        // check left
        if (session.left) {
            const [oH, oM] = session.left.startTime.split(':').map(Number);
            const oStart = new Date(session.date);
            oStart.setHours(oH, oM, 0, 0);
            const oStartMs = oStart.getTime();
            const oEndMs = oStartMs + (session.left.durationSeconds * 1000);
            
            if (newStartMs < oEndMs && newEndMs > oStartMs) return true; // Overlap!
        }
        // check right
        if (session.right) {
            const [oH, oM] = session.right.startTime.split(':').map(Number);
            const oStart = new Date(session.date);
            oStart.setHours(oH, oM, 0, 0);
            const oStartMs = oStart.getTime();
            const oEndMs = oStartMs + (session.right.durationSeconds * 1000);
            
            if (newStartMs < oEndMs && newEndMs > oStartMs) return true; // Overlap!
        }
        // check bottle (duration typically not recorded, maybe we assume 0 or 1 minute)
        // wait, bottle doesn't have duration. It has ml. So duration is 0.
        if (session.bottle) {
            const [oH, oM] = session.bottle.startTime.split(':').map(Number);
            const oStart = new Date(session.date);
            oStart.setHours(oH, oM, 0, 0);
            const oStartMs = oStart.getTime();
            const oEndMs = oStartMs + 60000; // 1 minute overlap for bottle
            
            if (newStartMs < oEndMs && newEndMs > oStartMs) return true; // Overlap!
        }
    }
    return false;
};

// Also we need `checkMergeWindow`
window.checkMergeWindow = function(history, ignoreDateStr, currentType, newTime, selectedDateObj) {
    // we want to find if there is an existing event of the SAME type that is within 30 minutes.
    // wait, the user said "si creas un evento de toma de pecho con una duracion, y luego registras otra toma que empiece en el tiempo que dura el primero que has creado... no deberia dejarte unirlo, porque se esta solapando". 
    // And "Tambien si al modificar un evento, el nuevo tiempo inicial tiene menos del tiempo configurado de diferencia con otro evento, que tsambien pregunte si quieres unirlo."
    // And "if its the same type, and you agree to merge the event, sum the durations into one"

    const [nH, nM] = newTime.split(':').map(Number);
    const newStart = new Date(selectedDateObj);
    newStart.setHours(nH, nM, 0, 0);
    const newStartMs = newStart.getTime();

    // Iterate backwards to find the closest? Or just any that matches?
    // Since history might not be strictly sorted, or might be sorted by date:
    for (let i = history.length - 1; i >= 0; i--) {
        let session = history[i];
        if (ignoreDateStr && session.date === ignoreDateStr) continue;

        let oStartMs = null;
        let hasSameType = false;

        if (currentType === 'left' && session.left) {
            const [oH, oM] = session.left.startTime.split(':').map(Number);
            const oStart = new Date(session.date);
            oStart.setHours(oH, oM, 0, 0);
            oStartMs = oStart.getTime();
            hasSameType = true;
        } else if (currentType === 'right' && session.right) {
            const [oH, oM] = session.right.startTime.split(':').map(Number);
            const oStart = new Date(session.date);
            oStart.setHours(oH, oM, 0, 0);
            oStartMs = oStart.getTime();
            hasSameType = true;
        } else if (currentType === 'bottle' && session.bottle) {
            const [oH, oM] = session.bottle.startTime.split(':').map(Number);
            const oStart = new Date(session.date);
            oStart.setHours(oH, oM, 0, 0);
            oStartMs = oStart.getTime();
            hasSameType = true;
        } else if (currentType === 'diaper' && session.diapers) {
            const [oH, oM] = session.diapers.time.split(':').map(Number);
            const oStart = new Date(session.date);
            oStart.setHours(oH, oM, 0, 0);
            oStartMs = oStart.getTime();
            hasSameType = true;
        }

        if (hasSameType && oStartMs !== null) {
            const diffMins = Math.abs(newStartMs - oStartMs) / (1000 * 60);
            if (diffMins <= MERGE_WINDOW_MINUTES) {
                return i; // return index of the session to merge into
            }
        }
    }
    return -1;
};

// ... we will modify btnEditSave click listener to use these!
