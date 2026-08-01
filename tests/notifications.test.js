const { setupDOM } = require('./test-utils');

describe('Notifications & Permissions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupDOM();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('notification permission button requests permissions and opens settings', async () => {
    const btnPerm = document.getElementById('btn-perm-notif');
    
    await Promise.resolve(); 
    
    // Click it
    await btnPerm.click();
    
    // It should call openNotificationSettings and requestPermissions
    expect(window.Capacitor.Plugins.SystemAlarmPlugin.openNotificationSettings).toHaveBeenCalled();
    expect(window.Capacitor.Plugins.LocalNotifications.requestPermissions).toHaveBeenCalled();
  });

  test('modifying active start time recalculates next feeding countdown', () => {
    const btnLeft = document.getElementById('btn-left');
    const nextFeedingTime = document.getElementById('next-feeding-time');
    const nextFeedingHours = document.getElementById('next-feeding-hours');
    
    // Set next feeding interval to 2 hours
    nextFeedingHours.value = '2';
    document.getElementById('next-feeding-minutes').value = '0';
    nextFeedingHours.dispatchEvent(new Event('input'));

    const mockNow = new Date();
    mockNow.setHours(10, 0, 0, 0); // 10:00
    jest.setSystemTime(mockNow);

    // Start left feeding at 10:00
    btnLeft.click();
    
    // Next feeding should be at 12:00. The countdown will show 02:00:00.
    expect(nextFeedingTime.textContent).toContain('02:00:00');
    
    // Now user modifies the start time to 09:00 (1 hour earlier)
    const hourLeft = document.getElementById('hour-left');
    hourLeft.click();
    
    document.getElementById('modal-hour').value = '09';
    document.getElementById('modal-minute').value = '00';
    document.getElementById('modal-save').click();
    
    // Next feeding should now be recalculated to 11:00 (1 hour remaining)
    expect(nextFeedingTime.textContent).toContain('01:00:00');
  });

  test('stop next feeding button clears the next feeding time', () => {
    const btnLeft = document.getElementById('btn-left');
    const nextFeedingTime = document.getElementById('next-feeding-time');
    const btnStopNext = document.getElementById('btn-stop-next');

    btnLeft.click();
    expect(nextFeedingTime.textContent).not.toBe('--:--');

    btnStopNext.click();
    expect(nextFeedingTime.textContent).toBe('--:--');
  });
});
