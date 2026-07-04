/**
 * Joshua & Lucia Wedding — RSVP Backend
 * =====================================
 * Runs as a Google Apps Script Web App. 100% free (Google account only).
 *
 * What it does:
 *  - Receives RSVPs from the website and stores them in a Google Sheet
 *  - Builds a live Dashboard tab with all the numbers you care about
 *  - Sends email blasts (free via Gmail) and SMS blasts (via Twilio, optional)
 *  - Generates WhatsApp click-to-chat links (free way to text Ghana numbers)
 *  - Sends automatic countdown reminders (30/14/7/1 days before, editable)
 *  - "Go Live" button: saves the livestream link, flips the website to LIVE,
 *    and notifies everyone who asked to be pinged
 *
 * SETUP (one time, ~10 minutes) — full guide in the repo README:
 *  1. Go to script.new, paste this file as Code.gs and Admin.html as a new HTML file
 *  2. Run the `setup` function once (authorize when prompted)
 *  3. Check the execution log — it prints your Sheet URL and Admin key
 *  4. Deploy > New deployment > Web app > Execute as: Me, Access: Anyone
 *  5. Paste the web app URL into js/config.js on the website
 */

// ---------------------------------------------------------------------------
// CONFIG — edit these before running setup()
// ---------------------------------------------------------------------------

var CONFIG = {
  COUPLE_NAMES: 'Joshua & Lucia',
  WEDDING_DATE: '2026-11-07',           // yyyy-MM-dd
  WEDDING_TIME: '9:30 AM',
  TIMEZONE: 'Africa/Accra',             // Ghana time (GMT)
  VENUE: 'Anagkazo Campus, Mampong-Akuapem, Ghana',
  SPREADSHEET_NAME: 'Joshua & Lucia Wedding — RSVPs',
  // Where test messages and error alerts go:
  COUPLE_EMAIL: Session.getActiveUser().getEmail() || '',
  COUPLE_PHONE: ''                      // e.g. +14045551234 — used by "send test SMS"
};

var SHEETS = { RSVP: 'RSVPs', DASH: 'Dashboard', SETTINGS: 'Settings', TEMPLATES: 'Reminder Templates', LOG: 'Message Log' };

var RSVP_HEADERS = ['Timestamp', 'Full Name', 'Email', 'Phone', 'Country', 'Attending', 'Guests', 'Preferred Contact', 'Notify When Live', 'Message to Couple', 'Status'];
var COL = { TS: 1, NAME: 2, EMAIL: 3, PHONE: 4, COUNTRY: 5, ATTENDING: 6, GUESTS: 7, CONTACT: 8, NOTIFY: 9, MESSAGE: 10, STATUS: 11 };

// ---------------------------------------------------------------------------
// SETUP — run this once
// ---------------------------------------------------------------------------

function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss;
  var existingId = props.getProperty('SPREADSHEET_ID');
  if (existingId) {
    try { ss = SpreadsheetApp.openById(existingId); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }
  ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);

  setupRsvpSheet_(ss);
  setupSettingsSheet_(ss);
  setupTemplatesSheet_(ss);
  setupLogSheet_(ss);
  setupDashboard_(ss);
  installDailyTrigger_();

  var key = getSetting_('ADMIN_KEY');
  Logger.log('==============================================');
  Logger.log('SETUP COMPLETE ✅');
  Logger.log('Your Google Sheet: ' + ss.getUrl());
  Logger.log('Your admin key: ' + key);
  Logger.log('Next: Deploy > New deployment > Web app (Execute as Me, Anyone has access)');
  Logger.log('Admin dashboard will be at: <web app url>?action=admin&key=' + key);
  Logger.log('==============================================');
  return ss.getUrl();
}

function setupRsvpSheet_(ss) {
  var sh = getOrCreateSheet_(ss, SHEETS.RSVP);
  if (sh.getLastRow() === 0) {
    sh.appendRow(RSVP_HEADERS);
  }
  var header = sh.getRange(1, 1, 1, RSVP_HEADERS.length);
  header.setFontWeight('bold').setBackground('#1e3d2f').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, RSVP_HEADERS.length, 150);
  sh.setColumnWidth(COL.MESSAGE, 300);
}

