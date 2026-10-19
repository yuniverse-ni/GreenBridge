"""Real intake -> CarbonResult -> UI API and unchanged MainAgent runtime."""
import csv
import io
import json
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.agent.models import CarbonResult
from backend.agent.router import create_agent_router
from backend.carbon.carbon_service import analyse_intake_carbon
from backend.carbon.router import create_carbon_router
from backend.data.intake.models import DataIntakeResult
from backend.data.intake.router import IntakeRegistry, create_intake_router
from backend.runtime.services import ProductionAnalysisServices

DEMO = Path(__file__).resolve().parents[2] / "test_data/greenbridge_20_fields.csv"
FIELDS = ["electricity_kwh", "diesel_litres", "petrol_litres", "natural_gas_m3", "lpg_kg"]


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr("backend.data.intake.llm.GeminiMappingAssistant.suggest", lambda *_: [])
    intakes, services = IntakeRegistry(), ProductionAnalysisServices()
    app = FastAPI()
    app.include_router(create_intake_router(intakes))
    app.include_router(create_carbon_router(intakes, services=services))
    app.include_router(create_agent_router(intakes, services=services, assistant=Mock(explain=Mock(return_value=None))))
    with TestClient(app) as client:
        yield client


def content(values=None, year=2024, period="2024"):
    values = values if values is not None else dict(zip(FIELDS, [100, 10, 20, 30, 40]))
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=["company_id", "reporting_year", "reporting_period", *values])
    writer.writeheader()
    writer.writerow({"company_id": "CARBON_TEST", "reporting_year": year, "reporting_period": period, **values})
    return buffer.getvalue()


def upload(client, source=None, quality="DIRECT_MEASURED", extra_files=None):
    response = client.post("/api/intake/start", data={"reviewer": "Carbon reviewer", "requested_modules": '["carbon_analysis"]',
        "evidence_quality": quality, "quality_basis": "Supplied source export" if quality != "UNKNOWN" else ""},
        files=[("files", ("carbon.csv", (source if source is not None else content()).encode())), *(extra_files or [])])
    assert response.status_code == 200, response.text
    return response.json()


def auth(intake):
    return {"Authorization": f"Bearer {intake['access_token']}"}


def result(client, intake):
    response = client.get(f"/api/carbon/intakes/{intake['intake_id']}/result", headers=auth(intake))
    assert response.status_code == 200, response.text
    return response.json()


def accept(client, intake):
    response = client.post(f"/api/intake/{intake['intake_id']}/resume", headers=auth(intake),
        data={"response": json.dumps({"action": "continue_incomplete", "reason": "Accept declared incomplete activity/evidence coverage"})})
    assert response.status_code == 200, response.text
    return response.json()


def test_current_twenty_field_demo_same_carbon_result_in_mainagent(client):
    intake = upload(client, DEMO.read_text())
    assert intake["result"]["mapping_requests"] == []
    assert intake["result"]["agent_next_action"] == "PROCEED"
    facts = result(client, intake)["data"]
    assert facts["scope1_emissions"] == 0
    assert facts["scope2_emissions"] == facts["total_emissions"] == facts["total_tco2e"] == .0584
    assert facts["carbon_intensity"]["value"] == .584
    assert facts["carbon_intensity"]["floor_area_m2"] == 100
    assert facts["emissions_by_source"]["electricity_kwh"]["activity_value"] == 100
    assert facts["provenance"]["electricity_kwh"] == intake["result"]["normalized_data"]["provenance"]["electricity_kwh"]
    assert facts["confidence"]["evidence_quality_counts"] == {"DIRECT_MEASURED": 5}
    assert not facts["confidence"]["externally_verified"]
    assert facts["warnings"]  # Region and factor-vintage applicability is explicit.
    assert json.loads(CarbonResult.model_validate(facts).model_dump_json()) == facts
    run_response = client.post("/api/agent/start", headers=auth(intake), json={"intake_id": intake["intake_id"],
        "objective": {"mode": "ASSESS_CARBON"}})
    assert run_response.status_code == 200, run_response.text
    run = run_response.json()
    assert run["service_status"]["get_carbon_analysis"] == "AVAILABLE"
    assert run["awaiting"] == "human_review"
    assert run["result"]["tool_results"]["get_carbon_analysis"]["data"] == facts
    assert run["service_status"]["get_financial_analysis"] == "NOT_CALLED"
    assert any(item["tool"] == "get_carbon_analysis" and item["event"] == "TOOL_CALLED"
               for item in run["result"]["execution_trace"])


def test_existing_coefficients_exact_classification_and_no_source_rounding(client):
    facts = result(client, upload(client))["data"]
    # Preserved TS coefficients, not the truncated coefficients in the legacy adapter.
    assert facts["scope1_emissions"] == pytest.approx((10 * 2.6865 + 20 * 2.3144 + 30 * 2.0226 + 40 * 2.939) / 1000)
    assert facts["scope2_emissions"] == .0584
    assert facts["total_emissions"] == pytest.approx(facts["scope1_emissions"] + .0584)
    for field, source in facts["emissions_by_source"].items():
        assert source["scope"] == ("Scope 2" if field == "electricity_kwh" else "Scope 1")
        assert source["factor_source"] and source["factor_version"]
        assert source["emissions"] == pytest.approx(source["activity_value"] * source["factor"] / 1000)


