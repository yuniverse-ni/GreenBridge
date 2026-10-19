"""Production DataIntakeResult -> real Finance engine -> API/MainAgent evidence."""
import csv
import io
import json
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.agent.models import FinanceResult, FinancialAnalysis
from backend.agent.router import create_agent_router
from backend.data.models import FinancialData
from backend.data.intake.router import IntakeRegistry, create_intake_router
from backend.finance_transition.intake_router import create_intake_finance_router
from backend.runtime.services import ProductionAnalysisServices


VALUES = dict(revenue=100000, cogs=40000, operating_expenses=30000, cash_balance=20000,
              operating_cash_flow=18000, annual_debt_service=6000, total_debt=45000,
              current_liabilities=10000, capex_budget=12000, minimum_cash_reserve=5000)


def source_csv(values):
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=["company_id", "reporting_year", "reporting_period", *FinancialData.model_fields])
    writer.writeheader()
    writer.writerow({"company_id": "FINANCE_TEST", "reporting_year": 2024, "reporting_period": "2024", **values})
    return buffer.getvalue()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr("backend.data.intake.llm.GeminiMappingAssistant.suggest", lambda *_: [])
    # A production finance request must never enter the sample-based bridge.
    monkeypatch.setattr("finance_transition.adapter.normalized_to_canonical", Mock(side_effect=AssertionError("Legacy bridge used")))
    monkeypatch.setattr("finance_transition.finance_service.get_standard_sme_financial_model", Mock(side_effect=AssertionError("Sample used")))
    registry, services = IntakeRegistry(), ProductionAnalysisServices()
    app = FastAPI()
    app.include_router(create_intake_router(registry))
    app.include_router(create_intake_finance_router(registry, services=services))
    app.include_router(create_agent_router(registry, services=services, assistant=Mock(explain=Mock(return_value=None))))
    with TestClient(app) as client:
        yield client


def upload(client, values=None, quality="DIRECT_MEASURED"):
    response = client.post("/api/intake/start", data={
        "reviewer": "Finance reviewer", "requested_modules": '["financial_analysis"]',
        "evidence_quality": quality, "quality_basis": "Supplied annual source export" if quality != "UNKNOWN" else "",
    }, files=[("files", ("finance.csv", source_csv(VALUES if values is None else values).encode()))])
    assert response.status_code == 200, response.text
    return response.json()


def auth(intake):
    return {"Authorization": f"Bearer {intake['access_token']}"}


def finance(client, intake):
    response = client.get(f"/api/finance/intakes/{intake['intake_id']}/result", headers=auth(intake))
    assert response.status_code == 200, response.text
    return response.json()


def test_real_finance_result_is_identical_in_api_and_main_agent(client):
    intake = upload(client)
    assert intake["result"]["mapping_requests"] == []
    result = finance(client, intake)["data"]
    assert result["inputs"] == intake["result"]["normalized_data"]["financial"] == VALUES
    assert result["source"] == "backend.finance_transition.finance_service:intake-finance/v1"
    assert result["origin"] == "SERVICE"
    assert result["gross_profit"] == 60000
    assert result["ebitda"] == 30000
    assert result["cash_above_reserve"] == 15000
    assert {name: metric["value"] for name, metric in result["metrics"].items()} == {
        "gross_profit_margin": .6, "ebitda_margin": .3, "cash_ratio": 2,
        "ebitda_debt_service_coverage": 5, "debt_to_ebitda": 1.5,
    }
    assert result["annual_cash_available_for_debt_service"] is None
    assert result["minimum_dscr"] is None
    assert result["readiness"] == intake["result"]["readiness"]["financial_analysis"]
    assert set(result["financial_provenance"]) == set(VALUES)
    for field in VALUES:
        assert result["financial_provenance"][field] == intake["result"]["normalized_data"]["provenance"][field]
        assert any(item["field"] == field and item["normalized_value"] == VALUES[field] for item in result["evidence"])
    assert FinancialAnalysis is FinanceResult  # One contract, compatible graph name.
    assert json.loads(FinanceResult.model_validate(result).model_dump_json()) == result

    run = client.post("/api/agent/start", headers=auth(intake), json={
        "intake_id": intake["intake_id"], "objective": {"mode": "ASSESS_FINANCIAL"}}).json()
    assert run["result"]["intake_result"] == intake["result"]
    assert run["result"]["tool_results"]["get_financial_analysis"]["data"] == result
    assert run["awaiting"] == "human_review"
    assert run["service_status"]["get_financial_analysis"] == "AVAILABLE"
    assert run["service_status"]["get_carbon_analysis"] == "NOT_CALLED"
    assert run["service_status"]["get_transition_options"] == "NOT_CALLED"
    assert any(item["event"] == "TOOL_CALLED" and item["tool"] == "get_financial_analysis"
               for item in run["result"]["execution_trace"])