function setupSettingsSheet_(ss) {
  var sh = getOrCreateSheet_(ss, SHEETS.SETTINGS);
  if (sh.getLastRow() > 0) return; // don't overwrite existing settings
  var adminKey = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  var rows = [
    ['Setting', 'Value', 'Notes'],
    ['ADMIN_KEY', adminKey, 'Secret key for the admin dashboard. Keep private.'],
    ['LIVESTREAM_URL', '', 'Paste the YouTube/Facebook live link here (or use the Go Live button in admin)'],
    ['IS_LIVE', 'NO', 'YES = website shows the Watch Live button'],
    ['WEBSITE_URL', '', 'Your GitHub Pages URL, e.g. https://username.github.io/wedding'],
    ['COUPLE_EMAIL', CONFIG.COUPLE_EMAIL, 'Test messages and daily digests go here'],
    ['COUPLE_PHONE', CONFIG.COUPLE_PHONE, 'For test SMS, in +233… or +1… format'],
    ['TWILIO_SID', '', 'Optional — from twilio.com console, enables SMS'],
    ['TWILIO_AUTH_TOKEN', '', 'Optional — Twilio auth token'],
    ['TWILIO_FROM', '', 'Optional — your Twilio phone number, e.g. +18445551234'],
    ['SENT_MILESTONES', '', 'Auto-managed: reminder milestones already sent'],
    ['DAILY_DIGEST', 'YES', 'YES = email the couple a daily summary of new RSVPs']
  ];
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1e3d2f').setFontColor('#ffffff');
  sh.setColumnWidth(1, 180); sh.setColumnWidth(2, 320); sh.setColumnWidth(3, 420);
  sh.setFrozenRows(1);
}

function setupTemplatesSheet_(ss) {
  var sh = getOrCreateSheet_(ss, SHEETS.TEMPLATES);
  if (sh.getLastRow() > 0) return;
  var d = '{{date}}', v = '{{venue}}';
  var rows = [
    ['Days Before', 'Enabled', 'Email Subject', 'Email Body', 'SMS Body'],
    [30, 'YES', 'One month to go! 💍 Joshua & Lucia',
      'Hi {{name}},\n\nJust one month until the big day! Joshua & Lucia are getting married on ' + d + ' at ' + v + '.\n\nIf your plans have changed you can update your RSVP anytime on our website: {{website}}\n\nWith love,\nJoshua & Lucia',
      'Hi {{name}}! One month until Joshua & Lucia\'s wedding — ' + d + ' at ' + v + '. Details: {{website}}'],
    [14, 'YES', 'Two weeks away — Joshua & Lucia\'s wedding',
      'Hi {{name}},\n\nTwo weeks to go! We can\'t wait to celebrate with you on ' + d + ' at ' + v + ', starting at {{time}}.\n\nTravel tips and details: {{website}}\n\nJoshua & Lucia',
      'Hi {{name}}! 2 weeks until Joshua & Lucia\'s wedding, ' + d + ' at {{time}}. Info: {{website}}'],
    [7, 'YES', 'One week! 🎉 Joshua & Lucia',
      'Hi {{name}},\n\nIt\'s wedding week! We are getting married this Saturday, ' + d + ', at ' + v + '. The ceremony starts at {{time}} sharp.\n\nJoining online? The livestream link will appear at {{website}} when we go live.\n\nSee you soon!\nJoshua & Lucia',
      'Hi {{name}}! Joshua & Lucia get married THIS Saturday at {{time}}, ' + v + '. Livestream + details: {{website}}'],
    [1, 'YES', 'Tomorrow is the day! — Joshua & Lucia',
      'Hi {{name}},\n\nTomorrow\'s the day! The ceremony begins at {{time}} at ' + v + '.\n\nComing in person: please arrive by 9:00 AM.\nWatching online: the live link will be at {{website}} — we\'ll also send it to you when we go live.\n\nWith love,\nJoshua & Lucia',
      'Tomorrow! Joshua & Lucia\'s wedding, {{time}} at ' + v + '. Arrive by 9AM. Live link: {{website}}']
  ];
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1e3d2f').setFontColor('#ffffff');
  sh.setColumnWidth(3, 280); sh.setColumnWidth(4, 500); sh.setColumnWidth(5, 400);
  sh.setFrozenRows(1);
}

