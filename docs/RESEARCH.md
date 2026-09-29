# Why Steady exists — the research base

Every number in the pitch, the Devpost writeup, and the slides should come from this file. Each entry
has a source link and, where it matters, the *product claim it does and does not support*.

Compiled 2026-09-27. Re-verify the AARP/NAC figures before the demo if a newer edition has shipped.

---

## 1. The market: 63 million people, and it grew 46% in a decade

| Figure | Source |
|---|---|
| **63 million** US adults — **nearly 1 in 4** — provided ongoing care for an adult or a child with a complex medical condition in the past year | [AARP/NAC, *Caregiving in the US 2025*](https://www.aarp.org/press/releases/2025-07-24-new-report-reveals-crisis-point-for-americas-63-million-family-caregivers.html) (released 2025-07-24) |
| **+20 million since 2015** (43M → 63M), a **~45–50% increase** in ten years | [AARP summary](https://www.aarp.org/caregiving/basics/caregiving-in-us-survey-2025/) |
| 59M of the 63M care for someone 18+ | [AARP PRI](https://www.aarp.org/pri/topics/ltss/family-caregiving/caregiving-in-the-us-2025/) |
| Nearly **1 in 4 provide 40+ hours/week**; **1 in 3 have been caregiving 5+ years** | AARP/NAC 2025 press release |
| Unpaid family care was worth **$600 billion** in 2021 — more than the **$433B** Americans spent out-of-pocket on *all* healthcare that year | [AARP, *Valuing the Invaluable* 2023](https://www.aarp.org/caregiving/financial-legal/unpaid-caregivers-provide-billions-in-care/) |
| Caregivers spend **~$7,200/year** out of pocket | AARP/NAC 2025 |

**Survey quality note (worth saying out loud to judges):** *Caregiving in the US* has run since 1997
(1997, 2004, 2009, 2015, 2020, 2025); the 2025 edition is a nationally representative
probability-based IPSOS panel, **n=6,858** caregivers. This is the authoritative count, not a vendor
estimate.

## 2. The harm is measurable, and it is physical

| Figure | Source |
|---|---|
| **64%** report high emotional stress; **45%** report high physical strain | [AARP/NAC 2025](https://www.aarp.org/caregiving/basics/caregiving-in-us-survey-2025/) |
| **1 in 5** rate their own health fair or poor; **nearly 1 in 4** say they struggle to care for their own health *because of* caregiving | AARP/NAC 2025 press release |
| Nearly **1 in 4** report feeling socially isolated; emotional stress has **risen since 2020** | AARP/NAC 2025 press release |
| Median prevalence across meta-analyses: **33.4% depression, 35.3% anxiety, 49.3% caregiver burden** | [Umbrella review of meta-analyses, 2025](https://www.sciencedirect.com/science/article/pii/S2950307825000785) |
| Caregivers reporting emotional/physical strain had a **63% higher 4-year mortality risk** than non-caregivers | [Schulz & Beach, *JAMA* 1999 — Caregiver Health Effects Study](https://jamanetwork.com/journals/jama/fullarticle/192209) |
| Unpaid caregivers 45+ show elevated subjective cognitive decline, frequent mental distress, and fair/poor health | [CDC/MMWR analysis, 22 states 2015–2019](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8601410/) |

**Schulz & Beach is the single most important citation in the deck.** It is why "strain" is not a
wellness metric: *self-reported strain is an independent mortality risk factor.* The thing Steady
tries to surface early is the thing that kills people.

## 3. Why nobody catches it today

| Figure | Source |
|---|---|
| Only **~15%** of caregivers were asked by a health professional about **their own health** — i.e. **~85% never were** | [AARP/NAC 2025 via Hospice News](https://hospicenews.com/2025/11/11/family-caregiver-support-education-needs-growing/) |
| Only **27%** were asked about the care recipient's needs (**~73% never were**) | same |
| **Over half** perform complex medical/nursing tasks (injections, wound care, med management); only **~11–20%** have had any training | AARP/NAC 2025 press release |

This is the market gap in one line: **the care recipient is monitored continuously; the caregiver is
asked about themselves roughly never.** There is no instrument in the workflow that looks at the
caregiver, so the first signal the system receives is a crisis.

## 4. Who would pay for this (the part that makes it a market, not a cause)

- **CMS GUIDE Model** — Guiding an Improved Dementia Experience. Launched **2024-07-01**, an
  **8-year** voluntary national model with **390 participating organizations**. It pays a **monthly
  per-beneficiary amount for care management and *caregiver education and support*** and a
  **separate respite payment, capped at $2,563/patient in PY2025**. Services are explicitly for
  beneficiaries *and their unpaid caregivers*.
  [CMS payment methodology](https://www.cms.gov/priorities/innovation/files/guide-payment-methodology-paper.pdf) ·
  [CMS blog](https://www.cms.gov/newsroom/blog/guiding-improved-dementia-experience-clearing-path-comprehensive-high-quality-dementia-care) ·
  [LeadingAge summary](https://leadingage.org/serialpost/guide-model-aid-for-people-living-with-dementia-unpaid-caregivers/)
  → **This is Steady's buyer.** A GUIDE program is contractually obligated to support caregivers and
  to spend a respite budget. Steady's care-manager view is a tool for deciding *which* caregiver
  needs the respite dollars *this week*. That is exactly the product.
- **2022 National Strategy to Support Family Caregivers** (RAISE Act) — ~350 federal actions plus
  150+ for states and the private sector; nearly all 2022 federal commitments complete or in
  progress. Policy tailwind, and a source of grant funding.
  [ACL](https://acl.gov/news-and-events/announcements/hhs-releases-progress-report-federal-implementation-national-strategy)
- **Medicaid / Older Americans Act** — the National Family Caregiver Support Program funds Area
  Agencies on Aging to deliver respite and counseling; states increasingly pay family caregivers
  through Medicaid. [NASHP](https://nashp.org/medicaid-supports-for-family-caregivers/)
- **Medicare Advantage** supplemental benefits now include respite and caregiver supports in select
  2026 plans; expanded **remote physiologic monitoring (RPM)** codes are the reimbursement rail for
  wearable-derived monitoring.
- **Employers.** Working caregivers cost employers real money in absenteeism and turnover. Estimates
  range widely by source (**~$33B**, Milken Institute) — *use a range and name the source, or skip
  it*; the vendor numbers in this space are not defensible under questioning.

**On market-size reports:** third-party "caregiver app market" figures range from ~$0.5B to ~$2.8B in
2025 depending on the firm ([FactMR](https://www.factmr.com/report/digital-caregiver-platforms-market),
[MarketIntelo](https://marketintelo.com/report/ai-powered-caregiver-support-platform-market)). They
disagree by 5x, so **lead with GUIDE's 390 contracted organizations and the $600B of unpaid labor,
not with a market-research number.** Verifiable beats big.

## 5. Scientific basis: can wearables see caregiver strain at all?

**Yes, as an objective correlate of burden:**
- Dementia caregivers show **lower (worse) HRV than non-caregivers**, measured nightly over three
  months — HRV is usable as an objective digital assessment of caregiver burden.
  [Pain and HRV in Caregivers of People with Dementia](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12788724/)
- Wrist-sensor HRV + skin conductance detect stress incidence in dementia caregivers.
  [Gerontological study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6840367/)
- Caregivers of people with dementia have high stress and poor sleep quality, predictable from
  physiological signals. [Sleep quality prediction in caregivers](https://ncbi.nlm.nih.gov/pmc/articles/PMC6655554)

**And prospectively — physiology leads, self-report follows:**
- Multiple N-of-1 study, 8 police officers, Oura ring, 15–55 weeks each: total sleep time and resting
  HRV were **more consistent predictors of stress-resilience in *upcoming* days than indicators of
  stress in *prior* days.** Associations were bidirectional but **weak-to-moderate and not consistent
  across participants.**
  [Sensors 2023;23(1):332](https://www.mdpi.com/1424-8220/23/1/332)
- N=525, 3,112 weekly observations: each extra hour of sleep → **38% lower odds** of moderate-to-high
  stress; each +1 bpm resting HR → **+3.6% odds**; each +1 ms HRV → **−1.2% odds**.
  [Bloomfield et al., *PLOS Digital Health* 2024;3(4):e0000473](https://journals.plos.org/digitalhealth/article?id=10.1371%2Fjournal.pdig.0000473)
  *(concurrent, not predictive — cite it for effect direction and magnitude, not for lead time.)*

### What the literature does NOT support — and how Steady is built around that

1. **"Weak-to-moderate, and inconsistent across participants"** (Sensors 2023) is the finding that
   justifies **per-person z-scores instead of population thresholds**. A population cutoff would be
   wrong for most individuals; the research says so directly.
2. **Lab stress-detection accuracy does not transfer.** Reviews report 98–100% F1 in controlled
   settings, but one model at **99.78% internal validation dropped to accuracy 0.73 / F1 0.58 on
   real-world external data**; personalization-based approaches land at **F1 0.62–0.66**, and
   context-aware models range 0.41–0.90.
   [Systematic review](https://www.sciencedirect.com/science/article/pii/S0010482525015197) ·
   [Scoping review](https://pmc.ncbi.nlm.nih.gov/articles/PMC13427063/)
   → **Steady's episode classifier (AUC 0.803, F1 0.577, person-held-out) sits squarely inside the
   real-world validated band, not the lab band.** Say that on the slide. It reframes a modest-looking
   number as an honest one, and it pre-empts the "why isn't your accuracy 95%?" question.
3. **Nothing here supports predicting mood from wearables**, which is exactly what our own experiment
   found (r≈0, AUC 0.46) before we pivoted to physiological load. Our negative result agrees with
   the literature; we just paid to learn it firsthand.

## 6. Training data provenance

**LifeSnaps** (Zenodo 6832242, CC BY 4.0) — 71 participants, 63 usable, 2021-04-08 to 2022-01-22,
Fitbit daily signals plus SEMA/PANAS/STAI self-reports. General Fitbit wearers, **not caregivers**.
This is the honest ceiling on every claim Steady makes: the pipeline is real, the population is a
proxy, and the Methods & Limits page says so in the product.

---

## The 30-second version (for the pitch)

> 63 million Americans are family caregivers — up 20 million in a decade. 64% report high emotional
> stress, 45% high physical strain, and strain like that carries a **63% higher four-year mortality
> risk**. Yet only about **15%** have ever been asked by a health professional about their own health.
> The signals are already on their wrist — dementia caregivers measurably have worse HRV than
> non-caregivers, and sleep and HRV predict the *next* few days better than they explain the last
> few. Meanwhile **390 organizations** are now contractually paid by CMS to support caregivers and
> hand out a capped respite budget, with no instrument for deciding who needs it first.
> That's Steady.
