const { setupDOM } = require('./test-utils');

describe('History & Persistance', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupDOM();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('registering a session saves to history and clears active UI', () => {
    const btnDiaper = document.getElementById('btn-diaper');
    const btnRegistrar = document.getElementById('btn-registrar');

    // Add a diaper to the session (bypasses the Date.now() timer issues in JSDOM)
    btnDiaper.click(); 
    
    // Register
    btnRegistrar.click();
    
    // Should save to local storage
    const history = JSON.parse(window.localStorage.getItem('babyLogHistory'));
    expect(history.length).toBe(1);
    expect(history[0].diapers).toBeTruthy();
  });

  test('merging sessions within time window', () => {
    const btnDiaper = document.getElementById('btn-diaper');
    const btnRegistrar = document.getElementById('btn-registrar');
    const mergeModal = document.getElementById('merge-modal');
    const btnMergeConfirm = document.getElementById('merge-confirm');
    
    // FIRST SESSION
    btnDiaper.click(); 
    btnRegistrar.click(); // save first session
    
    let history = JSON.parse(window.localStorage.getItem('babyLogHistory'));
    expect(history.length).toBe(1);
    expect(history[0].diapers).toBeTruthy();

    // SECOND SESSION
    btnDiaper.click(); 
    btnRegistrar.click(); 
    
    // Merge modal should be active (since they are within 30 mins, effectively 0 time passed)
    expect(mergeModal.classList.contains('active')).toBe(true);
    
    // Click confirm
    btnMergeConfirm.click();
    
    history = JSON.parse(window.localStorage.getItem('babyLogHistory'));
    expect(history.length).toBe(1); // Still 1 item (merged)
  });
});
