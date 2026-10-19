# MainAgent application runtime

The existing graph, typed tools, constraints, financing and ranking are unchanged.
The React AI Copilot calls FastAPI rather than the Express chat/priority selector.
No lender-pack or disclosure operations are exposed here.

## API

Use the bearer capability returned by `/api/intake/start` in `Authorization`.
The API resolves DataIntakeResult from the Phase 1 server checkpoint, never client
JSON. The reviewer label comes from that same intake session.

- `POST /api/agent/start`: JSON `{ "intake_id": "...", "objective": {...} }`.
  Objective uses the existing `SMEObjective` schema. Mode is PLAN_TRANSITION,
  ASSESS_CARBON or ASSESS_FINANCIAL. Unknown numeric constraints stay null.
- `GET /api/agent/{run_id}/result`: retrieve graph state, pending interrupts,
  service statuses and execution trace.
- `POST /api/agent/{run_id}/resume`: JSON `{ "action": "...", "reason": "...",
  "revision": 0 }`. Use the revision in the most recent result.
  At a context interrupt use RESUME (optionally with a structured `objective`) or
  CANCEL. RESUME reloads the current Phase 1 result. At human_review use ACCEPT,
  REJECT or REQUEST_ALTERNATIVE. These invoke LangGraph Command(resume=...).

Each run is scoped to its intake capability and company/reporting period. Review
rejects changed intake snapshots and stale revisions. BLOCKED or unaccepted
PARTIAL intake is handled by the graph before service tools execute. Complete
intake clarification in Data & Documents, then resume the same agent run.

## Production services and Carbon boundary

`backend.runtime.services.ProductionAnalysisServices` implements the existing
`backend.agent.tools.AnalysisServices` protocol. Carbon defaults to the
deterministic `backend.carbon.agent_adapter:get_carbon_analysis` implementation.
Providers have these signatures:

```python
def get_carbon_analysis(request: AnalysisRequest) -> CarbonToolResult: ...
def get_financial_analysis(request: AnalysisRequest) -> FinancialToolResult: ...
def get_transition_options(request: AnalysisRequest) -> TransitionOptionsResult: ...
```

A Carbon teammate can implement an adapter anywhere without changing the graph
or importing the runtime from Carbon. Configure its server-owned import path:

```text
GREENBRIDGE_CARBON_SERVICE=backend.carbon.agent_adapter:get_carbon_analysis
GREENBRIDGE_FINANCIAL_SERVICE=your_finance_adapter:get_financial_analysis
GREENBRIDGE_TRANSITION_SERVICE=your_catalog_adapter:get_transition_options
```

These are optional module:function callables loaded at application startup; a
configured Carbon provider replaces the default implementation. Restart the API
after configuring providers. No API request can choose an import path. Return
SERVICE-origin, company/year-scoped results. TEST_DOUBLE values, invalid
responses and provider failures fail closed as SERVICE_UNAVAILABLE. AgentTools
continues enforcing typed validation, readiness and financial snapshot consistency.

Current default capabilities:

- Carbon: deterministic Scope 1 fuel and Scope 2 purchased-electricity analysis
  from the normalized Phase 1 activity snapshot. The `CarbonResult` includes
  source-level activity/factor calculations, intake evidence metadata,
  missing-data warnings and factor provenance. Missing activity remains unknown.
  The intake currently has no grid-region field, so the Peninsular Malaysia
  electricity factor is disclosed as the default. Intensity is withheld unless
  all supported activity values and a positive floor-area denominator are
  present. Factor versions identify the documented source year; they do not
  change or combine the intake reporting year.
- Financial: real published intake snapshots (cash, budget, reserve and annual
  debt service). Nulls and zero are preserved. CFADS and minimum DSCR are unknown.
  This is **not** complete statement/CFADS analysis. The existing finance engine
  needs richer inputs; this adapter never fabricates those or treats EBITDA as CFADS.
- Transition: SERVICE_UNAVAILABLE. The legacy generator needs cost/factor inputs
  absent from Phase 1 and lacks the sourced disjoint impact-group catalog contract.
  It is not called with benchmark data or converted to invented reduction fractions.

The older Express `/api/carbon` routes and TypeScript Carbon calculations remain
for legacy/demo workspace flows only. The Carbon Analysis page and MainAgent use
the Phase 1 DataIntakeResult → Carbon Engine → CarbonResult path above; they do
not read or recalculate those legacy results.

An unavailable provider returns a typed tool result with a
`SERVICE_UNAVAILABLE:<module>:<reason>` missing-context entry. The unchanged graph
pauses at request_context; the frontend shows that result rather than a fallback
pathway. AVAILABLE in the transport means a typed service result exists, not that
every financial metric is known or independently verified.

## Decision authority and lifecycle

Objectives use structured controls. Description text is context only, never an
implicitly interpreted numeric constraint. Existing GeminiAssistant provides
qualitative explanation only; invalid or unavailable narration cannot change
selection, numbers, constraints or ranking. Numeric facts remain separate.

Sessions/checkpoints are in one backend process and expire on restart. Use a
single worker for this phase. Capabilities isolate demo sessions; reviewer labels
are not a production identity provider. Human acceptance is neither disclosure
authorization nor lender approval.

Run `python -m pytest backend/tests/test_agent_api.py -q` and, from frontend,
`node --import tsx --test tests/agent.test.tsx`. The latter starts an isolated real
FastAPI process and renders its outputs through the production React panel.
