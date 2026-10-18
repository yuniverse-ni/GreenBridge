# Phase 2: lender pack and disclosure boundary

`lender_pack.py` copies deterministic results from a server-held **ACCEPTED**
MainAgent run. It does not run calculations, call an LLM, submit documents, or
change MainAgent. All money is MYR, reductions are tCO2e/year, and payback is years.

## Contracts

`LenderPack` contains `pack_id`, `version`, `created_at`, `content_hash`,
`content`, `status`, `requested_sections`, `decision`, and append-only `audit`.
`shareable`/`submittable` are derived authorization flags, not delivery actions.

`PackContent` contains:

| Field | Contents / classification |
| --- | --- |
| company | Company ID/name and reporting year; reported, unverified |
| transition_project | Selected actions, descriptions, CAPEX, savings, payback; projected |
| financial_summary | Reported financial position and service-supplied CFADS; unverified |
| financing_request | Reconciled funding, terms, repayments, total interest, company DSCR; projected |
| carbon_impact | Reported/unverified baseline; projected reduction and percentage |
| transition_kpis | Copied savings, reduction, payback, remaining cash, net cash flow, DSCR; projected |
| evidence_provenance | Module readiness, partial acceptance flag, full typed value provenance, gaps, mock flag; unverified |
| assumptions_limitations | Deterministic assumptions, warnings, limitations and deployment-declared tool versions |

No numeric values are recalculated. Funding reconciliation and company/year
matching are integrity checks only. Missing financing terms/results remain null,
including cash-funded projects. No document is asserted independently verified.
Missing service/tool versions remain unknown; deployment code supplies versions.

## Lifecycle and approval

`generate_draft` -> DRAFT

`request_disclosure_review(reference, sections)` -> PENDING_DISCLOSURE_APPROVAL

`decide_disclosure(DisclosureDecision)` -> APPROVED or REJECTED

The decision action is explicitly `APPROVE_DISCLOSURE` or `REJECT_DISCLOSURE`.
The owner must confirm the exact pack ID, version, content hash **and** nonempty
requested section set. To change pending content/scope, generate a new draft
version; rejection does not allow access. Acceptance of a pathway grants no
disclosure permission. Approval is permission to share a particular snapshot,
not lender approval, company verification, credit eligibility or a guarantee.

The hash covers pack ID/version/time/content. The repository seals the entire
serialized record (including decision/scope/audit) with a process-private HMAC.
It rejects tampering even if someone replaces the public content hash. Terminal
versions cannot be overwritten. Returned models are detached copies; nested
lists are not deeply frozen Python objects, but changing them cannot change a
stored snapshot. A changed detached model also fails its shareability check.
Lender output is always built afresh from sealed storage, never a caller model.

## Authorization and disclosure

`AuthorizationProvider.authenticate(credential)` resolves an opaque credential
to a trusted `Principal`. No request DTO accepts a role or approver name.

| Role | Policy |
| --- | --- |
| SME_OWNER | Own-company draft/read/review; exclusively approve/reject disclosure |
| FINANCE_MANAGER | Own-company draft/read/review; cannot approve/reject |
| LENDER | Exact-version grant plus APPROVED status required to read lender view; no internal read/edit/generation/approval |

`StaticAuthorizationProvider` and `InMemoryAcceptedRuns` are trusted bootstrap/
test adapters. Never populate them from client role fields or client-supplied
graph results. A real session provider and checkpoint-backed accepted-run
provider can replace them without changing the disclosure policies. Provision
lender grants through trusted backend code, not an unprotected request field.

`lender_view` returns a typed `LenderView`: basic company/reporting metadata,
pack ID/version, approval timestamp, generic safety/evidence status, and only
the approved `sections`. The six scope choices are `transition_project`,
`financial_summary`, `financing_request`, `carbon_impact`, `evidence_provenance`,
and `assumptions_limitations`. Project scope includes project CAPEX/savings;
financing scope includes company DSCR. The owner must review these concrete
section contents, rather than assuming project scope has no financial metrics.
No global KPI dump can leak remaining cash or DSCR through another scope.

Raw LLM narration, agent reasoning/trace, provider diagnostics, credentials,
arbitrary graph keys, and internal audit records never enter lender output.
Evidence section approval authorizes the contained source references and values;
financial columns may be present there and must be reviewed before approval.
PARTIAL and mock status are always signalled without exposing withheld evidence.
Uploaded evidence/text stays data; this module never executes instructions in it.

## Remaining integration

Storage and credentials here are in memory. Production needs durable transactional
storage, protected signing/seal keys with rotation, real session authentication,
tenant authorization, authenticated accepted-checkpoint lookup, approved-recipient
grant provisioning/revocation, access audit storage, and retention controls.
The seal detects record tampering, not a fully compromised server or rollback of
its entire memory. There are no FastAPI routes, lender delivery, PDF exports, or
frontend changes in this phase. Connect these only through the service methods;
never return an internal `LenderPack` to a lender. See `examples/phase2_lender_view.json`
for an offline test-double example with just project, financing and carbon scope.
