# Steady — verbal script

**~3 minutes at a normal pace. ~460 words spoken.** Read it out loud twice before you present so it lands as speech, not as recitation. Contractions on purpose; short sentences on purpose. Everything in `[brackets]` is a stage direction, not a spoken line. Everything in *(parens)* is a pause you must actually take.

---

### 0:00 — Open (no slide yet, or a title slide with just "Steady")

> Hi. I'm Roshan. This is Steady.
>
> 63 million Americans are family caregivers. That's nearly 1 in 4 adults, and it's up 20 million in the last decade. Two-thirds report high emotional stress.
>
> There's a study — Schulz and Beach, in JAMA, 1999 — that followed spousal caregivers for four years. The caregivers reporting strain had a **63% higher mortality risk** than the ones who weren't caregivers.
>
> *(pause — count two)*
>
> Not lower quality of life. Higher mortality. Caregiver strain isn't burnout as a feeling. It's an independent risk factor for dying.

### 0:35 — The gap (still no product on screen)

> Here's the gap that made this a software problem. In that same 2025 report — only about **15%** of caregivers have ever been asked by a health professional about their own health.
>
> Think about that. The person they care for is monitored constantly — vitals, medications, appointments. The caregiver, who's at elevated risk of dying from the strain, is asked about themselves… essentially never. So the first signal the system gets is a crisis. And now there are two patients instead of one.
>
> But the signals are already on the caregiver's wrist. Sleep gets shorter. Resting heart rate drifts up. HRV drops. Days before anyone would say the words "I'm not okay."
>
> **Nobody is reading them.**

### 1:10 — What Steady does [switch to the app, Caregiver Today view]

> Steady reads them.
>
> This is what a caregiver sees each morning. Their status. A 7-day projected trajectory with an uncertainty band, because we're honest about not knowing the future. And the actual signals behind it — resting heart rate, sleep, HRV — each plotted against **their own** baseline. Not a population average.
>
> [tap a metric] Tap any of them, 21 days of history. Nothing here is a diagnosis. It's context they can act on.
>
> [go to Heads-up] When the model sees a heavier stretch coming, they get a plain-language note and at most **two real support programs** — Eldercare Locator, ARCH Respite, 988. The AI writes the note. Our code picks the programs. So the AI can't invent a fake helpline. It's impossible by construction, and a test enforces it.
>
> [switch to Manager Cohort] For the care manager, the whole caseload ranked by risk. Click a person — a Cortex-drafted outreach message, ready to send.

### 2:10 — How we built it [architecture slide, or keep the app up]

> The whole model lives inside Snowflake. Classification, forecast, and the language model — trained and run in the warehouse. The caregiver's data never leaves it to get scored.
>
> On accuracy — our episode classifier hits **AUC 0.803**, person-held-out. It beats a naive baseline. And to head off the obvious question — lab stress-detection papers claim F1 above 0.95. Those are internal-validation numbers. On real-world external validation, the same models drop to about 0.58. Ours is 0.577. We're in the honest band.

### 2:40 — Who pays for this [close]

> Last piece. In July 2024, CMS launched a program called GUIDE — **390 organizations**, paid monthly to support caregivers with a respite budget capped at about **$2,500 per patient per year**. They're contractually obligated to spend that money on caregivers. And today, they have no data-driven way to decide which caregiver gets it first.
>
> **Steady is that tool.** A caregiver gets a few days of warning and one concrete thing to do. A care manager sees who needs help this week — not after the crisis.
>
> Thanks.
>
> *(hold eye contact. don't fill the silence.)*

---

## Fallback: 90-second version

Use this if a judge cuts you short or the demo tab dies.

> 63 million Americans are family caregivers. Two-thirds report high emotional stress, and a JAMA study found caregivers reporting strain had a **63% higher mortality risk** than non-caregivers. Yet only about **15%** have ever been asked by a health professional about their own health. The person they care for is monitored constantly; the caregiver is asked never.
>
> The signals are already on their wrist — sleep, resting heart rate, HRV, days before they'd say a word. Steady reads them. A caregiver gets a status and a 7-day forecast against their own baseline, and when a heavier stretch is coming, they get a real support program — Eldercare Locator, ARCH Respite, 988 — not one an AI invented.
>
> For care managers, the whole caseload ranked by risk with an AI-drafted outreach message. The model runs inside Snowflake — classification, forecast, language — so the data never leaves the warehouse. Episode-classifier AUC 0.803, person-held-out.
>
> CMS launched a program called GUIDE last year — 390 organizations, paid to support caregivers with a respite budget, and no tool for deciding who to help first. **Steady is that tool.** Thanks.

---

## 15-second elevator (if you have literally one breath)

> 63 million Americans are family caregivers. Their strain carries a 63% higher mortality risk, and only 15% are ever asked about their own health. Their wearable already knows. Steady reads it, warns them days early, and points them at real support.

---

## Delivery notes

- **Two pauses matter.** After "higher mortality" (0:30) and after "essentially never" (0:50). Count two seconds. Do not fill them.
- **Don't read from a slide during the mortality stat.** Look at a judge.
- **When you demo, narrate what they're looking at, not what you did.** "This is what the caregiver sees" — not "we built this component."
- **The word 'AI' is cheap.** Use "the language model" or "Cortex" instead when you can. It sounds like you know what you built, not what the marketing team called it.
- **If the demo breaks:** switch to the fallback script above. Do not apologize past one sentence. "The tunnel dropped — let me walk you through the screens" and keep going.
- **Close with silence.** "Thanks" and eye contact. Every second you stay quiet is a second the room replays "63% higher mortality risk" in its head.
