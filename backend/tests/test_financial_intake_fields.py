"""Optional financial statement fields reuse the existing parser/intake pipeline."""
import csv
import io
from unittest.mock import Mock
from uuid import uuid4

import pytest
from langgraph.types import Command
from openpyxl import Workbook
from pydantic import ValidationError

from backend.data.intake import DataIntakeAgent
from backend.data.intake.models import DataIntakeResult
from backend.data.mapping import FIELD_ALIASES, map_column
from backend.data.models import BASIC_FINANCIAL_FIELDS, FIELD_GROUPS, FinancialData
from backend.data.parser import DataImportError, parse_upload
from backend.data.service import ingest_uploads
from backend.data.intake.tools import classify_document, inspect_file
from backend.data.intake.models import Upload

FIELDS = ("cogs", "operating_cash_flow", "total_debt", "current_liabilities")
BASIC_HEADER = "company_id,reporting_year,revenue,operating_expenses,cash_balance,annual_debt_service,capex_budget,minimum_cash_reserve"
BASIC_ROW = "SCHEMA,2024,10000,7000,2000,500,1000,500"


def xlsx(headers, values):
    workbook = Workbook()
    workbook.active.title = "Financial"
    workbook.active.append(headers)
    workbook.active.append(values)
    stream = io.BytesIO()
    workbook.save(stream)
    workbook.close()
    return stream.getvalue()


@pytest.mark.parametrize("field,header", [(field, header) for field in FIELDS
    for header in [field, *FIELD_ALIASES[field]]])
def test_deterministic_common_headers_and_labels(field, header):
    mapping, warning = map_column(header)
    assert warning is None
    assert mapping.mapped_field == field
    assert mapping.mapping_method in ("exact", "alias")
    assert mapping.normalized_unit == "RM"
    wide = ingest_uploads([("wide.csv", f"{header}\n125".encode())])
    long = ingest_uploads([("long.csv", f"metric,value,unit,period\n{header},125,MYR,2024".encode())])
    assert getattr(wide.financial, field) == getattr(long.financial, field) == 125
    assert long.provenance[field][0].original_metric == header
    assert long.provenance[field][0].detected_unit == "RM"


@pytest.mark.parametrize("kind", ["csv", "xlsx"])
def test_missing_values_and_explicit_zero_preserved(kind):
    headers = ["revenue", *FIELDS]
    for values, expected in [([1, "", "N/A", "null", ""], None), ([1, 0, 0, 0, 0], 0)]:
        content = ((",".join(headers) + "\n" + ",".join(str(value) for value in values)).encode()
                   if kind == "csv" else xlsx(headers, values))
        dataset = ingest_uploads([(f"financial.{kind}", content)])
        for field in FIELDS:
            assert getattr(dataset.financial, field) == expected
            assert (field in dataset.provenance) == (expected == 0)
            if expected == 0:
                source = dataset.provenance[field][0]
                assert source.row == 2
                assert source.column == field
                assert source.normalized_unit == "RM"
                assert source.extraction_method == f"deterministic_{kind}"
                assert source.sheet == ("Financial" if kind == "xlsx" else None)
    absent = ingest_uploads([("minimal.csv", b"revenue\n1")])
    assert all(getattr(absent.financial, field) is None for field in FIELDS)
    assert all(FinancialData().model_dump()[field] is None for field in FIELDS)


@pytest.mark.parametrize("kind", ["csv", "xlsx"])
def test_operating_cash_outflow_is_signed(kind):
    content = b"Operating Cash Flow (MYR)\n-123.45" if kind == "csv" else xlsx(["OCF"], [-123.45])
    dataset = ingest_uploads([(f"outflow.{kind}", content)])
    assert dataset.financial.operating_cash_flow == -123.45
    assert dataset.provenance["operating_cash_flow"][0].original_value in ("-123.45", -123.45)


