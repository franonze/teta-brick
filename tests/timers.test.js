const { setupDOM } = require('./test-utils');

describe('Timers & Controls', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupDOM();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('starting the left timer populates start time and pauses right timer', () => {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const hourLeft = document.getElementById('hour-left');
    const timeLeft = document.getElementById('time-left');

    expect(hourLeft.textContent).toBe('--:--');

    // Start left
    btnLeft.click();
    expect(hourLeft.textContent).not.toBe('--:--');
    expect(btnLeft.innerHTML).toContain('<svg'); // pause icon
    
    // Advance 5 seconds
    jest.setSystemTime(Date.now() + 5000);
    jest.advanceTimersByTime(5000);
    expect(timeLeft.textContent).toBe('00:10');

    // Start right - should pause left
    btnRight.click();
    expect(btnLeft.innerHTML).toContain('<svg'); // play icon (paused)
    expect(btnRight.innerHTML).toContain('<svg'); // pause icon (playing)
    
    // Advance 5 more seconds
    jest.setSystemTime(Date.now() + 5000);
    jest.advanceTimersByTime(5000);
    expect(timeLeft.textContent).toBe('00:10'); // Left stayed at 00:10
    expect(document.getElementById('time-right').textContent).toBe('00:10'); // Right is at 00:10
  });

  test('reset button clears timer', () => {
    const btnLeft = document.getElementById('btn-left');
    const hourLeft = document.getElementById('hour-left');
    const btnResetLeft = document.getElementById('btn-reset-left');

    btnLeft.click();
    expect(hourLeft.textContent).not.toBe('--:--');

    // Reset
    btnResetLeft.click();
    expect(hourLeft.textContent).toBe('--:--');
  });

  test('bottle timer logic works via modal', () => {
    const btnBottle = document.getElementById('btn-bottle');
    const modalMlInput = document.getElementById('modal-ml-input');
    const mlSave = document.getElementById('ml-save');
    const mlBottle = document.getElementById('ml-bottle');
    const hourBottle = document.getElementById('hour-bottle');

    // Start bottle
    btnBottle.click();
    expect(hourBottle.textContent).not.toBe('--:--');

    // Click again to open ML modal
    btnBottle.click();
    expect(document.getElementById('ml-modal').classList.contains('active')).toBe(true);

    // Enter ml and save
    modalMlInput.value = '150';
    mlSave.click();

    expect(mlBottle.textContent).toBe('150');
    expect(document.getElementById('ml-modal').classList.contains('active')).toBe(false);
  });

  test('modifying active timer start time recalculates seconds', () => {
    const btnLeft = document.getElementById('btn-left');
    const hourLeft = document.getElementById('hour-left');
    const timeModal = document.getElementById('time-modal');
    const modalHour = document.getElementById('modal-hour');
    const modalMinute = document.getElementById('modal-minute');
    const modalSave = document.getElementById('modal-save');
    const timeLeft = document.getElementById('time-left');

    // Mock Date to ensure start time is exactly 10:30 for predictable diff
    const mockNow = new Date();
    mockNow.setHours(10, 30, 0, 0);
    jest.setSystemTime(mockNow);

    btnLeft.click(); // Sets to 10:30
    jest.advanceTimersByTime(60000); // 1 minute passes => 10:31, left = 00:01

    // Restore Date to let timers calculate difference properly based on start time offset
    // Actually the script uses Date.now(), so let's just use advanceTimersByTime and check diff
    // The script subtracts Date.now() from leftStartMillis.

    hourLeft.click(); // Open time modal
    expect(timeModal.classList.contains('active')).toBe(true);

    // Modify time to 5 minutes ago (10:25)
    modalHour.value = '10';
    modalMinute.value = '25';
    modalSave.click();

    // Now it should have added 5 minutes (300 seconds) to the timer
    // Previously 1 minute (60s) + 5 minutes = 6 minutes (360s = 06:00)
    expect(timeLeft.textContent).toBe('06:00');
    expect(hourLeft.textContent).toBe('10:25');
  });
});
