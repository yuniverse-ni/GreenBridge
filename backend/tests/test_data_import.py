"""Run with: python -m unittest discover -s backend/tests -v."""

from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from openpyxl import Workbook
from pydantic import ValidationError

from backend.data import DataImportError, ingest_files, ingest_uploads, parse_upload
from backend.data.models import ActivityData, FinancialData, SMEMetadata


def xlsx(rows, extra_sheet=None):
    workbook = Workbook()
    workbook.active.title = "Records"
    for row in rows:
        workbook.active.append(row)
    if extra_sheet:
        sheet = workbook.create_sheet("Financial")
        for row in extra_sheet:
            sheet.append(row)
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


class ImportTests(unittest.TestCase):
    def ingest(self, text):
        return ingest_uploads([("records.csv", text.encode("utf-8"))])

    def test_full_wide_dataset(self):
        headers = ["company_id", "company_name", "reporting_year", "employees", "floor_area_m2",
                   "revenue", "operating_expenses", "cash_balance", "annual_debt_service",
                   "capex_budget", "minimum_cash_reserve", "electricity_kwh", "diesel_litres",
                   "petrol_litres", "natural_gas_m3", "lpg_kg", "reporting_period", "confidence"]
        values = ["SME-TEST", "Test SME", "2024", "12", "800", "150000", "90000", "20000",
                  "10000", "30000", "5000", "1200", "50", "0", "20", "10", "2024", "0.98"]
        dataset = self.ingest(",".join(headers) + "\n" + ",".join(values))
        self.assertEqual(dataset.metadata.company_id, "SME-TEST")
        self.assertEqual(dataset.metadata.employees, 12)
        self.assertEqual(dataset.financial.revenue, 150000)
        self.assertEqual(dataset.activity.petrol_litres, 0)
        source = dataset.provenance["revenue"][0]
        self.assertEqual((source.source_file, source.source_type, source.reporting_period),
                         ("records.csv", "csv", "2024"))
        self.assertEqual(source.extraction_method, "deterministic_csv")
        self.assertEqual(source.confidence, 0.98)
        self.assertEqual(source.row, 2)
        self.assertIsInstance(dataset.model_dump(mode="json"), dict)

    def test_missing_is_not_zero(self):
        data = self.ingest("revenue,cash_balance,employees,electricity_kwh,diesel_litres\n0,,N/A,null,0")
        self.assertEqual(data.financial.revenue, 0)
        self.assertIsNone(data.financial.cash_balance)
        self.assertIsNone(data.metadata.employees)
        self.assertIsNone(data.activity.electricity_kwh)
        self.assertIsNone(data.activity.natural_gas_m3)
        self.assertNotIn("cash_balance", data.provenance)

    def test_frontend_profile_aliases_and_bom(self):
        data = self.ingest("\ufeffid,name,reportingYear,employeeCount,facilityFloorAreaSqM,annualRevenue,annualOperatingExpenses,cashBalance,existingAnnualDebtService,maxCapExBudget\nX,Example,2024,5,100,20000,10000,5000,1000,4000")
        self.assertEqual(data.metadata.company_name, "Example")
        self.assertEqual(data.financial.capex_budget, 4000)
        self.assertEqual(data.financial.annual_debt_service, 1000)

    def test_long_layout_and_thousands(self):
        data = self.ingest('field,value,reporting_period\ncompany_id,T,2024\nrevenue,"1,234.50",2024\ncash_balance,0,2024')
        self.assertEqual(data.financial.revenue, 1234.5)
        self.assertEqual(data.metadata.company_id, "T")

    def test_monthly_aggregation_and_per_source_provenance(self):
        data = ingest_uploads([
            ("jan.csv", b"electricity_kwh,reporting_period\n100,2024-01"),
            ("feb.csv", b"electricity_kwh,diesel_litres,reporting_period\n150,0,2024-02"),
        ])
        self.assertEqual(data.activity.electricity_kwh, 250)
        self.assertEqual(len(data.provenance["electricity_kwh"]), 2)
        self.assertEqual(data.provenance["electricity_kwh"][1].source_file, "feb.csv")

    def test_duplicate_and_ambiguous_energy_rejected(self):
        for periods in [("2024-01", "2024-01"), ("", ""), ("2024", "2024-01"), ("2024-13", "2024-14")]:
            with self.subTest(periods=periods), self.assertRaises(DataImportError):
                self.ingest(f"electricity_kwh,reporting_period\n1,{periods[0]}\n2,{periods[1]}")

    def test_conflicting_snapshots_and_companies_rejected(self):
        for field in ("company_id", "reporting_year", "revenue", "cash_balance"):
            with self.subTest(field=field), self.assertRaises(DataImportError):
                self.ingest(f"{field}\n2024\n2025")

    def test_matching_snapshots_not_summed(self):
        data = self.ingest("revenue\n100\n100")
        self.assertEqual(data.financial.revenue, 100)
        self.assertEqual(len(data.provenance["revenue"]), 2)

    def test_period_year_mismatch(self):
        for text in ("reporting_year,revenue,reporting_period\n2024,100,2025-01",
                     "electricity_kwh,reporting_period\n1,2024-01\n2,2025-01"):
            with self.assertRaises(DataImportError):
                self.ingest(text)

    def test_invalid_periods_and_valid_dates(self):
        for period in ("2024-13", "2024-02-30", "FY2024", "=1+2"):
            with self.subTest(period=period), self.assertRaises(DataImportError):
                self.ingest(f"revenue,reporting_period\n100,{period}")
        self.assertEqual(self.ingest("revenue,reporting_period\n100,2024-02-29").financial.revenue, 100)

    def test_zero_and_missing_xlsx_and_boolean_rejection(self):
        data = ingest_uploads([("records.xlsx", xlsx([["revenue", "cash_balance"], [0, None]]))])
        self.assertEqual(data.financial.revenue, 0)
        self.assertIsNone(data.financial.cash_balance)
        with self.assertRaises(DataImportError):
            ingest_uploads([("records.xlsx", xlsx([["employees"], [True]]))])

    def test_aggregation_overflow_rejected(self):
        with self.assertRaises(ValidationError):
            self.ingest("electricity_kwh,reporting_period\n1e308,2024-01\n1e308,2024-02")

    def test_negative_nonfinite_and_invalid_numbers(self):
        for field in (*FinancialData.model_fields, *ActivityData.model_fields, "employees", "floor_area_m2"):
            with self.subTest(field=field), self.assertRaises(DataImportError):
                self.ingest(f"{field}\n-1")
        for value in ("NaN", "Infinity", "-inf", "abc", "True", '"12,34"'):
            with self.subTest(value=value), self.assertRaises(DataImportError):
                self.ingest(f"revenue\n{value}")

    def test_integer_fields(self):
        for field, value in (("employees", "1.5"), ("reporting_year", "2024.5"),
                             ("reporting_year", "1800"), ("reporting_year", "10000")):
            with self.subTest(field=field, value=value), self.assertRaises(DataImportError):
                self.ingest(f"{field}\n{value}")

    def test_direct_model_validation(self):
        for model, values in ((FinancialData, {"revenue": True}), (ActivityData, {"lpg_kg": float("nan")}),
                              (SMEMetadata, {"employees": 1.5}), (FinancialData, {"unknown": 1})):
            with self.subTest(values=values), self.assertRaises(ValidationError):
                model(**values)

    def test_confidence_bounds(self):
        for confidence in ("-0.1", "1.1", "NaN", "true"):
            with self.subTest(confidence=confidence), self.assertRaises(DataImportError):
                self.ingest(f"revenue,confidence\n100,{confidence}")
        self.assertIsNone(self.ingest("revenue\n100").provenance["revenue"][0].confidence)

    def test_bad_headers_inputs_and_empty_documents(self):
        for text in ("", "revenue\n", "revenue\nN/A", "unknown\n1", "revenue,revenue\n1,2",
                     "revenue,annualRevenue\n1,2", "revenue\n1,2", "field,value\nunknown,10"):
            with self.subTest(text=text), self.assertRaises(DataImportError):
                self.ingest(text)
        for filename, content in (("data.xls", b""), ("data.pdf", b""), ("data.xlsx", b"bad"), ("data.csv", b"\xff")):
            with self.subTest(filename=filename), self.assertRaises(DataImportError):
                parse_upload(content, filename)

    def test_csv_and_xlsx_equivalent(self):
        rows = [["company_id", "reporting_year", "revenue", "electricity_kwh"], ["TEST", 2024, 1000, 0]]
        excel = ingest_uploads([("data.xlsx", xlsx(rows))])
        csv_data = self.ingest("company_id,reporting_year,revenue,electricity_kwh\nTEST,2024,1000,0")
        self.assertEqual(excel.model_dump(exclude={"provenance"}), csv_data.model_dump(exclude={"provenance"}))
        self.assertEqual(excel.provenance["revenue"][0].sheet, "Records")
        self.assertEqual(excel.provenance["revenue"][0].source_type, "xlsx")

    def test_multisheet_and_formula_rejection(self):
        data = ingest_uploads([("data.xlsx", xlsx([["employees"], [4]], [["revenue"], [100]]))])
        self.assertEqual(data.financial.revenue, 100)
        with self.assertRaisesRegex(DataImportError, "Formula"):
            ingest_uploads([("data.xlsx", xlsx([["revenue"], ["=1+2"]]))])

    def test_file_entrypoint(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "input.csv"
            path.write_text("revenue\n100", encoding="utf-8")
            self.assertEqual(ingest_files([path]).financial.revenue, 100)


if __name__ == "__main__":
    unittest.main()
