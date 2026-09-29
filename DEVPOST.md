# Devpost submission — Steady

Copy-paste source for the TigerHacks 2026 Devpost form. Every number here is traceable to a file
in this repo (noted in *(source)* marks — delete those before pasting).

---

## Project name

**Steady**

## Tagline (Devpost limit: short, one line)

> Forecast family-caregiver strain from wearable signals days before a crisis — and match them to real support.

*Alternates:*
- Caregivers burn out on a schedule nobody sees. Steady sees it a few days early.
- Wearable signals → a heavier-week heads-up → a real support program. Built end-to-end on Snowflake.

## Built With (tags)

`snowflake` `snowflake-cortex` `snowflake-ml` `python` `fastapi` `lightgbm` `scikit-learn` `pandas`
`react` `typescript` `vite` `tailwindcss` `recharts` `apple-healthkit` `ios-shortcuts` `aws-ec2` `llama`

## Try it out

- Live app: `<< EC2 public URL — one link serves the API and the UI >>`
- Repo: https://github.com/rosnMagar/Steady
- Demo video: `<< unlisted YouTube link, ≤3 min >>`
- Methods & Limits (what it can't do): `<< LIVE_URL >>/methods`

---

# About the project

## Inspiration

**63 million Americans — nearly 1 in 4 adults — are family caregivers.** That's up 20 million since
2015, a ~46% jump in a decade, per AARP and the National Alliance for Caregiving's *Caregiving in the
US 2025* (n=6,858, nationally representative, a survey that has run since 1997). Their unpaid labor
was worth **$600 billion** in 2021 — more than the **$433 billion** Americans spent out-of-pocket on
all healthcare that year.

**It is measurably hurting them.** 64% report high emotional stress. 45% report high physical strain.
1 in 5 rate their own health as fair or poor, and nearly 1 in 4 say caregiving is the reason they
can't look after their own health. Across meta-analyses, median prevalence among informal caregivers
runs **33% for depression and 35% for anxiety**.

And then the finding that made us build this instead of something else. Schulz & Beach's *Caregiver
Health Effects Study* (**JAMA**, 1999) followed elderly spousal caregivers for four years:
**caregivers reporting emotional or physical strain had a 63% higher mortality risk than
non-caregivers.** Not lower quality of life. Higher mortality. Caregiver strain is not a wellness
metric — it's an independent risk factor for dying.

**Now the part that made it a software problem.** In the same 2025 report: only about **15% of
caregivers had ever been asked by a health professional about their own health.** Roughly **85% never
were.** Over half are doing injections, wound care, and medication management, and only ~11–20% have
had any training for it.

So: the care recipient is monitored continuously — appointments, vitals, meds. The caregiver, who is
at elevated risk of death from the strain, is asked about themselves essentially never. There is no
instrument anywhere in the workflow pointed at them, which means the first signal the system receives
is a crisis, and then there are two patients instead of one.

**The signals are already on their wrist.** Dementia caregivers measurably have lower (worse) HRV
than non-caregivers over months of nightly measurement. And prospectively, in a multiple N-of-1 study
tracking people for 15–55 weeks each, total sleep time and resting HRV were *more consistent
predictors of the days ahead than reflections of the days behind*. Nobody is reading them.

**And somebody is already paid to act on this.** CMS's GUIDE model went live in July 2024: **390
organizations**, eight years, paid monthly per beneficiary for care management **and caregiver
support**, plus a **respite budget capped at $2,563 per patient**. Those programs are contractually
obligated to support caregivers and to spend respite dollars — with no instrument for deciding *which*
caregiver needs them *this week*. That's the gap Steady fills, and it's why the product has a
care-manager dashboard and not just a consumer app.

We wanted the boring, honest version of that idea: not a diagnosis, not a stress score with a sad
face on it — a few days of warning, and one concrete thing to do with it.

*Full citations for every figure above: [`docs/RESEARCH.md`](docs/RESEARCH.md).*

## What it does

Steady is one pipeline with two front doors.

**For the caregiver** (mobile web app): a daily **Today** view with their physiological load, a
7-day projected trajectory with an uncertainty band, and *the signals behind it* — resting HR, sleep
duration, sleep efficiency, HRV, steps, each plotted against **their own** baseline, tap to enlarge.
When load is trending toward a heavier stretch, they get a **Heads-up**: a short plain-language note
and at most two **real** support programs (Eldercare Locator, ARCH Respite Locator, VA Caregiver
Support Line, 988 — 12 curated, phone numbers and URLs verified against official sources).

**For the care manager** (desktop dashboard): the whole caseload ranked by risk, with sparklines, a
projected weekly-load band for staffing, a region breakdown, and a per-caregiver drawer with an
AI-drafted outreach message and contact history.

Both share a **Methods & Limits** page that states, in the product itself, what the model is trained
on and where it doesn't apply.

## How we built it

**Ingest.** An iPhone Shortcut reads HealthKit daily aggregates and POSTs them to FastAPI with a
bearer token. Real Apple Watch data reached the webhook on 2026-09-26. The public LifeSnaps training
set and the live participant land in the *same* Snowflake tables, separated by a `source` column.
*(server/routes_ingest.py, server/normalize.py, shortcuts/)*

**Snowflake is the system of record and the compute.**
1. Raw → **features**: rolling windows and per-person baseline deviations (z-scores). *(src/features.py)*
2. Features → a **physiological load index** (0–100): a transparent recovery-deficit function of
   elevated resting HR, elevated sleeping HR, short sleep, poor sleep efficiency, and suppressed
   HRV — each relative to that person's own normal. No learning, no label, dense on every day with
   signals. *(src/load_index.py)*
3. Load → **`SNOWFLAKE.ML.CLASSIFICATION`**: "will this person hit an elevated-load episode in the
   next 1–3 days?" Trained and scored *inside* Snowflake as the `steady_episode` model; its risk
   score drives status and cohort ranking. *(src/train_snowflake_model.py, src/episode_model.py)*
4. Load → **`SNOWFLAKE.ML.FORECAST`**, multi-series (`SERIES_COLNAME => person_id`), 7 days ahead,
   for the trajectory and its uncertainty band.
5. Risk + forecast → **alerts** → **`SNOWFLAKE.CORTEX.COMPLETE`** (llama3.1-8b) writes the caregiver
   note and the manager brief as JSON. *(src/briefs.py)*
6. A nightly Snowflake **Task** re-runs the chain. *(sql/05_tasks.sql)*

**API.** FastAPI reads computed results out of Snowflake behind a 60s TTL cache, so the UI never
waits on a warehouse cold start, and serves the built React app from the same origin with SPA
fallback — one link, deep links work. *(server/repo.py, server/cache.py, server/main.py)*

**UI.** React + Vite + TypeScript + Tailwind, built against mock JSON matching a written API
contract first, then swapped to live endpoints. Recharts for the forecast band and metric history,
light/dark, verified at 390px and 1440px. *(web/)*

**Deployed** on a single EC2 instance: uvicorn binds :80 directly, the security group is the
firewall, and the phone POSTs to the same host that serves the dashboard. *(deploy/DEPLOY.md)*

### Two design decisions that shaped everything

**Wearables can't feed the forecast directly.** `ML.FORECAST` exogenous variables need *future*
values, which don't exist for a live wearable. So the pipeline splits: wearables become a load
score, and the forecast runs on that score's own history.

**Personal baselines, not population thresholds.** Every feature is a deviation from the person's
own normal. That's the only reason an Apple Watch participant can plug into a Fitbit-trained
pipeline at all — and it's still not validation for them, which is why live status comes from that
person's own forecast crossing their own percentiles, not from the Fitbit-trained classifier.

## Challenges we ran into

**Our first model didn't work, and we kept the evidence.** The original target was self-reported mood
from LifeSnaps' SEMA labels. Wearables do not predict it: r ≈ 0, AUC 0.46. Rather than tune it into
looking alive, we pivoted — the ML target became the deterministic physiological load index, and the
mood check-in became what it actually is: a message from the caregiver to their care manager, not a
label. *(documented in PROGRESS.md so nobody re-runs the dead end)*

**Our second model lost to a one-line baseline, and we kept that too.** `ML.FORECAST` on the load
series does not beat naive persistence at any horizon. That's the expected result for a smooth,
near-random-walk series, and pretending otherwise would have been the easiest lie in the project.
So the forecast stayed for what it's genuinely good at — showing trajectory and honest uncertainty —
and the *predictive* claim moved to a framing that survives a real test: episode classification,
**AUC 0.803 person-held-out**, beating persistence on F1 (0.577 vs 0.565) and precision (0.61 vs
0.55), with wearable features (resting-HR z-score, 7-day load trend, HRV variability) carrying the
signal.

And on that number: stress-detection papers advertise F1 0.98+, which is how a 0.577 starts to look
embarrassing. Those are lab and internal-validation figures. On **real-world external validation**
the same class of model drops to roughly **F1 0.58**, and **personalized** approaches report
**F1 0.62–0.66** in systematic reviews. Our person-held-out numbers sit inside the real-world band
rather than the lab one — which is the only band that means anything for a product you'd actually
put in front of a caregiver.

**Real phone data is nothing like sample data.** The actual Shortcut payload sent resting heart rate
as a *string*, sleep as raw HealthKit stage intervals with full identifiers, and timestamps
containing a U+202F narrow no-break space. `normalize.py` and its tests exist entirely because of
what the device really sent.

**Keeping an LLM honest.** An LLM asked to suggest support programs will invent plausible ones with
plausible phone numbers. Ours can't: `select_programs()` picks program IDs **in code**, and Cortex
only writes prose around them. Hallucinated IDs are impossible by construction, and the tests still
check — invented IDs dropped, at most two programs, medical-advice phrasing flagged, crisis language
routed to 988.

**Thresholds that produced an empty tier.** Risk came out bimodal, so the middle "building" status
had zero people in it. Fixed by sourcing the tiers from different signals: `heads_up` from model
risk, `building` from the forecast crossing the person's own p75 — 34 steady / 4 building / 13
heads_up across the demo cohort.

## Accomplishments that we're proud of

- **The whole model lives in Snowflake.** `ML.CLASSIFICATION` for the predictor, `ML.FORECAST` for
  the trajectory, `CORTEX.COMPLETE` for the language — trained and scored in the warehouse, not in a
  notebook that happens to read from it.
- **Two negative results we published instead of hiding.** The mood model and the forecast backtest
  are both in the repo, in `PROGRESS.md`, and on the app's own Methods page.
- **Zero-hallucination grounding by construction**, not by prompt-begging.
- **Real wrist → real dashboard.** Apple Watch data traveled Shortcut → FastAPI → Snowflake → UI.
- **78 tests**, covering leakage, LLM guardrails, ingest idempotency, payload normalization, and
  data-integrity invariants (risk in [0,1], forecast intervals ordered, briefs cite only real programs).
- **A product that tells you its own limits** — sample size, training population, why the live
  participant is a pipeline demo and not validation — in the UI where a user will actually see it.

## What we learned

That the hardest engineering in an ML hackathon project is deciding what claim you're allowed to
make. Twice we had a working pipeline attached to a claim that didn't survive a baseline, and both
times the fix was to change the claim, not the code. A `GroupKFold` split and a naive baseline killed
more of our ideas than any bug did — and what's left is the part we can defend in front of judges.

Also, concretely: `ML.FORECAST` exogenous variables need future values (which quietly rules out
wearables as inputs); per-person z-scores are what make cross-device transfer even conceivable; and
a 60s cache is the difference between a dashboard that feels instant and one that waits on a
warehouse to wake up.

## What's next for Steady

- **Intraday features.** Hourly rather than daily aggregates project the episode classifier to
  ~0.83–0.85 AUC.
- **Validate on actual caregivers.** Everything today is trained on general Fitbit wearers. The
  honest next step is a small caregiver cohort, not more model tuning.
- **Close the feedback loop.** The "not helpful" signal on a heads-up should retrain the thresholds.
- **Program matching by need, not category** — Cortex Search over a wider program corpus, still with
  IDs chosen in code.
- **Ship the nightly Task.** Written and validated read-only; applying it retrains models on a
  schedule, which we deliberately left as a deploy-time decision.

## Limits, stated up front

Training data (LifeSnaps, Zenodo 6832242, CC BY 4.0) is **general Fitbit wearers, not caregivers**:
71 participants, 63 usable, 2021-04-08 to 2022-01-22. Load is a **physiological proxy, not a
clinical measure**. Wearable coverage is partial (HRV ~33%, sleep ~48%). Apple Watch HRV (SDNN) is
not directly comparable to LifeSnaps HRV (RMSSD), so the live participant demonstrates the pipeline
end-to-end and is **not** model validation. Only daily aggregates leave the phone — never raw heart
rate streams or location — identifiers are pseudonymous, and export and delete-by-person are
built in. Steady is opt-in decision support, not surveillance and not a diagnostic device.

---

## Pre-submit checklist

- [ ] Fill the three `<< >>` placeholders above (live URL, video, and confirm the repo is public)
- [ ] Demo video recorded (≤3 min): caregiver Today → Heads-up → manager Cohort → drawer outreach
- [ ] Backup screen recording in case the live tunnel/instance misbehaves
- [ ] Submission ZIP + git repo link (TigerHacks requires both)
- [ ] Tracks selected: Snowflake, Reply, ML/AI special award
- [ ] Screenshots uploaded: caregiver Today (dark, 390px), Heads-up with programs, manager Cohort,
      weekly load band, Methods & Limits
- [ ] Thumbnail image set
