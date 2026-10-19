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
`backend.agent.tools.AnalysisServices` protocol. Providers have these signatures:

```python
def get_carbon_analysis(request: AnalysisRequest) -> CarbonToolResult: ...
def get_financial_analysis(request: AnalysisRequest) -> FinancialToolResult: ...
def get_transition_options(request: AnalysisRequest) -> TransitionOptionsResult: ...
```

Production defaults use the real Carbon and Finance services. Optional deployment
providers can override the stable boundary without changing the graph:

```text
GREENBRIDGE_CARBON_SERVICE=backend.carbon.carbon_service:get_carbon_analysis
GREENBRIDGE_FINANCIAL_SERVICE=your_finance_adapter:get_financial_analysis
GREENBRIDGE_TRANSITION_SERVICE=your_catalog_adapter:get_transition_options
```

These are optional module:function callables loaded at application startup. The
Carbon provider is implemented and also selected when no override is configured.
Restart the API after configuring providers. No API request can choose an import path.
Return SERVICE-origin, company/year-scoped results. TEST_DOUBLE values, invalid
responses and provider failures fail closed as SERVICE_UNAVAILABLE. AgentTools
continues enforcing typed validation, readiness and financial snapshot consistency.

Current default capabilities:

- Carbon: `backend.carbon.carbon_service.get_carbon_analysis` returns the same
  `CarbonResult` (`CarbonAnalysis` compatibility name) to MainAgent and the UI's
  `GET /api/carbon/intakes/{intake_id}/result` capability-scoped endpoint. It uses
  only server-owned DataIntakeResult, with the existing readiness gate. The five
  existing TypeScript coefficients are ported into the Python registry. Activity
  is multiplied once; the already normalized totals are not added to evidence.
  Scope 1 is the four fuels, Scope 2 is electricity only. No generic category
  factor exists. Missing sources and incomplete scope/overall totals stay null;
  `known_emissions` explicitly reports only the supplied-source subtotal. Genuine
  zero remains zero. Floor-area intensity uses the uploaded positive denominator.
  Original provenance, evidence quality and extraction/mapping confidence are
  preserved; no synthetic verification score is generated. Region is absent from
  intake, so the existing Peninsular Malaysia factor policy and its 2023 vintage
  are disclosed as assumptions/warnings. References are repository declarations,
  not independently verified factor publications. No LLM chooses numeric factors.
- Financial: the real intake Finance engine returns FinanceResult, including
  supplied financial fields and calculable profit/coverage/liquidity metrics.
  CFADS and loan capacity remain unknown without their additional sourced inputs.
- Transition: SERVICE_UNAVAILABLE. The legacy generator needs cost/factor inputs
  absent from Phase 1 and lacks the sourced disjoint impact-group catalog contract.
  It is not called with benchmark data or converted to invented reduction fractions.

An unavailable provider returns a typed tool result with a
`SERVICE_UNAVAILABLE:<module>:<reason>` missing-context entry. The unchanged graph
pauses at request_context; the frontend shows that result rather than a fallback
pathway. AVAILABLE in the transport means a typed service result exists, not that
every financial metric is known or independently verified.

Carbon Analysis and Overview use the backend result, not the TypeScript baseline,
stored Express emissions, editable profile or legacy Python finance adapter.
Legacy TypeScript/Python routines remain for the out-of-scope Transition/demo
routes; they are not authoritative Carbon sources for this flow. Transition
calculations and graph architecture are unchanged.

Reproduce the 20 canonical field fixture with `test_data/greenbridge_20_fields.csv`
(copied from the existing exact-header regression, plus reporting_period). Expected
Scope 1: 0; Scope 2/total: 0.0584 tCO2e; area intensity: 0.584 kgCO2e/m2. Run
`python -m pytest backend/tests/test_carbon_integration.py -q` and, from frontend,
`node --import tsx --test tests/carbon.test.tsx` for real HTTP/React/MainAgent equality.

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
