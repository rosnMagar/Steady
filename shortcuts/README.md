# iPhone Shortcuts — Apple Watch → Steady

Goal: send daily wearable aggregates + a quick self-report from your iPhone to the Steady server,
with no Mac and no Xcode. Do the **spike** first to clear the Phase 0 gate, then build the two real
shortcuts once the server exists.

---

## Phase 0 SPIKE (do this first — ~15 min, proves it works)

Purpose: confirm (a) Shortcuts can read the Health types we need, and (b) it can POST JSON with a
bearer-token header. We send to a throwaway inbox, not our server.

1. Open **https://webhook.site** on any browser. Copy the "unique URL" it shows you.
2. On the iPhone: **Shortcuts app → + (new) → Add Action**.
3. Get each number. **Find Health Samples returns a LIST of samples, not a number**, so each metric
   is two actions: Find, then reduce to a value with **Calculate Statistics**.
   - **Steps:** Find Health Samples (Steps, period **Today**) → **Calculate Statistics → Sum** →
     rename the result `StepsTotal`. (Steps arrive as many samples per day, so you sum them.)
   - **Resting HR:** Find Health Samples (Resting Heart Rate, Sort **Latest**, **Limit 1**) →
     Calculate Statistics → **Average** → rename `RestingHR`.
   - **Sleep:** Sleep Analysis is stored as intervals and is fiddly — for the SPIKE, skip it. If
     steps + resting HR arrive, the gate passes.
   Note any type your watch/iOS can't provide.
4. Add a **Text** action. **Do NOT type the bracketed names as text** — they must be inserted as
   variable chips (colored tokens), or you'll POST the literal placeholder. Type only the quotes,
   commas and braces; where a value goes, tap the variable from the suggestion bar just above the
   keyboard (or tap the bar → **Select Variable**). Build this:
   ```
   {"person_id":"p_roshan","date":"<CurrentDate>","steps":<StepsTotal>,"resting_hr":<RestingHR>,"source":"apple_watch"}
   ```
   - `<CurrentDate>`: insert the **Current Date** variable, then tap the chip → **Format Date** →
     custom `yyyy-MM-dd`.
   - `<StepsTotal>` / `<RestingHR>`: insert the Calculate Statistics result chips from step 3
     (these are plain numbers, so no quotes around them).
5. Add **Get Contents of URL**. Set:
   - URL = your webhook.site URL
   - Method = **POST**
   - Request Body = **File**, then choose the **Text** variable from step 4 (so the JSON is the body)
   - Headers: add **Content-Type** = `application/json` and **Authorization** = `Bearer test-token-123`
6. Run the shortcut (tap ▶). First run asks for Health permission — **Allow**.
7. Look at webhook.site: you should see a **POST** with your JSON body and the `Authorization` header.

**Gate passes if:** the JSON arrives with real numbers for steps + resting HR (+ sleep if
available) and the bearer header is present. Note anything missing — especially if Sleep or HRV
can't be read — so we can drop those from the Apple Watch path.

### Also test unattended automation (important for the daily sync)
- **Automation tab → + → Time of Day → 9:00 PM → Run Immediately (turn OFF "Ask Before Running").**
- Pick the shortcut above. Then check tomorrow whether it fired on its own.
- Known catch: Health data can be locked while the phone is locked. If the automation fails
  unattended, we fall back to a one-tap manual daily run + a backfill (still fine for the demo).

---

## Getting a public HTTPS URL for the phone (tunnel)

The iPhone can't reach `localhost` — the server needs a public HTTPS URL. Start the API, then open a
tunnel to port 8000:

```
.venv/bin/uvicorn server.main:app --port 8000            # API + built UI (web/dist) on :8000
cloudflared tunnel --url http://localhost:8000            # prints https://<random>.trycloudflare.com
```

That printed URL is your `<your-tunnel>` below — and, because the API also serves `web/dist`, the same
URL opens the app for judges (build the UI first with `VITE_USE_API=1 npm --prefix web run build`).
`ngrok http 8000` works the same way if you prefer. Quick tunnel URLs change on each restart, so
re-paste it into the shortcuts if you restart. For a stable demo URL, use a named Cloudflare tunnel or
deploy to Render/Fly.

## The two real shortcuts (build after the server is up)

Replace the webhook.site URL with `https://<your-tunnel>/ingest/...` and the token with the real
`INGEST_TOKEN` from `.env` (send it as the header `Authorization: Bearer <INGEST_TOKEN>`; the server
accepts the token with or without a leading `Bearer `, so either form works).

1. **Daily Sync** (Automation, 9 PM): same as the spike but POST to `/ingest/daily`, and add
   `hrv_ms` (Heart Rate Variability) and `active_energy_kcal` (Active Energy) if available.
2. **Backfill** (run once, manually): loop over the last 30–60 days building an array of daily
   objects, POST to `/ingest/backfill`. Gives the model a baseline before demo day.
3. **Daily Check-in** (Automation, evening): **Ask for Input** (Number, "How heavy did today feel?
   1–5"), optionally **Choose from Menu** for tags, POST to `/ingest/checkin`.

Sample payloads are in `sample_payloads/`.
