# CRH Telehealth E/M Coding Assistant

Static prototype for a Clinical Resource Hub telehealth Evaluation and Management coding workflow.

## Scope

- CVT, VVC, and telephone workflow prompts
- Telemedicine E/M code family by MDM or same-date clinician time for VA workload and CPT telehealth logic
- Office/outpatient E/M code family by MDM or same-date clinician time for Medicare/CMS policy-check logic
- Telephone eligibility checks to avoid coding administrative calls or brief result notifications as E/M
- CRH telehealth documentation checks for synchronous care, patient presence, consent/modality, and site-support data
- Medicare/CMS prolonged office/outpatient prompt for G2212
- G2211 workflow guardrails, including modifier 25 and preventive-service prompts
- Same-day procedure and modifier 25 checks
- Copyable documentation-support summary

## Source Set Reviewed

Guidance was reviewed on May 28, 2026 from CMS, AMA, AAFP, public VHA policy sources linked inside the app, and the local VA coding coordinator handouts:

- `2026 MDM Time Telemedicine Auido only Guidelines.docx`
- `2026 MDM Time Telemedicine Auido Visual Guidelines.docx`

The app is a coding aid, not a replacement for the current CPT Professional Edition, VA facility coding policy, DSS/stop-code guidance, payer policy, or certified coding review.

See `CODING_CROSSWALK.md` for the local handout crosswalk used by the app.

## Run Locally

Open `index.html` directly in a browser, or serve the folder with any static file server.
