// This script runs the checkOverlap logic on a mock history representing the user's state.
const fs = require('fs');

const history = [
    {
        date: "2026-08-15T08:00:00.000Z",
        left: { startTime: "10:00", durationSeconds: 3600 } // 10:00 to 11:00
    }
];

function checkOverlap(history, ignoreDateStr, eventType, startStr, durationSeconds, compareDate) {
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
}

// Emulate btnEditSave adding a new event (isAddingNew = true)
const newTime = "10:30";
const mins = 10;
const type = "right";
const now = new Date("2026-08-15T12:00:00.000Z");

const isOverlap = checkOverlap(history, null, type, newTime, mins * 60, now);
console.log("Did it detect overlap?", isOverlap);

// Emulate btnRegistrar adding a bottle at 10:30
const isOverlapBottle = checkOverlap(history, null, "bottle", "10:30", 0, now);
console.log("Did it detect bottle overlap?", isOverlapBottle);

