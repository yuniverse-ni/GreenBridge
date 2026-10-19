# Structured record imports

This backend-only MVP does not add routes, persistence, OCR or frontend wiring.
Use `ingest_uploads([(filename, content_bytes), ...])` or `ingest_files(paths)`.
Both return `NormalizedDataset`; `model_dump(mode="json")` produces JSON.

An optional [AI Data Intake Agent](intake/README.md) now orchestrates these same
tools with LangGraph interrupts, human-confirmed mappings, evidence gaps and
readiness. The deterministic entry points below retain their existing behavior.

## Input

CSV uses UTF-8 (BOM allowed), comma/semicolon/tab delimiters and a header row. XLSX uses the
same headers on each nonempty worksheet. Formula cells in imported fields are
rejected; export calculated values first. Legacy XLS, PDF and images are not
supported by this module. Unrecognized columns are returned in `unmapped_fields`
with structured warnings. At least one supported, populated field must be present.
This is not a parser for arbitrary statements.

Wide format:

```csv
company_id,company_name,reporting_year,employees,revenue,electricity_kwh,reporting_period,confidence
SME-TEST,Example SME,2024,12,150000,1200,2024-01,0.98
```

Long format:

```csv
field,value,reporting_period
company_id,SME-TEST,2024
revenue,150000,2024
cash_balance,20000,2024
```

Headers and field names ignore case, spaces and punctuation. Frontend profile
aliases include `id`, `name`, `reportingYear`, `employeeCount`,
`facilityFloorAreaSqM`, `annualRevenue`, `annualOperatingExpenses`, `cashBalance`,
`existingAnnualDebtService` and `maxCapExBudget`. Arbitrary category/quantity rows
and multi-year statement columns must first be mapped to these supported fields.

Additional financial aliases: sales/turnover/annual revenue; opex/expenses;
cash/available cash; debt repayment; capex/capital expenditure. Metadata aliases:
company, year/FY, headcount/staff count, floor area/facility area. Activity aliases:
electricity usage/power consumption/energy consumed; diesel consumption/fuel
diesel; petrol/gasoline; natural gas/gas consumption; LPG.

Flexible wide example:

```csv
Company,Year,Sales (RM),Power Consumption (MWh),Fuel Diesel (L)
Example SME,2024,"RM 150,000",2.5,20
```

Key/value example (`field` remains supported as an alias for `metric`):

```csv
metric,value,unit,period
Sales,"RM 150,000",MYR,2024
Electricity usage,2.5,MWh,2024-01
Gasoline,20,L,2024-01
```

Matching uses canonical names and curated aliases first, recognizing explicit
unit suffixes before fuzzy matches. Fuzzy matching uses deterministic
`SequenceMatcher`, minimum similarity 0.94, a 0.08 lead over the next different
field, minimum seven-character labels and at most two characters of length
difference. It is intended for small spelling variations, not semantic guesses.
`Operating Expensess` is accepted; `Energy`, `gas`, `electricity cost` and
`revenue forecast` are not guessed. Bare activity aliases need explicit units
in the header, unit column (key/value layout), or value (e.g. `2 MWh`). Canonical
names such as `electricity_kwh` already encode their unit.

## Output contract

- `metadata`: company_id, company_name, reporting_year, employees, floor_area_m2.
- `financial`: revenue, operating_expenses, cash_balance, annual_debt_service,
  capex_budget, minimum_cash_reserve, cogs, operating_cash_flow, total_debt,
  current_liabilities. The last four are optional for basic financial readiness;
  operating_cash_flow supports signed values. Missing amounts remain null.
- `activity`: electricity_kwh, diesel_litres, petrol_litres, natural_gas_m3, lpg_kg.
- `provenance`: normalized field name → list of source_file, source_type
  (`csv`/`xlsx`), reporting_period, extraction_method, confidence, sheet, row, column.

Each provenance entry also retains original_value, original_metric (key/value),
detected_unit, normalized_unit, mapping_method and mapping_confidence.
Supplemental financial values use the same mapping, units and provenance contract.

Additional report fields:

- `mappings`: original_column, mapped_field, detected_unit, normalized_unit,
  mapping_confidence, mapping_method and row. Key/value labels appear as
  original_column, with the actual `value` column preserved in provenance.
- `unmapped_fields`: distinct unresolved labels.
- `warnings`: code, message, source_file, original_column, row and sheet.

Partially recognized files return valid values plus diagnostics. Wh is multiplied
by 0.001 and MWh by 1000 to obtain kWh. L/litre/liter variants normalize to litres.
Explicit m2/m3/kg variants retain their units. RM/MYR currency prefixes/suffixes
and valid thousands separators are stripped before validation. Unit hints in
headers, row units and values must agree. `Sales ($)`, USD, gallons, kW, LPG in
litres, or conflicting unit hints are flagged rather than converted. RM/MYR and
bare financial fields use the existing RM contract; floor area without a unit
uses the existing m2 contract. No exchange rates or fuel-density conversions.

Entirely unknown/ambiguous files, malformed CSV, duplicate header aliases and
invalid numeric values raise `DataImportError`. Use `exc.as_dict()` to obtain
JSON-ready errors, unmapped fields, warnings and mappings. For example `Energy`
returns: `Could not determine whether 'Energy' represents kWh or cost.` No partial
dataset is returned on a validation/structure failure.

All dataset values default to `None`. Blank, `N/A`, `null`, `none` and `NA` cells
are missing. Explicit zero is preserved. All numeric values must be finite and
nonnegative, including cash balance (overdrafts require a future separate field).
Employees and reporting year must be integers; year is restricted to 1900–9999.
Numbers use a decimal point; properly quoted thousands separators are accepted.
Amounts use RM/MYR; only the explicit unit conversions above are performed.

Metadata and financial values are snapshots: matching repeats retain every source
but are not summed; conflicting repeats fail. Activity records are additive only
when every repeated field has a distinct `YYYY-MM` reporting period. Repeated daily,
annual, overlapping or unspecified periods fail rather than risk double-counting.
A single activity value may represent any supported period or an unspecified one.
Periods accept valid `YYYY`, `YYYY-MM`, `YYYY-MM-DD`; all dated records must belong
to one calendar year and match the explicit reporting year when supplied. Year is
not inferred when missing. Only present records are totaled; completeness is not
asserted. Call separately for different companies or reporting years.

Confidence is optional, 0–1, supplied by the input. It describes extraction
confidence only and does not establish evidence verification. No confidence score
is invented. Mapping confidence is a separate deterministic similarity score,
not evidence confidence. No LLM is used. Source filenames are labels and are
never used to write uploaded files.

Run tests after installing root requirements:

```console
python -m unittest discover -s backend/tests -v
```
