# Steady — verbal pitch kit

Open this on your phone while you present. Everything here is defensible; nothing is invented.

---

## 1. The 60-second opening (memorize the shape, not the words)

> **63 million Americans are family caregivers** — up 20 million in the last decade. Two-thirds report high emotional stress. And there's a JAMA study that followed caregivers for four years — the ones who reported strain had a **63% higher mortality risk.**  *(pause)*
>
> But here's the gap. Only about **15%** of them have ever been asked by a health professional about their own health. The person they care for gets monitored constantly. The caregiver gets asked never. So the first signal the system ever receives is a crisis — and now there are two patients instead of one. *(pause)*
>
> **The signals are already on their wrist.** Sleep gets shorter, resting heart rate drifts up, HRV drops — days before anyone would say "I'm not okay."
>
> **Steady reads those signals and gives them a few days of warning, plus one concrete thing to do about it** — a real, verified support program. And for care managers, it ranks the whole caseload so they can see who needs help this week.
>
> We built the whole thing on Snowflake. And a program called CMS GUIDE — that just launched with **390 organizations** — is contractually paid to support caregivers with a respite budget. Steady is the tool that tells them who to spend it on.

## 2. The two moments that make people stop

Pause after each. They're the two things the audience will remember.

1. **"63% higher mortality risk"** — Schulz & Beach, JAMA 1999. Caregiver strain isn't burnout as a feeling. It's an independent risk factor for dying.
2. **"Only 15% have ever been asked about their own health"** — AARP/NAC 2025 report. The recipient is monitored continuously; the caregiver, essentially never.

## 3. Demo choreography (~60–90 seconds)

Have the app open before you start talking.

1. **Caregiver Today view.** "This is what a caregiver sees each morning. Their status — steady, building, or heads-up. A 7-day projected trajectory with a band, because we're honest about uncertainty. And the actual signals behind it — resting heart rate, sleep, HRV — each plotted against **their own** baseline, not a population average."
2. **Tap a metric.** "Tap it, they see 21 days of history against their baseline. Nothing is a diagnosis. It's context."
3. **Heads-up page.** "When the model sees an elevated stretch coming, they get a plain-language note and at most **two real support programs** — Eldercare Locator, ARCH Respite, VA Caregiver, 988. The AI writes the prose. The program IDs are picked in code, so hallucinating a fake helpline is impossible by construction."
4. **Care-manager cohort.** "For a care manager running a caseload, everyone ranked by risk, with sparklines and a projected weekly-load band for staffing. Click a person, they get a Cortex-drafted outreach message and a contact history. This is the view a CMS GUIDE program uses to decide who gets the respite budget this week."
5. **Methods & Limits page.** "And this — we built it into the product, not into a slide deck. What we're trained on, what the sample size is, why the live participant is a pipeline demo and not model validation. Judges shouldn't have to trust us. The product tells the truth about itself."

## 4. Numbers you must know cold

Say them without looking. If a judge asks and you flip through slides, credibility drops.

- **63 million** family caregivers. **1 in 4** adults. **+20M since 2015** (~46% growth).
- **$600 billion** unpaid labor in 2021 (AARP Valuing the Invaluable 2023). More than the $433B Americans spent out-of-pocket on all healthcare.
- **64%** high emotional stress, **45%** high physical strain (AARP/NAC 2025).
- **63% higher four-year mortality** (Schulz & Beach, JAMA 1999).
- **~15%** ever asked about their own health.
- **390 organizations** in CMS GUIDE, live since July 2024. **$2,563/patient** annual respite cap.
- Training data: **71** LifeSnaps participants, **63** usable, 2021–2022.
- Model: **AUC 0.803**, **F1 0.577** (vs. persistence baseline 0.565), person-held-out.
- **78** tests pass.

## 5. How to explain the technical parts to a non-technical judge

You don't need to hide the technical work — you need translations ready. Keep the technical term, then follow with the plain-English version.

| Say this | Then this |
|---|---|
| "Personal baselines with z-scores" | "We compare each person to their own normal, not to a population average. Your resting heart rate at 72 might be my elevated." |
| "SNOWFLAKE.ML.CLASSIFICATION" | "The model is trained and run **inside Snowflake**, the database — not in a script on a laptop. That's how a real hospital would deploy it." |
| "SNOWFLAKE.ML.FORECAST" | "A time-series forecast built into the database — same idea as a weather forecast but for someone's physiological load, with an uncertainty band because we don't pretend to know the future." |
| "Cortex COMPLETE" | "A language model that lives inside Snowflake, so the caregiver's data never leaves the warehouse to reach an AI." |
| "Grounding by construction" | "The AI can write the note, but the AI cannot pick which support program to recommend. Our code picks it. Hallucinating a fake helpline is not something the AI can do here." |
| "Person-held-out cross-validation (GroupKFold)" | "When we tested the model, we made sure it had never seen that person's data in training. Otherwise the score is a lie." |
| "AUC 0.803" | "If you show the model two caregivers — one heading for a heavier week, one not — 80% of the time it correctly picks the heavier one." |
| "Beats persistence baseline" | "There's a one-line 'lazy model' that just says 'tomorrow will be like today.' A real model has to beat that. Ours does." |
| "iPhone Shortcut + FastAPI ingest" | "The caregiver's Apple Watch sends daily summaries to our server. Only daily summaries — not raw heart-rate streams, not location." |
| "Physiological load index" | "A recovery-deficit score, like Whoop or Oura — sleep short, heart rate up, HRV suppressed. Higher score = the body is under more strain." |

