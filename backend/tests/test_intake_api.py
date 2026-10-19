"""Exercise the real graph through multipart HTTP, without Gemini or other engines."""
import csv
import io
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import Workbook

from backend.data.intake.router import create_intake_router


def annual_rows():
    rows = [["company_id", "PHASE1", "", "2024"], ["reporting_year", 2024, "", "2024"]]
    rows += [[key, value, "RM", "2024"] for key, value in {
        "revenue": 10000, "operating_expenses": 7000, "cash_balance": 2000,
        "annual_debt_service": 500, "capex_budget": 1000, "minimum_cash_reserve": 500,
    }.items()]
    for month in range(1, 13):
        rows += [[key, value, unit, f"2024-{month:02d}"] for key, value, unit in [
            ("electricity_kwh", 1000, "kWh"), ("diesel_litres", 1, "litres"),
            ("petrol_litres", 0, "litres"), ("natural_gas_m3", 0, "m3"), ("lpg_kg", 0, "kg"),
        ]]
    return rows


def csv_bytes(rows):
    target = io.StringIO()
    writer = csv.writer(target)
    writer.writerow(["metric", "value", "unit", "period"])
    writer.writerows(rows)
    return target.getvalue().encode()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr("backend.data.intake.llm.GeminiMappingAssistant.suggest", lambda *_: [])
    app = FastAPI()
    app.include_router(create_intake_router())
    with TestClient(app) as client:
        yield client


def start(client, content, *, filename="records.csv", modules=None, quality="DIRECT_MEASURED"):
    response = client.post("/api/intake/start", data={
        "reviewer": "Phase 1 Reviewer", "requested_modules": json.dumps(modules or ["carbon_analysis", "financial_analysis", "transition_analysis"]),
        "evidence_quality": quality, "quality_basis": "Supplied meter and accounting export" if quality != "UNKNOWN" else "",
    }, files=[("files", (filename, content))])
    assert response.status_code == 200, response.text
    return response.json()


def resume(client, session, response, files=None):
    return client.post(f"/api/intake/{session['intake_id']}/resume",
        headers={"Authorization": f"Bearer {session['access_token']}"},
        data={"response": json.dumps(response), "evidence_quality": "DIRECT_MEASURED", "quality_basis": "Corrected source export"},
        files=files or [])


@pytest.mark.parametrize("kind", ["csv", "xlsx"])
def test_all_rows_ready_and_full_provenance(client, kind):
    rows = annual_rows()
    if kind == "csv":
        content = csv_bytes(rows)
    else:
        workbook = Workbook()
        workbook.active.append(["metric", "value", "unit", "period"])
        for row in rows[:40]:
            workbook.active.append(row)
        other = workbook.create_sheet("Remaining rows")
        other.append(["metric", "value", "unit", "period"])
        for row in rows[40:]:
            other.append(row)
        stream = io.BytesIO()
        workbook.save(stream)
        content = stream.getvalue()
    session = start(client, content, filename=f"records.{kind}")
    result = session["result"]
    assert result["agent_next_action"] == "PROCEED"
    assert session["awaiting"] is None
    assert all(item["status"] == "READY" and item["may_proceed"] for item in result["readiness"].values())
    assert len(result["evidence"]) == 68
    assert result["normalized_data"]["activity"]["electricity_kwh"] == 12000
    assert result["normalized_data"]["activity"]["lpg_kg"] == 0
    assert result["evidence"][-1]["reporting_period"] == "2024-12"
    assert result["evidence"][-1]["source_document_id"] == session["files"][0]["file_id"]
    assert session["files"][0]["size"] == len(content)
    assert "content" not in session["files"][0]
    fetched = client.get(f"/api/intake/{session['intake_id']}/result", headers={"Authorization": f"Bearer {session['access_token']}"})
    assert fetched.status_code == 200
    assert fetched.json()["result"] == result
    assert resume(client, session, {"action": "cancel", "reason": "Finished"}).status_code == 409


def test_invalid_value_beyond_preview_is_blocked(client):
    rows = annual_rows()
    rows[-1][1] = -1
    session = start(client, csv_bytes(rows))
    assert session["awaiting"] == "evidence"
    assert session["result"]["agent_next_action"] == "BLOCK"
    assert session["result"]["normalized_data"] is None
    assert session["result"]["errors"]
    assert not session["can_continue_incomplete"]
    assert resume(client, session, {"action": "continue_incomplete", "reason": "Try bypass"}).status_code == 409


