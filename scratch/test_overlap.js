const history = [
    {
        date: "2026-08-15T10:00:00.000Z", // say today
        left: { startTime: "10:00", durationSeconds: 3600 } // ends at 11:00
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

            console.log(`Checking s1: ${s1.toISOString()} -> ${end1.toISOString()}`);
            console.log(`Against s2: ${s2.toISOString()} -> ${end2.toISOString()}`);

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

// 1. New event at 10:30, duration 10 mins (should overlap)
const res1 = checkOverlap(history, null, 'left', '10:30', 600, "2026-08-15T12:00:00.000Z");
console.log("Overlap inside: ", res1);

// 2. New event at 09:30, duration 60 mins (ends at 10:30, should overlap)
const res2 = checkOverlap(history, null, 'left', '09:30', 3600, "2026-08-15T12:00:00.000Z");
console.log("Overlap before: ", res2);

// 3. New event at 11:30, duration 10 mins (should NOT overlap)
const res3 = checkOverlap(history, null, 'left', '11:30', 600, "2026-08-15T12:00:00.000Z");
console.log("No overlap: ", res3);
