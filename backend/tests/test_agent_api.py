"""MainAgent HTTP integration. Default-production probes never invent analyses.

Test-only provider callbacks are used solely for transport/ranking review coverage;
they are never installed in backend.main or the live-runtime demonstration.
"""
import json
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.agent.models import AnalysisRequest, CarbonToolResult, FinancialToolResult, TransitionOptionsResult
from backend.carbon.carbon_service import calculate_carbon_result
from backend.data.intake.models import DataIntakeResult
from backend.agent.router import create_agent_router
from backend.data.intake.router import IntakeRegistry, create_intake_router
from backend.runtime.services import ProductionAnalysisServices

FULL = ("company_id,reporting_year,revenue,operating_expenses,cash_balance,annual_debt_service,capex_budget,minimum_cash_reserve,"
        "electricity_kwh,diesel_litres,petrol_litres,natural_gas_m3,lpg_kg,reporting_period\n"
        "TEST,2024,10000,7000,2000,500,1000,500,100,0,0,0,0,2024")


def client_for(monkeypatch, services=None, assistant=None):
    monkeypatch.setattr("backend.data.intake.llm.GeminiMappingAssistant.suggest", lambda *_: [])
    registry = IntakeRegistry()
    app = FastAPI()
    app.include_router(create_intake_router(registry))
    app.include_router(create_agent_router(registry, services=services or ProductionAnalysisServices(),
                                         assistant=assistant or Mock(explain=Mock(return_value=None))))
    return TestClient(app)


def upload(client, content=FULL, quality="DIRECT_MEASURED", modules=None):
    response = client.post("/api/intake/start", data={"reviewer": "Actual reviewer", "evidence_quality": quality,
        "quality_basis": "Source export" if quality != "UNKNOWN" else "",
        "requested_modules": json.dumps(modules or ["carbon_analysis", "financial_analysis", "transition_analysis"])},
        files=[("files", ("source.csv", content.encode()))])
    assert response.status_code == 200, response.text
    return response.json()


def auth(intake):
    return {"Authorization": f"Bearer {intake['access_token']}"}


def start(client, intake, mode="PLAN_TRANSITION", **objective):
    response = client.post("/api/agent/start", headers=auth(intake), json={"intake_id": intake["intake_id"],
        "objective": {"mode": mode, **objective}})
    assert response.status_code == 200, response.text
    return response.json()


def resume(client, intake, run, action, **changes):
    return client.post(f"/api/agent/{run['run_id']}/resume", headers=auth(intake),
        json={"action": action, "reason": "Explicit human decision", "revision": run["revision"], **changes})


def test_production_plan_uses_server_intake_and_reports_transition_unavailable(monkeypatch):
    with client_for(monkeypatch) as client:
        intake = upload(client)
        run = start(client, intake)
        assert run["result"]["intake_result"] == intake["result"]
        assert run["result"]["status"] == "NEEDS_CONTEXT"
        assert run["awaiting"] == "context" and run["interrupts"]
        assert run["result"]["recommendation"] is None
        assert run["service_status"]["get_carbon_analysis"] == "AVAILABLE"
        assert run["service_status"]["get_transition_options"] == "SERVICE_UNAVAILABLE"
        assert any("SERVICE_UNAVAILABLE:transition:" in text for text in run["result"]["missing_context"])
        carbon = run["result"]["tool_results"]["get_carbon_analysis"]["data"]
        assert carbon["reporting_year"] == 2024
        assert carbon["scope1_emissions_tco2e"] == 0
        assert carbon["scope2_emissions_tco2e"] == 0.0584
        assert carbon["total_tco2e"] == 0.0584
        assert carbon["emissions_by_source"][0]["activity_value"] == 100
        assert carbon["emissions_by_source"][0]["factor_kgco2e_per_unit"] == 0.584
        assert carbon["emissions_by_source"][0]["emissions_kgco2e"] == 58.4
        assert carbon["emissions_by_source"][0]["scope"] == "Scope 2"
        financial = run["result"]["tool_results"]["get_financial_analysis"]["data"]
        assert financial["cash_balance"] == 2000
        assert financial["annual_cash_available_for_debt_service"] is None
        assert financial["origin"] == "SERVICE"
        events = [event["event"] for event in run["result"]["execution_trace"]]
        assert events[:3] == ["AGENT_STARTED", "READINESS_CHECKED", "TOOL_PLAN_SELECTED"]
        assert "TOOL_CALLED" in events and "RECOMMENDATION_GENERATED" not in events
        assert resume(client, intake, run, "ACCEPT").status_code == 409
        updated = resume(client, intake, run, "RESUME", objective={"mode": "ASSESS_FINANCIAL"})
        assert updated.status_code == 200, updated.text
        assert updated.json()["awaiting"] == "human_review"