## 6. Q&A prep

### The likely 12 questions

**1. Is this a medical device?**
> No, and it doesn't try to be. Steady is opt-in decision support. We say that on the Methods & Limits page inside the product. It doesn't diagnose, it doesn't give medical advice, and any crisis language routes the person to 988.

**2. Your training data is Fitbit users. Aren't caregivers a different population?**
> Yes, and that's stated up front in the product. LifeSnaps is 71 general Fitbit wearers, not caregivers. The reason the pipeline can still be honest for a real caregiver is that every feature is a deviation from **their own** baseline, not a population threshold. The live Apple Watch participant is a pipeline demo, not model validation. Validation on an actual caregiver cohort is the next step.

**3. Why is your F1 only 0.58 when other papers report 0.95+?**
> Those are lab results, on internal validation. On real-world external data those same models drop to about F1 0.58, and personalized approaches report 0.62 to 0.66 in systematic reviews. Our 0.577 is person-held-out — meaning the model never saw that person in training. That's the honest band for this kind of product.

**4. How is this different from an Apple Watch stress score?**
> Two things. First, Apple's score is a snapshot — mine is a **forecast** with an uncertainty band. Second, my caregiver isn't a random user — they're inside a care-management workflow, and their forecast is being read by someone whose job is to help. A stress score with no one on the other end doesn't change anything.

**5. Privacy?**
> Only daily aggregates leave the phone. Never raw heart-rate streams, never location. Identifiers are pseudonymous. Export and delete-by-person are built in. And no employer-facing use — that's a hard line.

**6. Who pays for this?**
> The CMS GUIDE model. It launched in July 2024, 390 participating organizations, and it pays those programs monthly to support caregivers — including a respite budget capped at $2,563 per patient per year. Those programs are contractually obligated to spend that money on caregivers, and today they have no data-driven way to decide which caregiver gets it first. Steady is that tool.

**7. What if the model is wrong and someone doesn't get the alert?**
> Two answers. One: the product design absorbs this — nothing about Steady replaces a phone call. The heads-up is one input to a care manager who's already reaching out. Two: our real predictive claim is a **ranking** claim, not a threshold claim — AUC is a ranking metric. We're ordering the caseload, not diagnosing individuals.

**8. Isn't this surveillance?**
> It's opt-in, it's the caregiver's own data on their own wrist, they see everything the care manager sees, and they can delete their record at any time. Surveillance is when someone else watches you without your consent. This is a tool the caregiver uses on themselves and shares.

**9. What happens when the LLM hallucinates a fake support program?**
> It can't. Our code — not the LLM — picks which program IDs to include. The LLM only writes the prose around them. And a test enforces that: if an invented ID ever appeared, the test would fail. Also, all 12 programs in the corpus are real; the phone numbers and URLs are verified against official sources.

**10. Why Snowflake?**
> Two reasons. First, the model — classification, forecast, and language generation — all runs inside the warehouse, so we never move a caregiver's data out to score it. That's the shape a hospital would actually deploy. Second, Snowflake is where a health plan or GUIDE program's data already lives. We meet them where they are.

**11. What's the biggest technical risk?**
> Cross-device transfer. The training data uses Fitbit and RMSSD for HRV; the live participant uses Apple Watch and SDNN, which aren't directly comparable. That's why the live person's status comes from their **own** forecast crossing their **own** percentiles, not from the Fitbit-trained classifier. We're honest about it in the product.

**12. What's next?**
> Three things. Hourly instead of daily features push AUC toward 0.85. A small validated caregiver cohort — actual caregivers, not general wearers. And the feedback loop — when a caregiver marks a heads-up "not helpful," the thresholds should retrain.

### Two curveballs to be ready for

**"What if I don't have an Apple Watch?"**
> The pipeline is device-agnostic — anything that produces daily HR, sleep, and HRV works. Long term, a caregiver's phone is enough for the sleep and steps signal; heart rate is the wrist-worn part.

**"Have you talked to actual caregivers?"**
> Not enough. That's the honest answer. Everything about the design decisions — the mobile-first Today view, the two-program limit on heads-ups, the outreach-draft workflow for care managers — comes from published caregiver research and the CMS GUIDE program structure. Real caregiver validation is the next step, and I'd rather say that than pretend a hackathon week gave us it.

## 7. Things NOT to say

- Do **not** say the word "diagnosis" or "medical advice" without immediately following with "we don't do that." Judges pattern-match on it.
- Do **not** claim the live Apple Watch participant validates the model. The pipeline works end-to-end. The model isn't validated on that person and the product says so.
- Do **not** cite a "caregiver app market size" number. Vendor reports disagree 5x on that. Cite the **$600B** unpaid-labor number instead — it's from AARP and it's defensible.
- Do **not** oversell the AUC. Say 0.803 and immediately say "person-held-out, beats a persistence baseline." The nuance is the credibility.
- Do **not** describe this as "AI that detects stress." Describe it as a **forecast** with an **uncertainty band** that a care manager acts on.

## 8. Your one-line elevator pitch (if you have 25 seconds)

> 63 million Americans are family caregivers. Their strain carries a 63% higher mortality risk — yet only 15% are ever asked about their own health. Their wearable already knows. Steady reads it, warns them days early, and points them at real support.

## 9. If you get one minute at the end, close with this

> Steady is a bet that the boring, honest version of caregiver support is the one that gets funded, gets deployed, and gets someone a call from their care manager on a Tuesday instead of an ambulance on a Friday. Thanks.
