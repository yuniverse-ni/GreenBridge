"""Flexible ingestion contracts, including intentionally unresolved interpretations."""

import json
import unittest

from backend.data import DataImportError, ingest_uploads, parse_upload
from backend.data.mapping import FIELD_ALIASES, EXPECTED_UNITS, map_column
from test_data_import import xlsx


class FlexibleMappingTests(unittest.TestCase):
    def ingest(self, csv):
        return ingest_uploads([("SME records.csv", csv.encode("utf-8"))])

    def test_all_documented_aliases(self):
        for field, aliases in FIELD_ALIASES.items():
            for alias in aliases:
                with self.subTest(field=field, alias=alias):
                    unit = EXPECTED_UNITS.get(field) if field in {
                        "electricity_kwh", "diesel_litres", "petrol_litres", "natural_gas_m3", "lpg_kg"
                    } else None
                    mapping, warning = map_column(alias, unit)
                    self.assertEqual(mapping.mapped_field, field)
                    self.assertIsNone(warning)

    def test_case_and_punctuation(self):
        data = self.ingest("COMPANY NAME,Reporting-Year,HEAD_count,Annual.Revenue,Operating__Expenses,Available-Cash,CAPEX Budget\nExample,2024,8,10000,7000,2000,1000")
        self.assertEqual(data.metadata.company_name, "Example")
        self.assertEqual(data.metadata.employees, 8)
        self.assertEqual(data.financial.revenue, 10000)
        self.assertEqual(data.financial.operating_expenses, 7000)
        self.assertEqual(data.financial.cash_balance, 2000)
        self.assertEqual(data.financial.capex_budget, 1000)

    def test_financial_variants(self):
        data = self.ingest("turnover,opex,cash,debt repayment,capital expenditure\n10000,6000,2000,800,1000")
        self.assertEqual(data.financial.annual_debt_service, 800)
        self.assertEqual(data.financial.capex_budget, 1000)

    def test_currency_formatting_and_provenance(self):
        for value in ('"RM 1,234.50"', '"MYR1,234.50"', '"1,234.50 RM"', '"rm1,234.50"'):
            with self.subTest(value=value):
                data = self.ingest(f"Sales\n{value}")
                self.assertEqual(data.financial.revenue, 1234.5)
                source = data.provenance["revenue"][0]
                self.assertEqual(source.original_value, value.strip('"'))
                self.assertEqual(source.source_file, "SME records.csv")
                self.assertEqual(source.column, "Sales")
                self.assertEqual(source.mapping_method, "alias")
                self.assertEqual(source.mapping_confidence, 1)
                self.assertEqual(source.detected_unit, "RM")

    def test_currency_header(self):
        data = self.ingest('Sales (MYR),Cash [RM]\n"1,000",500')
        self.assertEqual(data.financial.revenue, 1000)
        self.assertEqual(data.financial.cash_balance, 500)

    def test_energy_unit_conversion_from_header(self):
        for header, value, expected in (("Electricity (MWh)", 2.5, 2500),
                                        ("Power Consumption [Wh]", 2500, 2.5),
                                        ("Electricity usage_kWh", 20, 20),
                                        ("Energy Consumed MWh", 1, 1000)):
            with self.subTest(header=header):
                data = self.ingest(f"{header}\n{value}")
                self.assertEqual(data.activity.electricity_kwh, expected)
                self.assertEqual(data.provenance["electricity_kwh"][0].normalized_unit, "kWh")

    def test_fuel_units(self):
        data = self.ingest("Fuel Diesel (L),Gasoline [liters],Gas consumption (m³),LPG kg\n10,20,30,40")
        self.assertEqual(data.activity.diesel_litres, 10)
        self.assertEqual(data.activity.petrol_litres, 20)
        self.assertEqual(data.activity.natural_gas_m3, 30)
        self.assertEqual(data.activity.lpg_kg, 40)

    def test_units_in_values(self):
        data = self.ingest("electricity,diesel,petrol,natural gas,LPG\n2 MWh,3 L,4 litres,5 m3,6 kg")
        self.assertEqual(data.activity.electricity_kwh, 2000)
        self.assertEqual(data.activity.diesel_litres, 3)
        self.assertEqual(data.activity.lpg_kg, 6)

    def test_key_value_format(self):
        data = self.ingest('metric,value,unit,period\nCompany,Example,,2024\nYear,2024,,2024\nSales,"RM 10,000",MYR,2024\nElectricity,2.5,MWh,2024-01\nDiesel consumption,20,L,2024-01')
        self.assertEqual(data.metadata.company_name, "Example")
        self.assertEqual(data.metadata.reporting_year, 2024)
        self.assertEqual(data.financial.revenue, 10000)
        self.assertEqual(data.activity.electricity_kwh, 2500)
        source = data.provenance["electricity_kwh"][0]
        self.assertEqual(source.original_value, "2.5")
        self.assertEqual(source.original_metric, "Electricity")
        self.assertEqual(source.column, "value")
        self.assertEqual(source.row, 5)
        self.assertEqual(source.reporting_period, "2024-01")
        mapping = next(m for m in data.mappings if m.mapped_field == "electricity_kwh")
        self.assertEqual(mapping.original_column, "Electricity")
        self.assertEqual(mapping.detected_unit, "MWh")
        self.assertEqual(mapping.normalized_unit, "kWh")

    def test_fuzzy_typo_and_conservative_rejections(self):
        data = self.ingest("Operating Expensess\n100")
        self.assertEqual(data.financial.operating_expenses, 100)
        self.assertEqual(data.mappings[0].mapping_method, "fuzzy")
        self.assertGreaterEqual(data.mappings[0].mapping_confidence, 0.94)
        for label in ("sails", "energy", "electricity cost", "revenue forecast", "gas"):
            with self.subTest(label=label):
                self.assertIsNone(map_column(label)[0].mapped_field)

    def test_unknown_only_is_structured_failure(self):
        with self.assertRaises(DataImportError) as error:
            self.ingest("Unusual Column\n42")
        report = error.exception.as_dict()
        self.assertEqual(report["unmapped_fields"], ["Unusual Column"])
        self.assertEqual(report["warnings"][0]["code"], "UNMAPPED_FIELD")
        json.dumps(report)

    def test_ambiguous_energy(self):
        data = self.ingest("Sales,Energy,Electricity\n1000,400,500")
        self.assertEqual(data.financial.revenue, 1000)
        self.assertIsNone(data.activity.electricity_kwh)
        self.assertEqual(data.unmapped_fields, ["Energy", "Electricity"])
        self.assertIn("kWh or cost", data.warnings[0].message)
        self.assertEqual(data.warnings[1].code, "AMBIGUOUS_MAPPING")

    def test_mixed_known_unknown_wide_and_long(self):
        for csv in ("Sales,Notes\n1000,keep for review",
                    "metric,value,unit,period\nSales,1000,,2024\nNotes,review,,2024"):
            with self.subTest(csv=csv):
                data = self.ingest(csv)
                self.assertEqual(data.financial.revenue, 1000)
                self.assertEqual(data.unmapped_fields, ["Notes"])
                self.assertTrue(data.warnings)

    def test_foreign_ambiguous_and_incompatible_units_flagged(self):
        for header, value in (("Electricity RM", "200"), ("Electricity kW", "20"),
                              ("Diesel gallons", "20"), ("LPG L", "2"),
                              ("Sales USD", "200"), ("Sales", "$200"),
                              ("Sales", "EUR 200"), ("Floor Area sqft", "100"),
                              ("Sales ($)", "200"), ("Revenue %", "25")):
            with self.subTest(header=header):
                data = self.ingest(f"employees,{header}\n2,{value}")
                self.assertEqual(data.metadata.employees, 2)
                self.assertIn(header, data.unmapped_fields)
                self.assertTrue(data.warnings)

    def test_conflicting_units_flagged(self):
        data = self.ingest("metric,value,unit\nSales,100,RM\nElectricity kWh,1,MWh")
        self.assertIsNone(data.activity.electricity_kwh)
        self.assertIn("Conflicting units", data.warnings[0].message)
        data = self.ingest("Sales,Electricity MWh\n100,1 kWh")
        self.assertIsNone(data.activity.electricity_kwh)
        self.assertIn("contradicts", data.warnings[0].message)

    def test_conversion_precedes_aggregation(self):
        data = self.ingest("metric,value,unit,period\nElectricity,1,MWh,2024-01\nElectricity,250,kWh,2024-02")
        self.assertEqual(data.activity.electricity_kwh, 1250)
        self.assertEqual([p.detected_unit for p in data.provenance["electricity_kwh"]], ["MWh", "kWh"])

    def test_malformed_csv(self):
        for text in ('Sales,Cash\n"100,200', "Sales\n100,200", "Sales,\n100,200"):
            with self.subTest(text=text), self.assertRaises(DataImportError) as error:
                self.ingest(text)
            self.assertIn("error", error.exception.as_dict())

    def test_duplicate_aliases_rejected(self):
        for csv in ("Sales,Turnover\n100,100", "OPEX,Operating Expenses\n100,100",
                    "Electricity MWh,Electricity kWh\n1,1000",
                    "Electricity,Power Consumption\n1 MWh,1000 kWh"):
            with self.subTest(csv=csv), self.assertRaises(DataImportError):
                self.ingest(csv)

    def test_semicolon_tab_and_bom(self):
        for text in ('\ufeffSales;Cash\n"RM 1,000";500', 'Sales\tCash\n1000\t500'):
            with self.subTest(text=text):
                self.assertEqual(self.ingest(text).financial.revenue, 1000)

    def test_scientific_notation_and_company_text_not_units(self):
        data = self.ingest("Company,Sales,Electricity kWh\nExample RM Limited,1e3,2e2")
        self.assertEqual(data.metadata.company_name, "Example RM Limited")
        self.assertEqual(data.financial.revenue, 1000)
        self.assertEqual(data.activity.electricity_kwh, 200)

    def test_negative_accounting_currency_rejected(self):
        with self.assertRaises(DataImportError):
            self.ingest('Sales\n"(RM 1,000)"')

    def test_xlsx_uses_same_flexible_mapping(self):
        data = ingest_uploads([("records.xlsx", xlsx([
            ["Sales (RM)", "Electricity (MWh)", "Energy", "period"],
            ["RM 1,000", 2.5, 100, "2024-01"],
        ]))])
        self.assertEqual(data.financial.revenue, 1000)
        self.assertEqual(data.activity.electricity_kwh, 2500)
        self.assertEqual(data.unmapped_fields, ["Energy"])
        source = data.provenance["electricity_kwh"][0]
        self.assertEqual(source.sheet, "Records")
        self.assertEqual(source.original_value, 2.5)


if __name__ == "__main__":
    unittest.main()