def test_carbon_result_uses_all_normalized_activity_and_preserves_zero_and_missing(monkeypatch):
    csv = (
        "company_id,reporting_year,floor_area_m2,electricity_kwh,diesel_litres,petrol_litres,"
        "natural_gas_m3,lpg_kg,reporting_period\n"
        "TEST,2024,100,1000,10,5,2,3,2024"
    )
    with client_for(monkeypatch) as client:
        intake = upload(client, csv, modules=["carbon_analysis"])
        run = start(client, intake, "ASSESS_CARBON")
        assert run["service_status"]["get_carbon_analysis"] == "AVAILABLE"
        result = run["result"]["tool_results"]["get_carbon_analysis"]["data"]
        assert result["reporting_year"] == 2024
        assert result["scope1_emissions_tco2e"] == pytest.approx(0.0512992)
        assert result["scope2_emissions_tco2e"] == pytest.approx(0.584)
        assert result["total_tco2e"] == pytest.approx(0.6352992)
        assert result["carbon_intensity"]["value"] == pytest.approx(6.352992)
        assert result["carbon_intensity"]["unit"] == "kgCO2e/m2"
        assert result["carbon_intensity"]["floor_area_m2"] == 100
        assert len(result["factor_provenance"]) == 5
        assert result["data_confidence"]["evidence_record_count"] == 5
        assert result["emissions_by_source"][0]["evidence"][0]["source_file"] == "source.csv"

        zero = upload(client, FULL.replace(",100,0,0,0,0,2024", ",0,0,0,0,0,2024"))
        zero_run = start(client, zero, "ASSESS_CARBON")
        zero_result = zero_run["result"]["tool_results"]["get_carbon_analysis"]["data"]
        electricity = zero_result["emissions_by_source"][0]
        assert electricity["activity_value"] == 0
        assert electricity["emissions_kgco2e"] == 0
        assert zero_result["scope2_emissions_tco2e"] == 0
        assert zero_result["total_tco2e"] == 0

        missing_snapshot = DataIntakeResult.model_validate(intake["result"])
        missing_snapshot.normalized_data.activity.diesel_litres = None
        missing_result = calculate_carbon_result(missing_snapshot)
        diesel = next(item for item in missing_result.emissions_by_source if item.source == "Diesel")
        assert diesel.activity_value is None
        assert diesel.emissions_kgco2e is None
        assert missing_result.activity_data_complete is False
        assert missing_result.emissions_by_source[0].share_pct is None
        assert "diesel_litres: activity value was not supplied" in missing_result.missing_data

        mismatched_period = DataIntakeResult.model_validate(zero["result"])
        electricity_evidence = next(item for item in mismatched_period.evidence if item.field == "electricity_kwh")
        electricity_evidence.reporting_period = "2023"
        period_result = calculate_carbon_result(mismatched_period)
        electricity = period_result.emissions_by_source[0]
        assert electricity.activity_value == 0
        assert electricity.emissions_kgco2e is None
        assert "electricity_kwh: evidence period does not match reporting year 2024" in period_result.missing_data

        unknown_unit = DataIntakeResult.model_validate(zero["result"])
        electricity_evidence = next(item for item in unknown_unit.evidence if item.field == "electricity_kwh")
        electricity_evidence.normalized_unit = "MWh"
        unit_result = calculate_carbon_result(unknown_unit)
        assert unit_result.emissions_by_source[0].emissions_kgco2e is None
        assert "electricity_kwh: normalized evidence unit must be kWh" in unit_result.missing_data


@pytest.mark.parametrize("action,expected", [("ACCEPT", "ACCEPTED"), ("REJECT", "REJECTED"), ("REQUEST_ALTERNATIVE", "NEEDS_CONTEXT")])
def test_real_financial_snapshot_review_interrupts(monkeypatch, action, expected):
    with client_for(monkeypatch) as client:
        intake = upload(client)
        run = start(client, intake, "ASSESS_FINANCIAL")
        assert run["awaiting"] == "human_review"
        assert run["result"]["recommendation"]["selected_pathway_id"] is None
        assert run["service_status"]["get_carbon_analysis"] == "NOT_CALLED"
        final = resume(client, intake, run, action)
        assert final.status_code == 200, final.text
        assert final.json()["result"]["status"] == expected
        assert final.json()["result"]["human_history"][-1]["actor"] == "Actual reviewer"
        assert resume(client, intake, run, action).status_code == 409


def test_blocked_and_unaccepted_partial_never_call_services(monkeypatch):
    provider = Mock()
    with client_for(monkeypatch, ProductionAnalysisServices(financial=provider)) as client:
        intake = upload(client, "revenue\n-1", modules=["financial_analysis"])
        blocked = start(client, intake, "ASSESS_FINANCIAL")
        assert blocked["result"]["status"] == "NEEDS_CONTEXT"
        assert blocked["result"]["tool_results"] == {}
        partial = upload(client, FULL, quality="UNKNOWN")
        waiting = start(client, partial, "ASSESS_FINANCIAL")
        assert waiting["result"]["tool_results"] == {}
        provider.assert_not_called()