def test_partial_acceptance_preserves_null_and_zero(client):
    session = start(client, b"company_id,reporting_year,revenue,cash_balance\nTEST,2024,0,0", modules=["financial_analysis"], quality="UNKNOWN")
    assert session["result"]["normalized_data"] is None
    assert session["can_continue_incomplete"]
    assert not session["result"]["readiness"]["financial_analysis"]["may_proceed"]
    response = resume(client, session, {"action": "continue_incomplete", "reason": "Review remaining statements later"})
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    assert result["normalized_data"]["financial"]["revenue"] == 0
    assert result["normalized_data"]["financial"]["cash_balance"] == 0
    assert result["normalized_data"]["financial"]["operating_expenses"] is None
    assert result["readiness"]["financial_analysis"]["status"] == "PARTIAL"
    assert result["readiness"]["financial_analysis"]["partial_accepted"]
    assert result["readiness"]["financial_analysis"]["may_proceed"]
    assert not result["readiness"]["carbon_analysis"]["may_proceed"]
    assert result["partial_acceptances"][0]["actor"] == "Phase 1 Reviewer"


def test_mapping_resume_converts_explicit_unit_and_records_reviewer(client):
    session = start(client, b"company_id,reporting_year,Total Power Used,period\nTEST,2024,2,2024", modules=["carbon_analysis"])
    assert session["awaiting"] == "mapping"
    request_id = session["result"]["mapping_requests"][0]["request_id"]
    mapped = resume(client, session, {"actor": "Document cannot impersonate", "decisions": [
        {"request_id": request_id, "action": "confirm", "mapped_field": "electricity_kwh", "unit": "MWh"}]})
    assert mapped.status_code == 200, mapped.text
    session = mapped.json()
    assert session["awaiting"] == "evidence"
    final = resume(client, session, {"action": "continue_incomplete", "reason": "Other fuels not yet supplied"})
    assert final.status_code == 200, final.text
    result = final.json()["result"]
    assert result["normalized_data"]["activity"]["electricity_kwh"] == 2000
    evidence = next(item for item in result["evidence"] if item["field"] == "electricity_kwh")
    assert evidence["original_value"] == "2"
    assert evidence["original_unit"] == "MWh"
    assert evidence["normalized_unit"] == "kWh"
    assert evidence["confirmed_by"] == "Phase 1 Reviewer"
    assert evidence["externally_verified"] is False


def test_evidence_replacement_revalidates_blocked_dataset(client):
    session = start(client, b"revenue\n-1")
    original_id = session["files"][0]["file_id"]
    fixed = resume(client, session, {"action": "upload", "reason": "Replace invalid source", "remove_file_ids": [original_id]},
                   [("files", ("corrected.csv", csv_bytes(annual_rows())))])
    assert fixed.status_code == 200, fixed.text
    final = fixed.json()
    assert final["result"]["agent_next_action"] == "PROCEED"
    assert len(final["files"]) == 1
    assert final["files"][0]["filename"] == "corrected.csv"
    assert all(item["source_file"] == "corrected.csv" for item in final["result"]["evidence"])


def test_capability_required_and_invalid_payload_does_not_resume(client):
    session = start(client, b"company_id,reporting_year,revenue\nTEST,2024,100", modules=["financial_analysis"])
    path = f"/api/intake/{session['intake_id']}"
    assert client.get(path + "/result").status_code == 404
    assert client.post(path + "/resume", data={"response": "{}"}).status_code == 404
    assert resume(client, session, {"action": "upload", "reason": "No files"}).status_code == 422
    assert resume(client, session, {"action": "continue_incomplete", "reason": " ", "normalized_data": {}}).status_code == 422
    assert resume(client, session, {"action": "cancel", "reason": "Stop review"}).json()["result"]["agent_next_action"] == "BLOCK"


def test_api_rejects_undeclared_quality_basis(client):
    response = client.post("/api/intake/start", data={"reviewer": "Reviewer", "evidence_quality": "DIRECT_MEASURED"},
                           files=[("files", ("test.csv", b"revenue\n10"))])
    assert response.status_code == 422


def test_routes_mounted_on_main_app():
    from backend.main import app
    paths = {route.path for route in app.routes}
    assert {"/api/intake/start", "/api/intake/{intake_id}/resume", "/api/intake/{intake_id}/result"} <= paths