function setupLogSheet_(ss) {
  var sh = getOrCreateSheet_(ss, SHEETS.LOG);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Timestamp', 'Channel', 'Audience', 'Subject / Preview', 'Sent', 'Failed', 'Notes']);
    sh.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#1e3d2f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
}

function setupDashboard_(ss) {
  var sh = getOrCreateSheet_(ss, SHEETS.DASH);
  sh.clear();
  var R = "'" + SHEETS.RSVP + "'";
  var rows = [
    ['JOSHUA & LUCIA — WEDDING DASHBOARD', '', '', ''],
    ['Wedding: ' + CONFIG.WEDDING_DATE + ' at ' + CONFIG.WEDDING_TIME + ' — ' + CONFIG.VENUE, '', '', ''],
    ['Days to go', '=MAX(0, DATE(2026,11,7)-TODAY())', '', ''],
    ['', '', '', ''],
    ['RESPONSES', '', 'CONTACT PREFERENCES', ''],
    ['Total RSVPs', '=COUNTA(' + R + '!B2:B)', 'Prefer Email', '=COUNTIF(' + R + '!H2:H,"Email")'],
    ['Attending in person', '=COUNTIF(' + R + '!F2:F,"In person")', 'Prefer SMS', '=COUNTIF(' + R + '!H2:H,"SMS")'],
    ['Joining online', '=COUNTIF(' + R + '!F2:F,"Online")', 'Prefer WhatsApp', '=COUNTIF(' + R + '!H2:H,"WhatsApp")'],
    ['Can\'t attend', '=COUNTIF(' + R + '!F2:F,"Not attending")', '', ''],
    ['Total in-person guests (incl. +1s)', '=SUMIF(' + R + '!F2:F,"In person",' + R + '!G2:G)', 'PHONE NUMBERS', ''],
    ['Want livestream alert', '=COUNTIF(' + R + '!I2:I,"Yes")', 'Ghana numbers (+233)', '=COUNTIF(' + R + '!E2:E,"Ghana")'],
    ['', '', 'US numbers (+1)', '=COUNTIF(' + R + '!E2:E,"USA")'],
    ['RSVPs in last 7 days', '=COUNTIF(' + R + '!A2:A,">"&TODAY()-7)', 'Other countries', '=COUNTIFS(' + R + '!E2:E,"<>Ghana",' + R + '!E2:E,"<>USA",' + R + '!E2:E,"<>")'],
    ['', '', '', ''],
    ['LATEST RSVPS', '', '', ''],
    ['=IFERROR(QUERY(' + R + '!A2:F, "select B, C, F order by A desc limit 10 label B \'Name\', C \'Email\', F \'Attending\'"), "No RSVPs yet")', '', '', '']
  ];
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  sh.getRange('A1').setFontSize(16).setFontWeight('bold');
  sh.getRange('A3:B3').setFontSize(14).setFontWeight('bold').setFontColor('#c47a3d');
  ['A5', 'C5', 'C10', 'A15'].forEach(function (a1) {
    sh.getRange(a1).setFontWeight('bold').setBackground('#1e3d2f').setFontColor('#ffffff');
  });
  sh.getRange('B6:B13').setFontWeight('bold');
  sh.getRange('D6:D13').setFontWeight('bold');
  sh.setColumnWidth(1, 260); sh.setColumnWidth(2, 120); sh.setColumnWidth(3, 220); sh.setColumnWidth(4, 120);
}

function installDailyTrigger_() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'dailyReminderCheck';
  });
  if (!exists) {
    ScriptApp.newTrigger('dailyReminderCheck').timeBased().everyDays(1).atHour(9).create();
  }
}

// ---------------------------------------------------------------------------
// WEB APP ENDPOINTS
// ---------------------------------------------------------------------------

/** GET: ?action=config (public, used by the website) | ?action=admin&key=… (dashboard) */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'status';

  if (action === 'config') {
    return json_({
      ok: true,
      isLive: getSetting_('IS_LIVE').toUpperCase() === 'YES',
      livestreamUrl: getSetting_('LIVESTREAM_URL'),
      weddingDate: CONFIG.WEDDING_DATE,
      weddingTime: CONFIG.WEDDING_TIME
    });
  }

  if (action === 'admin') {
    if (!checkKey_(e.parameter.key)) {
      return HtmlService.createHtmlOutput('<h3>Wrong or missing admin key.</h3>');
    }
    var t = HtmlService.createTemplateFromFile('Admin');
    t.adminKey = e.parameter.key;
    return t.evaluate().setTitle('J&L Wedding Admin').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return json_({ ok: true, service: 'Joshua & Lucia RSVP backend', time: new Date().toISOString() });
}