def test_resume_loads_latest_partial_acceptance_and_preserves_limitations(monkeypatch):
    with client_for(monkeypatch) as client:
        intake = upload(client, FULL, quality="UNKNOWN")
        run = start(client, intake, "ASSESS_FINANCIAL")
        accepted = client.post(f"/api/intake/{intake['intake_id']}/resume", headers=auth(intake),
            data={"response": json.dumps({"action": "continue_incomplete", "reason": "Explicitly accepted gaps"})})
        assert accepted.status_code == 200
        final = resume(client, intake, run, "RESUME")
        assert final.status_code == 200, final.text
        state = final.json()["result"]
        assert state["status"] == "HUMAN_REVIEW_REQUIRED"
        assert state["readiness"]["financial_analysis"]["status"] == "PARTIAL"
        assert state["readiness"]["financial_analysis"]["partial_accepted"]
        assert any("PARTIAL" in warning for warning in state["warnings"])


def test_capability_scope_and_client_result_injection_rejected(monkeypatch):
    with client_for(monkeypatch) as client:
        intake, other = upload(client), upload(client)
        run = start(client, intake, "ASSESS_FINANCIAL")
        path = f"/api/agent/{run['run_id']}"
        assert client.get(path + "/result").status_code == 404
        assert client.get(path + "/result", headers=auth(other)).status_code == 404
        assert client.get(path + "/result", headers=auth(intake)).json()["result"] == run["result"]
        assert client.post("/api/agent/start", headers=auth(intake), json={"intake_id": intake["intake_id"],
            "objective": {}, "intake_result": intake["result"]}).status_code == 422
        assert resume(client, intake, run, "ACCEPT", actor="Impostor").status_code == 422
        assert resume(client, intake, run, "ACCEPT", tool_results={}).status_code == 422


def test_production_boundary_rejects_test_doubles_bad_scope_and_provider_errors(monkeypatch):
    with client_for(monkeypatch) as client:
        intake = upload(client)
    request = AnalysisRequest(intake=intake["result"], objective={})
    for callback in (
        lambda _: CarbonToolResult(data={"company_id": "TEST", "reporting_year": 2024, "source": "test", "origin": "TEST_DOUBLE"}),
        lambda _: CarbonToolResult(data={"company_id": "OTHER", "reporting_year": 2024, "source": "other"}),
        Mock(side_effect=RuntimeError("private credentials")),
    ):
        result = ProductionAnalysisServices(carbon=callback).get_carbon_analysis(request)
        assert result.data is None
        assert "SERVICE_UNAVAILABLE" in result.missing_context[0]
        assert "private credentials" not in str(result)


def test_test_only_catalog_exercises_alternative_reranking_without_graph_changes(monkeypatch):
    # Explicit HTTP transport test data, not a service installed in the application.
    identity = {"company_id": "TEST", "reporting_year": 2024, "source": "TEST_ONLY_PROVIDER"}
    services = ProductionAnalysisServices(
        carbon=lambda _: CarbonToolResult(data={**identity, "total_tco2e": 10,
            "impact_groups": {"power": {"annual_emissions_tco2e": 10, "annual_cost": 1000}}}),
        transition=lambda _: TransitionOptionsResult(data={**identity,
            "actions": [{"action_id": name, "name": name, "impact_group": "power", "capex": cost,
                "emissions_reduction_fraction": fraction, "cost_saving_fraction": fraction}
                for name, cost, fraction in [("A", 100, .1), ("B", 200, .2)]],
            "pathways": [{"pathway_id": name, "name": name, "action_ids": [name]} for name in ["A", "B"]]}))
    with client_for(monkeypatch, services) as client:
        intake = upload(client)
        run = start(client, intake, funding={"mode": "CASH_ONLY", "grant_amount": 0})
        assert run["result"]["recommendation"]["selected_pathway_id"] == "B"
        alternative = resume(client, intake, run, "REQUEST_ALTERNATIVE")
        assert alternative.status_code == 200, alternative.text
        alternative = alternative.json()
        assert alternative["result"]["recommendation"]["selected_pathway_id"] == "A"
        assert alternative["awaiting"] == "human_review"
        assert sum(item["event"] == "PATHWAYS_RANKED" for item in alternative["result"]["execution_trace"]) == 2
        final = resume(client, intake, alternative, "ACCEPT").json()
        assert final["result"]["status"] == "ACCEPTED"
        assert "lender_pack" not in final["result"]


def test_snapshot_preserves_zero_without_claiming_cfads(monkeypatch):
    with client_for(monkeypatch) as client:
        intake = upload(client, "company_id,reporting_year,cash_balance\nTEST,2024,0", modules=["financial_analysis"])
        client.post(f"/api/intake/{intake['intake_id']}/resume", headers=auth(intake),
                    data={"response": json.dumps({"action": "continue_incomplete", "reason": "Accept missing fields"})})
        run = start(client, intake, "ASSESS_FINANCIAL")
        facts = run["result"]["tool_results"]["get_financial_analysis"]["data"]
        assert facts["cash_balance"] == 0
        assert facts["capex_budget"] is None
        assert facts["annual_cash_available_for_debt_service"] is None


def test_main_app_mounts_agent_routes():
    from backend.main import app
    assert {"/api/agent/start", "/api/agent/{run_id}/resume", "/api/agent/{run_id}/result"} <= {route.path for route in app.routes}