def test_optional_missing_values_are_unknown_without_weaker_readiness(client):
    values = {key: value for key, value in VALUES.items()
              if key not in ("cogs", "operating_cash_flow", "total_debt", "current_liabilities")}
    intake = upload(client, values)
    assert intake["result"]["readiness"]["financial_analysis"]["status"] == "READY"
    result = finance(client, intake)["data"]
    for field in ("cogs", "operating_cash_flow", "total_debt", "current_liabilities"):
        assert result["inputs"][field] is None
    assert result["gross_profit"] is None and result["ebitda"] is None
    assert all(metric["value"] is None and not metric["is_calculable"] for metric in result["metrics"].values())
    assert result["cash_above_reserve"] == 15000


def test_zero_values_and_zero_denominators_do_not_trigger_fallbacks(client):
    result = finance(client, upload(client, dict.fromkeys(VALUES, 0)))["data"]
    assert result["inputs"] == dict.fromkeys(VALUES, 0)
    assert result["gross_profit"] == result["ebitda"] == result["cash_above_reserve"] == 0
    assert all(metric["value"] is None and metric["formatted"] == "N/A" for metric in result["metrics"].values())
    assert result["annual_cash_available_for_debt_service"] is None


def test_losses_negative_ocf_and_reserve_deficit_are_preserved(client):
    values = {**VALUES, "revenue": 50000, "operating_cash_flow": -2000, "cash_balance": 1000}
    result = finance(client, upload(client, values))["data"]
    assert result["gross_profit"] == 10000 and result["ebitda"] == -20000
    assert result["inputs"]["operating_cash_flow"] == -2000
    assert result["cash_above_reserve"] == -4000
    assert result["metrics"]["ebitda_margin"]["value"] == -.4
    assert result["metrics"]["debt_to_ebitda"]["value"] is None
    assert result["metrics"]["ebitda_debt_service_coverage"]["value"] == pytest.approx(-3.3333)


def test_partial_requires_recorded_acceptance_and_keeps_limitations(client):
    intake = upload(client, quality="UNKNOWN")
    assert finance(client, intake)["data"] is None
    response = client.post(f"/api/intake/{intake['intake_id']}/resume", headers=auth(intake),
                           data={"response": json.dumps({"action": "continue_incomplete", "reason": "Accept missing evidence quality"})})
    assert response.status_code == 200
    result = finance(client, intake)["data"]
    assert result["readiness"]["status"] == "PARTIAL" and result["readiness"]["partial_accepted"]
    assert result["evidence_limitations"]
    assert any(item["evidence_quality"] == "UNKNOWN" for item in result["evidence"])


def test_blocked_and_capability_isolation(client):
    intake = upload(client, {**VALUES, "revenue": -1})
    assert finance(client, intake)["data"] is None
    path = f"/api/finance/intakes/{intake['intake_id']}/result"
    assert client.get(path).status_code == 404
    assert client.get(path, headers=auth(upload(client))).status_code == 404


def test_main_app_mounts_authoritative_finance_route():
    from backend.main import app
    assert "/api/finance/intakes/{intake_id}/result" in {route.path for route in app.routes}