/** POST: RSVP submissions from the website (application/x-www-form-urlencoded → no CORS preflight) */
function doPost(e) {
  try {
    var p = e.parameter || {};
    var name = String(p.name || '').trim();
    var email = String(p.email || '').trim().toLowerCase();
    var phoneRaw = String(p.phone || '').trim();
    var countryCode = String(p.countryCode || '').trim(); // '+233', '+1', or 'other'
    var attending = String(p.attending || '').trim();     // 'In person' | 'Online' | 'Not attending'
    var guests = Math.max(1, Math.min(10, parseInt(p.guests, 10) || 1));
    var contact = String(p.preferredContact || 'Email').trim();
    var notify = String(p.notifyLive || 'No') === 'Yes' ? 'Yes' : 'No';
    var message = String(p.message || '').trim().slice(0, 1000);

    if (!name || !email || !attending) {
      return json_({ ok: false, error: 'Please fill in your name, email, and whether you can attend.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json_({ ok: false, error: 'That email address doesn\'t look right.' });
    }

    var norm = normalizePhone_(phoneRaw, countryCode);

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sh = rsvpSheet_();
      var existingRow = findRowByEmail_(sh, email);
      var rowValues = [new Date(), name, email, norm.phone, norm.country, attending, attending === 'In person' ? guests : 0, contact, notify, message, existingRow ? 'Updated' : 'New'];
      var updated = false;
      if (existingRow) {
        sh.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
        updated = true;
      } else {
        sh.appendRow(rowValues);
      }
      sendConfirmation_(name, email, attending);
      return json_({ ok: true, updated: updated });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: 'Something went wrong on our side. Please try again. (' + err.message + ')' });
  }
}

function sendConfirmation_(name, email, attending) {
  try {
    var lines = {
      'In person': 'We can\'t wait to see you at ' + CONFIG.VENUE + ' on Saturday, November 7, 2026 at ' + CONFIG.WEDDING_TIME + '. Please plan to arrive by 9:00 AM.',
      'Online': 'We\'re so glad you\'ll join us online! The livestream link will appear on our website on the day, and we\'ll send it to you when we go live.',
      'Not attending': 'We\'ll miss you — thank you for letting us know, and for your love and prayers.'
    };
    MailApp.sendEmail({
      to: email,
      subject: 'RSVP received 💍 — Joshua & Lucia, November 7, 2026',
      body: 'Hi ' + name + ',\n\nThank you — your RSVP is confirmed!\n\n' + (lines[attending] || '') +
        '\n\nNeed to change anything? Just submit the RSVP form again with the same email and we\'ll update it.' +
        '\n\nWith love,\nJoshua & Lucia',
      name: CONFIG.COUPLE_NAMES
    });
  } catch (e) { /* over quota or bad address — RSVP is still saved */ }
}

// ---------------------------------------------------------------------------
// PHONE NORMALIZATION (Ghana + US aware)
// ---------------------------------------------------------------------------

function normalizePhone_(raw, countryCode) {
  var digits = String(raw).replace(/[^\d+]/g, '');
  if (!digits) return { phone: '', country: '' };

  if (digits.indexOf('+') === 0) {
    // already international
  } else if (countryCode === '+233') {
    digits = '+233' + digits.replace(/^0/, '');
  } else if (countryCode === '+1') {
    digits = '+1' + digits.replace(/^1/, '');
  } else if (/^0\d{9}$/.test(digits)) {
    digits = '+233' + digits.slice(1);          // Ghana local format 0XXXXXXXXX
  } else if (/^\d{10}$/.test(digits)) {
    digits = '+1' + digits;                      // bare 10-digit US number
  } else {
    digits = '+' + digits;
  }

  var country = digits.indexOf('+233') === 0 ? 'Ghana' : digits.indexOf('+1') === 0 ? 'USA' : 'Other';
  return { phone: digits, country: country };
}

// ---------------------------------------------------------------------------
// MESSAGING — the heart of the reminder system
// ---------------------------------------------------------------------------

