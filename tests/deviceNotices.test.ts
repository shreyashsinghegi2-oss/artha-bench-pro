import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARTHAMIND_NOTICE_BADGE, ARTHAMIND_NOTICE_ICON, showDeviceNotice } from '../src/services/notifications';

class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static calls: Array<[string, NotificationOptions]> = [];
  onclick: (() => void) | null = null;
  close = vi.fn();
  constructor(title: string, options: NotificationOptions) { FakeNotification.calls.push([title, options]); }
}

function setup(permission: NotificationPermission) {
  FakeNotification.permission = permission;
  FakeNotification.calls = [];
  vi.stubGlobal('Notification', FakeNotification);
  vi.stubGlobal('window', { ...(globalThis as object), Notification: FakeNotification, focus: vi.fn(), open: vi.fn(), location: { hash: '' } });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('device notices carry the ArthaMind logo', () => {
  it('uses the ArthaMind logo as icon and badge', () => {
    setup('granted');
    const shown = showDeviceNotice({ id: 'n1', title: 'EMIs take 52% of your take-home', body: 'Above the safe 40% limit.', to: 'budgeting' });
    expect(shown).toBe(true);
    const [title, options] = FakeNotification.calls[0];
    expect(title.startsWith('ArthaMind · ')).toBe(true);
    expect(options.icon).toBe(ARTHAMIND_NOTICE_ICON);
    expect(options.badge).toBe(ARTHAMIND_NOTICE_BADGE);
    expect(ARTHAMIND_NOTICE_ICON).toMatch(/^\/brand\/arthamind-\d+\.png$/);
  });

  it('does not show anything without permission', () => {
    setup('default');
    expect(showDeviceNotice({ id: 'n2', title: 'x', body: 'y' })).toBe(false);
    expect(FakeNotification.calls).toHaveLength(0);
  });

  it('does nothing when the browser has no notifications', () => {
    vi.stubGlobal('window', {});
    expect(showDeviceNotice({ id: 'n3', title: 'x', body: 'y' })).toBe(false);
  });
});