@pytest.mark.parametrize("field", FIELDS)
def test_numbers_remain_finite_and_non_boolean(field):
    for value in [True, float("inf"), float("nan")]:
        with pytest.raises(ValidationError):
            FinancialData(**{field: value})
    if field != "operating_cash_flow":
        with pytest.raises(DataImportError):
            ingest_uploads([("invalid.csv", f"{field}\n-1".encode())])


@pytest.mark.parametrize("extras", [None, (0, -250, 1200, 800)])
def test_intake_serialization_and_optional_readiness(extras):
    agent = DataIntakeAgent(assistant=Mock(suggest=Mock(return_value=[])))
    config = {"configurable": {"thread_id": uuid4().hex}}
    text = BASIC_HEADER + ("," + ",".join(FIELDS) if extras is not None else "")
    text += "\n" + BASIC_ROW + ("," + ",".join(str(value) for value in extras) if extras is not None else "")
    result = agent.invoke({"uploads": [{"file_id": "source", "filename": "financial.csv", "content": text.encode(),
        "evidence_quality": "INVOICE_DERIVED", "quality_basis": "Supplied financial statement"}],
        "requested_modules": ["financial_analysis"]}, config)
    assert result.agent_next_action == "PROCEED"
    assert result.readiness["financial_analysis"].status == "READY"
    assert result.readiness["financial_analysis"].may_proceed
    assert not any(gap.affected_field in FIELDS for gap in result.data_gaps)
    exported = result.model_dump(mode="json")
    assert DataIntakeResult.model_validate_json(result.model_dump_json()) == result
    for index, field in enumerate(FIELDS):
        assert exported["normalized_data"]["financial"][field] == (extras[index] if extras is not None else None)
        evidence = [item for item in result.evidence if item.field == field]
        assert len(evidence) == (1 if extras is not None else 0)
        if evidence:
            item = evidence[0]
            assert item.source_document_id == "source"
            assert item.source_file == "financial.csv"
            assert item.normalized_unit == "RM"
            assert item.evidence_quality == "INVOICE_DERIVED"
            assert item.evidence_quality_basis == "Supplied financial statement"
            assert item.confirmation_status == "ACCEPTED"
            assert item.externally_verified is False
    assert set(FinancialData.model_fields) == set(BASIC_FINANCIAL_FIELDS) | set(FIELDS)


def test_optional_data_does_not_hide_missing_basic_fields():
    agent = DataIntakeAgent(assistant=Mock(suggest=Mock(return_value=[])))
    config = {"configurable": {"thread_id": uuid4().hex}}
    result = agent.invoke({"uploads": [{"file_id": "source", "filename": "optional.csv",
        "content": b"company_id,reporting_year,cogs\nSCHEMA,2024,0",
        "evidence_quality": "INVOICE_DERIVED", "quality_basis": "Supplied accounting export"}],
        "requested_modules": ["financial_analysis"]}, config)
    assert result.readiness["financial_analysis"].status == "PARTIAL"
    assert not result.readiness["financial_analysis"].may_proceed
    assert {gap.affected_field for gap in result.data_gaps if gap.gap_type == "MISSING_FINANCIAL"} == set(BASIC_FINANCIAL_FIELDS)
    final = agent.invoke(Command(resume={"actor": "Reviewer", "action": "continue_incomplete", "reason": "Review basic figures later"}), config)
    assert final.normalized_data.financial.cogs == 0
    assert final.normalized_data.financial.operating_cash_flow is None
    assert final.readiness["financial_analysis"].status == "PARTIAL"


def test_optional_fields_keep_snapshot_conflict_rules():
    for field in FIELDS:
        with pytest.raises(DataImportError):
            ingest_uploads([("conflict.csv", f"{field}\n100\n200".encode())])


