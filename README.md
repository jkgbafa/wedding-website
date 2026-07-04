# Joshua & Lucia — Wedding Website 💍

Saturday, November 7, 2026 · 9:30 AM · Anagkazo Campus, Mampong-Akuapem, Ghana

A free, self-hosted version of what The Knot / Zola charge for:

| The Knot feature | This site |
|---|---|
| Wedding website + RSVP form | GitHub Pages (free) |
| Guest list that syncs with RSVPs | Google Sheet, updated instantly |
| RSVP dashboard (counts, meals, etc.) | **Dashboard tab** in the Sheet + web **Admin panel** |
| "Guest Messages" reminder tool | Admin panel → send email / SMS / WhatsApp blasts |
| RSVP confirmation emails | Automatic, free via Gmail |
| Livestream page | Built in — flips to LIVE with one button, and messages everyone who opted in |
| Automatic countdown reminders | 30 / 14 / 7 / 1 days before (editable templates) |

**Total cost: $0** — except optional SMS (see [Costs](#costs--the-honest-part) below).

---

## How it fits together

```
Guest visits site (GitHub Pages, free)
        │  submits RSVP form
        ▼
Google Apps Script web app (free)
        │  saves to Google Sheet ──► Dashboard tab (live stats)
        │  emails confirmation to guest (free)
        ▼
You open the Admin panel (secret link)
        │  see stats + guest list
        │  send blasts: Email (free) / SMS (Twilio) / WhatsApp links (free)
        └  on the big day: paste stream link → GO LIVE → everyone gets pinged
```

---

## Setup — about 15 minutes

### Step 1 — Create the backend (Google Sheet + web app)

1. Go to **[script.new](https://script.new)** (creates a new Google Apps Script project — use the Google account you want to own the guest list).
2. Name the project (top left) e.g. `Wedding RSVP Backend`.
3. Delete the placeholder code, and paste the entire contents of **`apps-script/Code.gs`** from this repo.
4. Near the top of the file, set `COUPLE_PHONE` to your number (for test SMS later). Everything else is pre-filled.
5. Click **+ → HTML** in the Files sidebar, name it exactly **`Admin`**, and paste the contents of **`apps-script/Admin.html`**.
6. In the toolbar, pick the function **`setup`** and press **Run**. Google will ask you to authorize — approve it (it needs Sheets + Gmail on *your own account*).
7. Open **Executions** (left sidebar) → click the run → the log shows:
   - ✅ your **Google Sheet URL** (guest list + dashboard — bookmark it)
   - ✅ your **admin key** (keep it secret)

### Step 2 — Deploy the web app

1. **Deploy → New deployment → ⚙️ Web app**
2. *Execute as:* **Me** · *Who has access:* **Anyone**
3. Click **Deploy**, copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).

Your admin dashboard now lives at:

```
<web app URL>?action=admin&key=<your admin key>
```

Bookmark it on your phone — that's mission control.

### Step 3 — Connect the website

Open **`js/config.js`** and paste the web app URL:

```js
var APPS_SCRIPT_URL = "https://script.google.com/macros/s/…/exec";
```

### Step 4 — Put it on GitHub Pages

```bash
git add -A && git commit -m "Wedding site"
git push origin main
```

Then on GitHub: **Settings → Pages → Source: Deploy from branch → main / (root)**.
Your site goes live at `https://<username>.github.io/<repo>/` in ~1 minute.

Finally, open your Google Sheet → **Settings** tab → paste that URL into **WEBSITE_URL** (it's used in reminder messages).

### Step 5 — Test it right now ✅

1. Open the site (GitHub Pages URL, or locally: `python3 -m http.server` then http://localhost:8000).
2. Submit an RSVP with your own email + phone.
3. Watch it appear in the **RSVPs** tab, and the **Dashboard** tab update.
4. Check your inbox — you should have a confirmation email.
5. Open the **Admin panel** → your RSVP is there. Write a message and hit **"Send test to me first."**
6. Test go-live: paste any YouTube link → **GO LIVE** → refresh the website → red LIVE banner appears and opt-ins get messaged. Then hit **End live**.

---

## Sending reminders

### Manual blasts (Admin panel)
Pick the audience (everyone / in-person / online / Ghana / USA / live opt-ins), the channel, write your message, test it on yourself, send. Merge tags personalize each message: `{{name}}`, `{{date}}`, `{{time}}`, `{{venue}}`, `{{website}}`, `{{livestream}}`.

### Automatic reminders
A daily trigger (installed by `setup`) checks the calendar each morning and sends the templates in the **Reminder Templates** sheet tab at **30, 14, 7, and 1 days** before the wedding. Edit the text, add rows, or set Enabled to NO — it's all in the sheet. Each guest is contacted on their **preferred channel**.

### Go-live alert
The **GO LIVE** button saves the stream link, flips the website to LIVE (red banner + watch button appear within ~90 seconds for anyone on the page), and messages everyone who ticked *"Message me the moment the wedding goes live."*

---

## Costs — the honest part

| Channel | Cost | Notes |
|---|---|---|
| **Email** | **Free** | Gmail allows ~100 recipients/day on a free account (1,500/day on Google Workspace). The admin panel shows your remaining daily quota. For a 300-guest blast on a free account, send in batches over 3 days or split by audience. |
| **WhatsApp links** | **Free** | The admin panel generates one tap-to-send link per guest with your message pre-filled. ~5 seconds per guest of your time. **This is the recommended channel for Ghana** — nearly everyone is on WhatsApp and it costs nothing. |
| **SMS (Twilio)** | ~$0.008/msg US, ~$0.03–0.06/msg Ghana | There is genuinely **no free way to send real SMS to Ghana + US programmatically** — every provider charges. Twilio gives **~$15 free trial credit**, enough to test and even cover a small guest list. To enable: create a [twilio.com](https://twilio.com) account, get a number, and paste `TWILIO_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` into the **Settings** tab of your Sheet. No Twilio? SMS-preferring guests automatically get email instead, so nobody is missed. |

Everything else — hosting, database, dashboard, confirmation emails, automatic reminders, livestream page — is $0 forever.

---

## Files

```
index.html              the website (RSVP form, countdown, livestream, FAQ)
css/style.css           design
js/config.js            ← the one file you edit (backend URL)
js/main.js              countdown, live-status polling, form submission
photos/                 your photos
apps-script/Code.gs     backend: RSVP intake, dashboard, messaging, reminders
apps-script/Admin.html  admin dashboard UI
```

## Day-of checklist (Nov 7, 2026)

- [ ] Start the YouTube/Facebook live stream (start it *unlisted/private* first to grab the link early)
- [ ] Open the admin panel on a phone
- [ ] Paste link → **🔴 GO LIVE + notify opt-ins**
- [ ] Enjoy your wedding — the website does the rest 💛
