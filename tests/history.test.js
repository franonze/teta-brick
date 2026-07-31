const { setupDOM } = require('./test-utils');

describe('History & State', () => {
  beforeEach(() => {
    global.localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    setupDOM();
  });

  test('switching to history tab does not crash', () => {
    // Switch to history tab
    const historyTab = document.querySelector('[data-target="view-historial"]');
    historyTab.click();

    const historyContent = document.getElementById('history-container');
    expect(historyContent).not.toBeNull();
  });
});