/**
 * Send a message blast.
 * opts = {
 *   audience: 'all' | 'inperson' | 'online' | 'notifylive' | 'ghana' | 'usa',
 *   channel:  'preferred' | 'email' | 'sms',
 *   subject:  'Email subject',
 *   body:     'Message with {{name}}, {{date}}, {{time}}, {{venue}}, {{website}}, {{livestream}} merge tags',
 *   smsBody:  optional shorter text used for SMS (falls back to body)
 * }
 */
function sendBlast(opts) {
  var guests = getGuests_().filter(audienceFilter_(opts.audience || 'all'));
  var sent = 0, failed = 0, notes = [];
  var smsReady = twilioConfigured_();

  guests.forEach(function (g) {
    var wantsSms = opts.channel === 'sms' || (opts.channel === 'preferred' && (g.contact === 'SMS' || g.contact === 'WhatsApp'));
    var body = merge_(opts.body, g);
    try {
      if (wantsSms && smsReady && g.phone) {
        sendSms_(g.phone, opts.smsBody ? merge_(opts.smsBody, g) : body);
        sent++;
      } else if (wantsSms && !smsReady && g.email) {
        // No Twilio configured — fall back to email so nobody is missed
        MailApp.sendEmail({ to: g.email, subject: merge_(opts.subject || 'Joshua & Lucia', g), body: body, name: CONFIG.COUPLE_NAMES });
        sent++;
        notes.push('sms→email fallback: ' + g.name);
      } else if (g.email) {
        MailApp.sendEmail({ to: g.email, subject: merge_(opts.subject || 'Joshua & Lucia', g), body: body, name: CONFIG.COUPLE_NAMES });
        sent++;
      } else {
        failed++;
        notes.push('no valid contact: ' + g.name);
      }
    } catch (err) {
      failed++;
      notes.push(g.name + ': ' + err.message);
    }
  });

  logMessage_(opts.channel, opts.audience, opts.subject || String(opts.body).slice(0, 60), sent, failed, notes.slice(0, 10).join(' | '));
  return { sent: sent, failed: failed, total: guests.length, notes: notes.slice(0, 10) };
}

function sendSms_(to, body) {
  var sid = getSetting_('TWILIO_SID'), token = getSetting_('TWILIO_AUTH_TOKEN'), from = getSetting_('TWILIO_FROM');
  var resp = UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
    method: 'post',
    payload: { To: to, From: from, Body: body.slice(0, 320) },
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) {
    throw new Error('Twilio ' + resp.getResponseCode() + ': ' + JSON.parse(resp.getContentText()).message);
  }
}

function twilioConfigured_() {
  return !!(getSetting_('TWILIO_SID') && getSetting_('TWILIO_AUTH_TOKEN') && getSetting_('TWILIO_FROM'));
}

/** Free path for Ghana: build wa.me click-to-chat links with the message pre-filled. */
function getWhatsAppLinks(key, message, audience) {
  requireKey_(key);
  return getGuests_()
    .filter(audienceFilter_(audience || 'all'))
    .filter(function (g) { return g.phone; })
    .map(function (g) {
      return {
        name: g.name,
        phone: g.phone,
        url: 'https://wa.me/' + g.phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(merge_(message, g))
      };
    });
}

// ---------------------------------------------------------------------------
// GO LIVE — flips the website + notifies opt-ins
// ---------------------------------------------------------------------------

function goLive(key, livestreamUrl, announce) {
  requireKey_(key);
  setSetting_('LIVESTREAM_URL', livestreamUrl);
  setSetting_('IS_LIVE', 'YES');
  if (!announce) return { sent: 0, failed: 0, total: 0, notes: ['Saved. Website is now LIVE (no messages sent).'] };
  return sendBlast({
    audience: 'notifylive',
    channel: 'preferred',
    subject: '🔴 We\'re LIVE — Joshua & Lucia\'s wedding!',
    body: 'Hi {{name}}, the wedding is starting! Watch Joshua & Lucia say "I do" live right now:\n\n{{livestream}}\n\nWith love, J & L'
  });
}