@pytest.mark.parametrize("missing", [None, *FIELDS])
def test_all_canonical_csv_headers_need_no_ai_or_human_mapping(missing):
    """Full pipeline regression: registry -> exact mapping -> graph -> public JSON.

    Every case contains all 20 canonical headers. Blank optional values must not
    turn an exact header into a mapping question or cause a defaulted amount.
    """
    values = {
        "company_id": "EXACT", "company_name": None, "reporting_year": 2024,
        "employees": 0, "floor_area_m2": 100,
        "revenue": 10000, "operating_expenses": 7000, "cash_balance": 2000,
        "annual_debt_service": 100, "capex_budget": 1000, "minimum_cash_reserve": 500,
        "cogs": 2300, "operating_cash_flow": -125, "total_debt": 0, "current_liabilities": 800,
        "electricity_kwh": 100, "diesel_litres": 0, "petrol_litres": 0,
        "natural_gas_m3": 0, "lpg_kg": 0,
    }
    assert set(values) == set(FIELD_GROUPS)
    if missing:
        values[missing] = None
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([*values, "reporting_period"])
    writer.writerow([*values.values(), "2024"])
    content = buffer.getvalue().encode()

    for field in FIELD_GROUPS:
        mapping, warning = map_column(field)
        assert warning is None
        assert mapping.mapped_field == field
        assert mapping.mapping_method == "exact"
        assert mapping.mapping_confidence == 1
    assert all(FIELD_GROUPS[field] == "financial" for field in FIELDS)
    for field in FIELDS:
        inspection = inspect_file(Upload(file_id=field, filename=f"{field}.csv", content=f"{field}\n0".encode()))
        assert inspection.supported_fields == [field]
        assert classify_document(inspection).document_type == "financial_records"

    document = parse_upload(content, "all_canonical.csv")
    assert document.unmapped_fields == []
    assert all(mapping.mapping_method == "exact" for mapping in document.mappings)
    helper = Mock(suggest=Mock(side_effect=AssertionError("Canonical headers must never need AI")))
    agent = DataIntakeAgent(assistant=helper)
    config = {"configurable": {"thread_id": uuid4().hex}}
    result = agent.invoke({"uploads": [{"file_id": "canonical-source", "filename": "all_canonical.csv",
        "content": content, "evidence_quality": "INVOICE_DERIVED", "quality_basis": "Regression export"}]}, config)
    assert result.mapping_requests == []
    assert result.suggestions == []
    helper.suggest.assert_not_called()
    assert result.agent_next_action == "PROCEED"
    assert all(ready.status == "READY" and ready.may_proceed for ready in result.readiness.values())
    assert result.normalized_data.metadata.company_name is None
    assert result.normalized_data.metadata.employees == 0
    exported = result.model_dump(mode="json")
    assert DataIntakeResult.model_validate_json(result.model_dump_json()) == result
    for field, expected in values.items():
        assert exported["normalized_data"][FIELD_GROUPS[field]][field] == expected
        evidence = [item for item in result.evidence if item.field == field]
        if expected is None:
            assert evidence == []
            assert field not in result.normalized_data.provenance
            continue
        assert len(evidence) == 1
        source = result.normalized_data.provenance[field][0]
        assert source.source_document_id == "canonical-source"
        assert source.source_file == "all_canonical.csv"
        assert source.column == field and source.row == 2
        assert source.reporting_period == "2024"
        assert source.original_value == str(expected)
        assert source.mapping_method == "exact"
        assert evidence[0].confirmation_status == "ACCEPTED"
        assert evidence[0].normalized_value == expected
        if field in FIELDS:
            assert evidence[0].normalized_unit == "RM"
    # The API uses this same registry for frontend supported-field options.
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from backend.data.intake.router import create_intake_router
    app = FastAPI()
    app.include_router(create_intake_router())
    with TestClient(app) as client:
        response = client.post("/api/intake/start", data={"reviewer": "Regression reviewer",
            "evidence_quality": "INVOICE_DERIVED", "quality_basis": "Regression export"},
            files=[("files", ("all_canonical.csv", content, "text/csv"))])
    assert response.status_code == 200, response.text
    public = response.json()
    assert set(public["schema_fields"]) == set(FIELD_GROUPS)
    assert public["result"]["mapping_requests"] == []
    # Source IDs differ between independent graph runs; normalized values do not.
    for group in ("metadata", "financial", "activity"):
        assert public["result"]["normalized_data"][group] == exported["normalized_data"][group]
