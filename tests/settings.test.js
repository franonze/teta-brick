const { setupDOM } = require('./test-utils');

describe('Settings & Preferences', () => {
  beforeEach(() => {
    let storage = {};
    global.localStorage = {
      getItem: jest.fn(key => storage[key] || null),
      setItem: jest.fn((key, value) => { storage[key] = value; })
    };
    setupDOM();
  });

  test('changing theme adds light-theme class to body', () => {
    const settingsTheme = document.getElementById('settings-theme');
    
    // Default is dark (no light-theme class)
    expect(document.body.classList.contains('light-theme')).toBe(false);

    // Toggle theme switch
    settingsTheme.checked = true;
    settingsTheme.dispatchEvent(new Event('change'));

    expect(document.body.classList.contains('light-theme')).toBe(true);
  });

  test('changing language updates text content', () => {
    const settingsLang = document.getElementById('settings-lang');
    const headerTitle = document.querySelector('.view-title');
    
    // Default is es
    expect(headerTitle.textContent).toBe('Pecho');
    
    // Switch to en
    settingsLang.value = 'en';
    settingsLang.dispatchEvent(new Event('change'));

    // Check a known translation key (e.g. settings is 'Settings' instead of 'Ajustes')
    // Wait, the header is "Teta Brick", let's check a tab
    const tabAjustes = document.querySelector('.nav-item[data-target="view-ajustes"] span');
    expect(tabAjustes.textContent).toBe('Settings');
  });
});