function endLive(key) {
  requireKey_(key);
  setSetting_('IS_LIVE', 'NO');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// AUTOMATIC REMINDERS — runs daily via trigger
// ---------------------------------------------------------------------------

function dailyReminderCheck() {
  var today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var daysLeft = Math.round((parseDate_(CONFIG.WEDDING_DATE) - parseDate_(today)) / 86400000);
  if (daysLeft < 0) return;

  var sentList = getSetting_('SENT_MILESTONES').split(',').filter(String);
  var sh = sheet_(SHEETS.TEMPLATES);
  var data = sh.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var daysBefore = parseInt(data[i][0], 10);
    var enabled = String(data[i][1]).toUpperCase() === 'YES';
    if (!enabled || daysBefore !== daysLeft || sentList.indexOf(String(daysBefore)) !== -1) continue;

    var result = sendBlast({
      audience: 'attending',
      channel: 'preferred',
      subject: data[i][2],
      body: data[i][3],
      smsBody: data[i][4]
    });
    sentList.push(String(daysBefore));
    setSetting_('SENT_MILESTONES', sentList.join(','));
    notifyCouple_('Reminder sent (' + daysBefore + ' days before): ' + result.sent + ' delivered, ' + result.failed + ' failed.');
  }

  maybeSendDailyDigest_();
}

function maybeSendDailyDigest_() {
  if (getSetting_('DAILY_DIGEST').toUpperCase() !== 'YES') return;
  var guests = getGuests_();
  var cutoff = new Date(Date.now() - 86400000);
  var fresh = guests.filter(function (g) { return g.timestamp && g.timestamp > cutoff; });
  if (!fresh.length) return;
  var inPerson = guests.filter(function (g) { return g.attending === 'In person'; }).length;
  var online = guests.filter(function (g) { return g.attending === 'Online'; }).length;
  notifyCouple_(
    fresh.length + ' new RSVP(s) in the last 24h:\n\n' +
    fresh.map(function (g) { return '• ' + g.name + ' — ' + g.attending + (g.message ? ' — "' + g.message + '"' : ''); }).join('\n') +
    '\n\nTotals so far: ' + guests.length + ' responses | ' + inPerson + ' in person | ' + online + ' online'
  );
}

function notifyCouple_(body) {
  var to = getSetting_('COUPLE_EMAIL');
  if (!to) return;
  try {
    MailApp.sendEmail({ to: to, subject: '💍 Wedding site update', body: body, name: 'Wedding Bot' });
  } catch (e) { /* quota */ }
}

// ---------------------------------------------------------------------------
// ADMIN API (called from Admin.html via google.script.run)
// ---------------------------------------------------------------------------

function getAdminData(key) {
  requireKey_(key);
  var guests = getGuests_();
  var count = function (fn) { return guests.filter(fn).length; };
  return {
    weddingDate: CONFIG.WEDDING_DATE,
    daysLeft: Math.max(0, Math.round((parseDate_(CONFIG.WEDDING_DATE) - Date.now()) / 86400000)),
    isLive: getSetting_('IS_LIVE').toUpperCase() === 'YES',
    livestreamUrl: getSetting_('LIVESTREAM_URL'),
    twilioConfigured: twilioConfigured_(),
    emailQuotaLeft: MailApp.getRemainingDailyQuota(),
    sheetUrl: SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')).getUrl(),
    stats: {
      total: guests.length,
      inPerson: count(function (g) { return g.attending === 'In person'; }),
      online: count(function (g) { return g.attending === 'Online'; }),
      notAttending: count(function (g) { return g.attending === 'Not attending'; }),
      totalGuests: guests.reduce(function (s, g) { return s + (g.attending === 'In person' ? g.guests : 0); }, 0),
      notifyLive: count(function (g) { return g.notify === 'Yes'; }),
      ghana: count(function (g) { return g.country === 'Ghana'; }),
      usa: count(function (g) { return g.country === 'USA'; }),
      preferEmail: count(function (g) { return g.contact === 'Email'; }),
      preferSms: count(function (g) { return g.contact === 'SMS'; }),
      preferWhatsApp: count(function (g) { return g.contact === 'WhatsApp'; })
    },
    guests: guests.map(function (g) {
      return { name: g.name, email: g.email, phone: g.phone, country: g.country, attending: g.attending, guests: g.guests, contact: g.contact, notify: g.notify, message: g.message };
    }).reverse()
  };
}

function sendBlastApi(key, opts) {
  requireKey_(key);
  return sendBlast(opts);
}