@pytest.mark.parametrize("values,scope1,scope2", [
    ({"electricity_kwh": 100}, None, .0584),
    ({"diesel_litres": 10, "petrol_litres": 20, "natural_gas_m3": 30, "lpg_kg": 40}, .251391, None),
])
def test_partial_scope_does_not_invent_zero_or_full_total(client, values, scope1, scope2):
    intake = upload(client, content(values))
    assert result(client, intake)["data"] is None
    intake = accept(client, intake)
    facts = result(client, intake)["data"]
    assert facts["readiness"]["status"] == "PARTIAL" and facts["readiness"]["partial_accepted"]
    assert facts["scope1_emissions"] == scope1
    assert facts["scope2_emissions"] == scope2
    assert facts["total_emissions"] is None and facts["total_tco2e"] is None
    assert facts["carbon_intensity"]["value"] is None
    assert facts["missing_data"]
    for field in set(FIELDS) - set(values):
        assert facts["emissions_by_source"][field]["activity_value"] is None
        assert facts["emissions_by_source"][field]["emissions"] is None


def test_missing_activity_never_publishes_fabricated_zero(client):
    intake = upload(client, content({"floor_area_m2": 100}))
    assert result(client, intake)["data"] is None
    assert not intake["can_continue_incomplete"]


@pytest.mark.parametrize("area,expected", [(100, 0), (0, None), (None, None)])
def test_real_zero_and_missing_denominator(client, area, expected):
    values = {**dict.fromkeys(FIELDS, 0), "floor_area_m2": area}
    facts = result(client, upload(client, content(values)))["data"]
    assert facts["scope1_emissions"] == facts["scope2_emissions"] == facts["total_emissions"] == 0
    assert facts["carbon_intensity"]["value"] == expected
    assert all(item["activity_value"] == item["emissions"] == 0 for item in facts["emissions_by_source"].values())


def test_unknown_category_requires_mapping_and_cannot_get_generic_factor(client):
    intake = upload(client, content({"electricity_kwh": 100, "water_m3": 50}))
    assert intake["result"]["mapping_requests"]
    assert result(client, intake)["data"] is None
    response = client.post(f"/api/intake/{intake['intake_id']}/resume", headers=auth(intake), data={"response": json.dumps({
        "decisions": [{"request_id": item["request_id"], "action": "ignore"} for item in intake["result"]["mapping_requests"]]})})
    assert response.status_code == 200, response.text
    intake = accept(client, response.json())
    facts = result(client, intake)["data"]
    assert set(facts["emissions_by_source"]) == set(FIELDS)
    assert all(item["factor"] != 1 for item in facts["emissions_by_source"].values())
    assert facts["scope2_emissions"] == .0584 and facts["scope1_emissions"] is None


def test_unsupported_units_and_year_mismatch_fail_closed(client):
    bad_unit = upload(client, "metric,value,unit,period\ncompany_id,CARBON_TEST,,2024\nreporting_year,2024,,2024\nelectricity_kwh,10,litres,2024")
    assert result(client, bad_unit)["data"] is None
    mismatch = upload(client, content(period="2023"))
    assert result(client, mismatch)["data"] is None
    valid = upload(client)
    for field, change in [("electricity_kwh", {"normalized_unit": "gallons"}),
                          ("electricity_kwh", {"reporting_period": "2023"})]:
        raw = json.loads(json.dumps(valid["result"]))
        raw["normalized_data"]["provenance"][field][0].update(change)
        assert analyse_intake_carbon(DataIntakeResult.model_validate(raw)).data is None


def test_duplicate_files_and_overlapping_periods_cannot_double_count(client):
    original = content()
    duplicate = upload(client, original, extra_files=[("files", ("duplicate.csv", original.encode()))])
    assert result(client, duplicate)["data"] is None
    repeated = content({"electricity_kwh": 100}) + "CARBON_TEST,2024,2024,100\n"
    assert result(client, upload(client, repeated))["data"] is None
    # Twelve non-overlapping months aggregate in Intake exactly once, not again
    # when Carbon attaches the twelve rows of evidence to its result.
    rows = ["company_id,reporting_year,reporting_period," + ",".join(FIELDS)]
    for month in range(1, 13):
        rows.append(f"CARBON_TEST,2024,2024-{month:02},100,0,0,0,0")
    intake = upload(client, "\n".join(rows))
    facts = result(client, intake)["data"]
    assert facts["emissions_by_source"]["electricity_kwh"]["activity_value"] == 1200
    assert facts["total_emissions"] == .7008
    raw = intake["result"]
    raw["normalized_data"]["provenance"]["electricity_kwh"].append(raw["normalized_data"]["provenance"]["electricity_kwh"][0])
    assert analyse_intake_carbon(DataIntakeResult.model_validate(raw)).data is None


def test_unknown_evidence_requires_acceptance_and_does_not_get_verified(client):
    intake = upload(client, quality="UNKNOWN")
    assert result(client, intake)["data"] is None
    facts = result(client, accept(client, intake))["data"]
    assert facts["confidence"]["evidence_quality_counts"] == {"UNKNOWN": 5}
    assert facts["evidence"] and all(not item["externally_verified"] for item in facts["evidence"])


def test_capability_scoping_and_main_application_route(client):
    intake = upload(client)
    path = f"/api/carbon/intakes/{intake['intake_id']}/result"
    assert client.get(path).status_code == 404
    assert client.get(path, headers=auth(upload(client))).status_code == 404
    from backend.main import app
    assert "/api/carbon/intakes/{intake_id}/result" in {route.path for route in app.routes}
