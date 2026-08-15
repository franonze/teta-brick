const fs = require('fs');

const scriptPath = 'www/script.js';
let content = fs.readFileSync(scriptPath, 'utf8');

// 1. Rewrite checkOverlap definition
const oldCheckOverlap = `function checkOverlap(history, ignoreDateStr, eventType, startStr, durationSeconds, compareDate) {
    if (!startStr || eventType === 'diaper') return false;
    const s1 = new Date(compareDate || new Date());
    const [h1, m1] = startStr.split(':').map(Number);
    s1.setHours(h1, m1, 0, 0);
    const end1 = new Date(s1.getTime() + (durationSeconds || 0) * 1000);

    for (const session of history) {
        if (ignoreDateStr && session.date === ignoreDateStr) continue;

        const checkType = (type, data) => {
            if (!data || !data.startTime || type === 'diaper') return false;
            const s2 = new Date(session.date);
            const [h2, m2] = data.startTime.split(':').map(Number);
            s2.setHours(h2, m2, 0, 0);
            let dur2 = 0;
            if (type === 'left' || type === 'right') dur2 = data.durationSeconds || 0;
            const end2 = new Date(s2.getTime() + dur2 * 1000);

            if (s1 < end2 && s2 < end1) return true;
            if (s1.getTime() === s2.getTime()) return true;
            return false;
        };

        if (checkType('left', session.left)) return true;
        if (checkType('right', session.right)) return true;
        if (checkType('bottle', session.bottle)) return true;
    }
    return false;
}`;

const newCheckOverlap = `function checkOverlap(history, ignoreDateStr, ignoreKey, eventType, startStr, durationSeconds, compareDate) {
    if (!startStr || eventType === 'diaper') return false;
    const s1 = new Date(compareDate || new Date());
    const [h1, m1] = startStr.split(':').map(Number);
    s1.setHours(h1, m1, 0, 0);
    const end1 = new Date(s1.getTime() + (durationSeconds || 0) * 1000);

    for (const session of history) {
        const checkType = (type, data) => {
            if (ignoreDateStr && session.date === ignoreDateStr && type === ignoreKey) return false;
            
            if (!data || !data.startTime || type === 'diaper') return false;
            const s2 = new Date(session.date);
            const [h2, m2] = data.startTime.split(':').map(Number);
            s2.setHours(h2, m2, 0, 0);
            let dur2 = 0;
            if (type === 'left' || type === 'right') dur2 = data.durationSeconds || 0;
            const end2 = new Date(s2.getTime() + dur2 * 1000);

            if (s1 < end2 && s2 < end1) return true;
            if (s1.getTime() === s2.getTime()) return true;
            return false;
        };

        if (checkType('left', session.left)) return true;
        if (checkType('right', session.right)) return true;
        if (checkType('bottle', session.bottle)) return true;
    }
    return false;
}`;

content = content.replace(oldCheckOverlap, newCheckOverlap);

// 2. Fix calls in btnRegistrar
content = content.replace(
    /checkOverlap\(history, null, 'left'/g,
    "checkOverlap(history, null, null, 'left'"
);
content = content.replace(
    /checkOverlap\(history, null, 'right'/g,
    "checkOverlap(history, null, null, 'right'"
);
content = content.replace(
    /checkOverlap\(history, null, 'bottle'/g,
    "checkOverlap(history, null, null, 'bottle'"
);

// 3. Fix calls in btnEditSave
content = content.replace(
    /checkOverlap\(history, null, type,/g,
    "checkOverlap(history, null, null, type,"
);
content = content.replace(
    /checkOverlap\(history, currentEditId, targetKey,/g,
    "checkOverlap(history, currentEditId, currentEditKey, targetKey,"
);

// Add a check inside btnRegistrar to prevent left and right overlapping with each other
// Find the block:
/*
    let isOverlap = false;
    if (sessionData.left && sessionData.left.startTime) {
        if (checkOverlap(history, null, null, 'left', sessionData.left.startTime, sessionData.left.durationSeconds, baseDate)) isOverlap = true;
    }
    if (sessionData.right && sessionData.right.startTime) {
        if (checkOverlap(history, null, null, 'right', sessionData.right.startTime, sessionData.right.durationSeconds, baseDate)) isOverlap = true;
    }
*/
const oldOverlapBlock = `    let isOverlap = false;
    if (sessionData.left && sessionData.left.startTime) {
        if (checkOverlap(history, null, null, 'left', sessionData.left.startTime, sessionData.left.durationSeconds, baseDate)) isOverlap = true;
    }
    if (sessionData.right && sessionData.right.startTime) {
        if (checkOverlap(history, null, null, 'right', sessionData.right.startTime, sessionData.right.durationSeconds, baseDate)) isOverlap = true;
    }
    if (sessionData.bottle && sessionData.bottle.startTime) {
        if (checkOverlap(history, null, null, 'bottle', sessionData.bottle.startTime, 0, baseDate)) isOverlap = true;
    }`;

const newOverlapBlock = `    let isOverlap = false;
    if (sessionData.left && sessionData.left.startTime) {
        if (checkOverlap(history, null, null, 'left', sessionData.left.startTime, sessionData.left.durationSeconds, baseDate)) isOverlap = true;
    }
    if (sessionData.right && sessionData.right.startTime) {
        if (checkOverlap(history, null, null, 'right', sessionData.right.startTime, sessionData.right.durationSeconds, baseDate)) isOverlap = true;
        // Also check against left inside the same session being created!
        if (sessionData.left && sessionData.left.startTime) {
            const s1 = new Date(baseDate);
            const [h1, m1] = sessionData.right.startTime.split(':').map(Number);
            s1.setHours(h1, m1, 0, 0);
            const end1 = new Date(s1.getTime() + sessionData.right.durationSeconds * 1000);
            
            const s2 = new Date(baseDate);
            const [h2, m2] = sessionData.left.startTime.split(':').map(Number);
            s2.setHours(h2, m2, 0, 0);
            const end2 = new Date(s2.getTime() + sessionData.left.durationSeconds * 1000);
            
            if (s1 < end2 && s2 < end1) isOverlap = true;
            if (s1.getTime() === s2.getTime()) isOverlap = true;
        }
    }
    if (sessionData.bottle && sessionData.bottle.startTime) {
        if (checkOverlap(history, null, null, 'bottle', sessionData.bottle.startTime, 0, baseDate)) isOverlap = true;
    }`;

content = content.replace(oldOverlapBlock, newOverlapBlock);

fs.writeFileSync(scriptPath, content, 'utf8');
console.log("Overlap logic fully updated!");
