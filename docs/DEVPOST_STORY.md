# Steady

Forecasting family-caregiver strain from wearable signals days before a crisis — and matching the caregiver to a real support program.

## Inspiration

**63 million Americans — nearly 1 in 4 adults — are family caregivers** (AARP/NAC, *Caregiving in the US 2025*, n=6,858). **64%** report high emotional stress, **45%** high physical strain. And the finding that made us build this: Schulz & Beach's *Caregiver Health Effects Study* (**JAMA**, 1999) followed spousal caregivers for four years and found

$$\text{HR}_{\text{strain}} = 1.63 \quad (95\%\ \text{CI}\ 1.00\text{–}2.65)$$

— caregivers reporting strain had a **63% higher four-year mortality risk**. Not lower quality of life. Higher mortality.

Then the software gap, from the same 2025 report: only about **15%** of caregivers have ever been asked by a health professional about their own health. The care recipient is monitored continuously; the caregiver is asked essentially never. The first signal the system receives is a crisis, and then there are two patients instead of one. The signals are already on the caregiver's wrist. Nobody is reading them.

## How we built it

**One data flow, four layers, all on Snowflake.**

An iPhone Shortcut POSTs HealthKit daily aggregates to FastAPI. Public LifeSnaps and the live Apple Watch participant land in the *same* Snowflake tables, distinguished by a `source` column.

Every feature is a deviation from the person's own normal, $z_{i,t} = (x_{i,t} - \mu_i)/\sigma_i$. From those we build a transparent physiological load index:

$$L_{i,t} = 50 + 10 \cdot \operatorname{mean}\bigl(z^{\text{HR}},\ z^{\text{nremHR}},\ -z^{\text{sleep}},\ -z^{\text{eff}},\ -z^{\text{HRV}}\bigr)$$

`SNOWFLAKE.ML.CLASSIFICATION` predicts an elevated-load episode in the next 1–3 days; `SNOWFLAKE.ML.FORECAST` projects the 7-day trajectory; `SNOWFLAKE.CORTEX.COMPLETE` (llama3.1-8b) writes the caregiver note and manager brief. Program IDs are picked **in code** so the LLM can't invent one.

Caregivers get a mobile view — status, 7-day band, each signal against their own baseline. Care managers get a ranked caseload, a projected weekly-load band, and a drawer with a Cortex-drafted outreach draft.

## Challenges

**Two claims that didn't survive a baseline — and we kept the evidence.**

Our first target was self-reported mood. Wearables did not predict it: $r \approx 0$, $\text{AUC} \approx 0.46$. We pivoted to the deterministic load index above.

Our forecast then lost to naive persistence at every horizon — expected for a smooth series. So the forecast stayed for the trajectory + uncertainty band, and the predictive claim moved to episode classification:

$$y_{i,t} = \mathbb{1}\!\left[\overline{L}_{i,\ t+1..t+3} \geq Q^{(i)}_{0.70}(L)\right]$$

Person-held-out `GroupKFold`: $\text{AUC} = 0.803$, $F_1 = 0.577$ (vs. 0.565 persistence), Precision = 0.61 (vs. 0.55).

Stress-detection papers advertise $F_1 \geq 0.98$, but those are lab numbers. On **real-world external validation** the same models drop to $F_1 \approx 0.58$; personalized approaches report $F_1 \in [0.62, 0.66]$. Our numbers sit inside the real-world band.

**Keeping an LLM honest.** `select_programs()` picks IDs in code; Cortex only writes prose around them. Guardrail tests enforce it: invented IDs dropped, ≤ 2 programs, medical-advice phrasing flagged, crisis language routed to 988.

## What we learned

The hardest engineering in an ML hackathon is deciding what claim you're allowed to make. Twice we had a working pipeline attached to a claim that didn't survive a baseline, and both times the fix was to change the claim, not the code. A `GroupKFold` split and a naive baseline killed more of our ideas than any bug did.

Concretely: `ML.FORECAST` exogenous variables need *future* values, which rules out live wearables as inputs — hence the two-stage split. Per-person z-scores are what make cross-device transfer conceivable at all. And a 60-second cache is the difference between a dashboard that feels instant and one that waits for a warehouse to wake up.

## Limits

Trained on LifeSnaps — **general Fitbit wearers, not caregivers** (71 participants, 63 usable). Load is a physiological proxy, not a clinical measure. The live Apple Watch participant demonstrates the pipeline end-to-end and is **not** model validation. Only daily aggregates leave the phone. Steady is opt-in decision support, not a diagnostic device.
