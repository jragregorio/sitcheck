(function (global) {
  const CONTRIBUTION_REMINDER_SETTINGS_KEY = "sitcheck-contribution-reminder-settings";
  const CONTRIBUTION_REMINDER_NOTICE_SEEN_KEY = "sitcheck-contribution-reminder-notice-seen";
  const CONTRIBUTION_REMINDER_NOTIFICATION_ID = 4001;
  const CONTRIBUTION_REMINDER_CHANNEL_ID = "contribution-reminders";
  const CONTRIBUTION_REMINDER_DELAY_MS = 12 * 60 * 60 * 1000;
  const DEFAULT_SETTINGS = {
    enabled: true
  };

  let appStateListener = null;
  let notificationActionListener = null;
  let channelReady = false;

  function getCapacitor() {
    return global.Capacitor || null;
  }

  function isNativePlatform() {
    const capacitor = getCapacitor();
    return Boolean(capacitor && typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform());
  }

  function getPlugin(name) {
    const capacitor = getCapacitor();
    if (!capacitor || !isNativePlatform()) {
      return null;
    }

    if (capacitor.Plugins && capacitor.Plugins[name]) {
      return capacitor.Plugins[name];
    }

    if (typeof capacitor.registerPlugin === "function") {
      return capacitor.registerPlugin(name);
    }

    return null;
  }

  function loadSettings() {
    try {
      const raw = global.localStorage.getItem(CONTRIBUTION_REMINDER_SETTINGS_KEY);
      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }

      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled === true
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      global.localStorage.setItem(
        CONTRIBUTION_REMINDER_SETTINGS_KEY,
        JSON.stringify({
          enabled: settings.enabled === true
        })
      );
    } catch {
      // Ignore storage failures.
    }
  }

  function isContributionReminderEnabled() {
    return loadSettings().enabled === true;
  }

  function setContributionReminderEnabled(enabled) {
    saveSettings({ enabled: Boolean(enabled) });
  }

  async function ensureNotificationChannel() {
    const LocalNotifications = getPlugin("LocalNotifications");
    if (!LocalNotifications || channelReady) {
      return;
    }

    try {
      await LocalNotifications.createChannel({
        id: CONTRIBUTION_REMINDER_CHANNEL_ID,
        name: "Contribution reminders",
        description: "Occasional reminders to add restroom listings",
        importance: 3,
        visibility: 1
      });
    } catch {
      // Channel may already exist.
    }

    channelReady = true;
  }

  async function checkNotificationPermission() {
    const LocalNotifications = getPlugin("LocalNotifications");
    if (!LocalNotifications) {
      return "denied";
    }

    try {
      const result = await LocalNotifications.checkPermissions();
      return result.display || "denied";
    } catch {
      return "denied";
    }
  }

  async function requestNotificationPermission() {
    const LocalNotifications = getPlugin("LocalNotifications");
    if (!LocalNotifications) {
      return "denied";
    }

    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display || "denied";
    } catch {
      return "denied";
    }
  }

  async function cancelContributionReminder() {
    const LocalNotifications = getPlugin("LocalNotifications");
    if (!LocalNotifications) {
      return;
    }

    try {
      await LocalNotifications.cancel({
        notifications: [{ id: CONTRIBUTION_REMINDER_NOTIFICATION_ID }]
      });
    } catch {
      // Ignore cancel failures.
    }
  }

  async function scheduleContributionReminder() {
    const LocalNotifications = getPlugin("LocalNotifications");
    if (!LocalNotifications || !isContributionReminderEnabled()) {
      return false;
    }

    const permission = await checkNotificationPermission();
    if (permission !== "granted") {
      return false;
    }

    await ensureNotificationChannel();
    await cancelContributionReminder();

    const at = new Date(Date.now() + CONTRIBUTION_REMINDER_DELAY_MS);

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: CONTRIBUTION_REMINDER_NOTIFICATION_ID,
            title: "Help grow SitCheck",
            body: "Know a restroom worth listing? Open the app to add one for the community.",
            schedule: {
              at,
              allowWhileIdle: true
            },
            channelId: CONTRIBUTION_REMINDER_CHANNEL_ID,
            extra: {
              openAdd: true
            }
          }
        ]
      });
      return true;
    } catch {
      return false;
    }
  }

  function openAddToiletFromReminder() {
    try {
      const url = new URL(global.location.href);
      if (!/index\.html?$/i.test(url.pathname) && !url.pathname.endsWith("/")) {
        url.pathname = url.pathname.replace(/[^/]*$/, "index.html");
      }
      url.searchParams.set("add", "1");
      global.location.href = url.toString();
    } catch {
      global.location.href = "index.html?add=1";
    }
  }

  async function enableContributionReminders() {
    if (!isNativePlatform()) {
      setContributionReminderEnabled(false);
      return {
        ok: false,
        reason: "native-only",
        message: "Contribution reminders are available in the Android app."
      };
    }

    let permission = await checkNotificationPermission();
    if (permission !== "granted") {
      permission = await requestNotificationPermission();
    }

    if (permission !== "granted") {
      setContributionReminderEnabled(false);
      await cancelContributionReminder();
      return {
        ok: false,
        reason: "permission-denied",
        message: "Notification permission is required for contribution reminders."
      };
    }

    setContributionReminderEnabled(true);
    await ensureNotificationChannel();
    await scheduleContributionReminder();
    return { ok: true };
  }

  async function disableContributionReminders() {
    setContributionReminderEnabled(false);
    await cancelContributionReminder();
    return { ok: true };
  }

  async function bindNotificationTapHandler() {
    const LocalNotifications = getPlugin("LocalNotifications");
    if (!LocalNotifications || notificationActionListener) {
      return;
    }

    try {
      notificationActionListener = await LocalNotifications.addListener(
        "localNotificationActionPerformed",
        (event) => {
          const extra = event?.notification?.extra || {};
          if (extra.openAdd) {
            openAddToiletFromReminder();
          }
        }
      );
    } catch {
      // Ignore listener setup failures.
    }
  }

  async function bindAppStateHandler() {
    const App = getPlugin("App");
    if (!App || appStateListener) {
      return;
    }

    try {
      appStateListener = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          void cancelContributionReminder();
          return;
        }

        void scheduleContributionReminder();
      });
    } catch {
      // Ignore listener setup failures.
    }
  }

  function hasSeenContributionReminderNotice() {
    try {
      return global.localStorage.getItem(CONTRIBUTION_REMINDER_NOTICE_SEEN_KEY) === "1";
    } catch {
      return false;
    }
  }

  function markContributionReminderNoticeSeen() {
    try {
      global.localStorage.setItem(CONTRIBUTION_REMINDER_NOTICE_SEEN_KEY, "1");
    } catch {
      // Ignore storage failures.
    }
  }

  function shouldShowContributionReminderNotice() {
    return (
      isNativePlatform() &&
      isContributionReminderEnabled() &&
      !hasSeenContributionReminderNotice()
    );
  }

  function showContributionReminderNoticeIfNeeded(showToastFn) {
    if (!shouldShowContributionReminderNotice() || typeof showToastFn !== "function") {
      return;
    }

    markContributionReminderNoticeSeen();
    showToastFn(
      "Reminders on (~12h). Disable anytime in Options.",
      "success"
    );
  }

  async function initContributionReminders() {
    if (!isNativePlatform()) {
      return;
    }

    await bindAppStateHandler();
    await bindNotificationTapHandler();
    await cancelContributionReminder();

    if (isContributionReminderEnabled()) {
      await ensureNotificationChannel();

      const permission = await checkNotificationPermission();
      if (permission !== "granted") {
        await requestNotificationPermission();
      }
    }
  }

  global.SitCheckContributionReminders = {
    SETTINGS_KEY: CONTRIBUTION_REMINDER_SETTINGS_KEY,
    NOTICE_SEEN_KEY: CONTRIBUTION_REMINDER_NOTICE_SEEN_KEY,
    DELAY_MS: CONTRIBUTION_REMINDER_DELAY_MS,
    isNativePlatform,
    isEnabled: isContributionReminderEnabled,
    enable: enableContributionReminders,
    disable: disableContributionReminders,
    schedule: scheduleContributionReminder,
    cancel: cancelContributionReminder,
    init: initContributionReminders,
    loadSettings,
    openAddToiletFromReminder,
    showNoticeIfNeeded: showContributionReminderNoticeIfNeeded
  };
})(typeof window !== "undefined" ? window : globalThis);