function sendTestApi(key, opts) {
  requireKey_(key);
  var me = { name: 'Test Guest', email: getSetting_('COUPLE_EMAIL'), phone: getSetting_('COUPLE_PHONE'), contact: 'Email', country: '', attending: 'In person', guests: 1, notify: 'Yes', message: '' };
  var body = merge_(opts.body, me);
  var result = { email: null, sms: null };
  if (opts.channel === 'email' || opts.channel === 'preferred') {
    MailApp.sendEmail({ to: me.email, subject: '[TEST] ' + merge_(opts.subject || 'Test', me), body: body, name: CONFIG.COUPLE_NAMES });
    result.email = 'sent to ' + me.email;
  }
  if (opts.channel === 'sms') {
    if (!twilioConfigured_()) throw new Error('Twilio not configured yet — add TWILIO_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM in the Settings tab.');
    if (!me.phone) throw new Error('Add COUPLE_PHONE in the Settings tab first.');
    sendSms_(me.phone, body);
    result.sms = 'sent to ' + me.phone;
  }
  return result;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function getGuests_() {
  var sh = rsvpSheet_();
  if (sh.getLastRow() < 2) return [];
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, RSVP_HEADERS.length).getValues();
  return data.map(function (r) {
    return {
      timestamp: r[COL.TS - 1], name: r[COL.NAME - 1], email: String(r[COL.EMAIL - 1]).trim(),
      phone: String(r[COL.PHONE - 1]).trim(), country: r[COL.COUNTRY - 1], attending: r[COL.ATTENDING - 1],
      guests: Number(r[COL.GUESTS - 1]) || 0, contact: r[COL.CONTACT - 1], notify: r[COL.NOTIFY - 1],
      message: r[COL.MESSAGE - 1]
    };
  }).filter(function (g) { return g.name; });
}

function audienceFilter_(audience) {
  switch (audience) {
    case 'inperson': return function (g) { return g.attending === 'In person'; };
    case 'online': return function (g) { return g.attending === 'Online'; };
    case 'attending': return function (g) { return g.attending === 'In person' || g.attending === 'Online'; };
    case 'notifylive': return function (g) { return g.notify === 'Yes'; };
    case 'ghana': return function (g) { return g.country === 'Ghana'; };
    case 'usa': return function (g) { return g.country === 'USA'; };
    default: return function () { return true; };
  }
}

function merge_(text, g) {
  return String(text || '')
    .replace(/\{\{name\}\}/g, g.name ? String(g.name).split(' ')[0] : 'friend')
    .replace(/\{\{fullname\}\}/g, g.name || 'friend')
    .replace(/\{\{date\}\}/g, 'Saturday, November 7, 2026')
    .replace(/\{\{time\}\}/g, CONFIG.WEDDING_TIME)
    .replace(/\{\{venue\}\}/g, CONFIG.VENUE)
    .replace(/\{\{website\}\}/g, getSetting_('WEBSITE_URL') || '')
    .replace(/\{\{livestream\}\}/g, getSetting_('LIVESTREAM_URL') || '');
}

function logMessage_(channel, audience, preview, sent, failed, notes) {
  sheet_(SHEETS.LOG).appendRow([new Date(), channel, audience, preview, sent, failed, notes || '']);
}

function findRowByEmail_(sh, email) {
  if (sh.getLastRow() < 2) return 0;
  var emails = sh.getRange(2, COL.EMAIL, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < emails.length; i++) {
    if (String(emails[i][0]).trim().toLowerCase() === email) return i + 2;
  }
  return 0;
}

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Run setup() first.');
  return SpreadsheetApp.openById(id);
}
function sheet_(name) { return ss_().getSheetByName(name); }
function rsvpSheet_() { return sheet_(SHEETS.RSVP); }
function getOrCreateSheet_(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }

function getSetting_(key) {
  var sh = sheet_(SHEETS.SETTINGS);
  var data = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 2).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) return String(data[i][1] || '').trim();
  }
  return '';
}

function setSetting_(key, value) {
  var sh = sheet_(SHEETS.SETTINGS);
  var data = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) { sh.getRange(i + 2, 2).setValue(value); return; }
  }
  sh.appendRow([key, value, '']);
}

function checkKey_(key) { return key && key === getSetting_('ADMIN_KEY'); }
function requireKey_(key) { if (!checkKey_(key)) throw new Error('Invalid admin key.'); }
function parseDate_(ymd) { var p = ymd.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getTime(); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
