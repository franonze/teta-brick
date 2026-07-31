const { setupDOM } = require('./test-utils');

describe('Timers & Controls', () => {
  beforeEach(() => {
    // Clear state
    global.localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    setupDOM();
  });

  test('starting the left timer populates start time', () => {
    const btnLeft = document.getElementById('btn-left');
    const hourLeft = document.getElementById('hour-left');
    
    expect(hourLeft.textContent).toBe('--:--');

    // Click play
    btnLeft.click();

    // Check that start time is populated (not --:--)
    expect(hourLeft.textContent).not.toBe('--:--');
    
    // Check that button shows pause icon (svg elements inside)
    expect(btnLeft.innerHTML).toContain('<svg');
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
});
