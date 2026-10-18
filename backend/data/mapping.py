"""Conservative, deterministic field/unit recognition; no AI or business math."""

from difflib import SequenceMatcher
import re
from typing import Any

from .models import FIELD_GROUPS, FieldMapping


def header_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower().replace("²", "2").replace("³", "3"))


FIELD_ALIASES = {
    "company_id": ["id", "company id", "business id"],
    "company_name": ["name", "company", "business name"],
    "reporting_year": ["year", "financial year", "fiscal year", "FY"],
    "employees": ["employee count", "headcount", "staff count", "number of employees"],
    "floor_area_m2": ["floor area", "facility area", "facility floor area sqm", "floor space"],
    "revenue": ["sales", "annual revenue", "annual sales", "turnover", "gross revenue"],
    "operating_expenses": ["opex", "expenses", "operating expenses", "annual operating expenses"],
    "cash_balance": ["cash", "available cash", "cash and bank"],
    "annual_debt_service": ["debt repayment", "annual debt repayment", "existing annual debt service"],
    "capex_budget": ["capex", "capital expenditure", "max capex budget"],
    "minimum_cash_reserve": ["min cash reserve", "minimum reserve"],
    "electricity_kwh": ["electricity", "electricity usage", "power consumption", "energy consumed", "meter reading"],
    "diesel_litres": ["diesel", "diesel consumption", "fuel diesel"],
    "petrol_litres": ["petrol", "gasoline", "petrol consumption", "gasoline consumption"],
    "natural_gas_m3": ["natural gas", "gas consumption", "natural gas consumption"],
    "lpg_kg": ["LPG", "LPG consumption", "liquefied petroleum gas"],
}
ALIASES = {header_key(field): field for field in FIELD_GROUPS}
ALIASES.update({header_key(alias): field for field, aliases in FIELD_ALIASES.items() for alias in aliases})
CANONICAL_KEYS = {header_key(field) for field in FIELD_GROUPS}
EXPECTED_UNITS = {
    **dict.fromkeys(("revenue", "operating_expenses", "cash_balance", "annual_debt_service",
                     "capex_budget", "minimum_cash_reserve"), "RM"),
    "floor_area_m2": "m2", "electricity_kwh": "kWh", "diesel_litres": "litres",
    "petrol_litres": "litres", "natural_gas_m3": "m3", "lpg_kg": "kg",
}
UNIT_ALIASES = {
    "wh": "Wh", "kwh": "kWh", "mwh": "MWh", "l": "litres", "litre": "litres",
    "litres": "litres", "liter": "litres", "liters": "litres", "litersvolume": "litres",
    "rm": "RM", "myr": "RM", "kg": "kg", "kgs": "kg", "kilograms": "kg",
    "m3": "m3", "cubicmetres": "m3", "cubicmeters": "m3", "m2": "m2",
    "sqm": "m2", "sqmetres": "m2", "squaremetres": "m2", "squaremeters": "m2",
    "usd": "USD", "sgd": "SGD", "eur": "EUR", "gallons": "gallons", "gal": "gallons",
    "sqft": "sqft", "kw": "kW", "tonnes": "tonnes", "t": "tonnes",
}
FUZZY_THRESHOLD = 0.94
FUZZY_MARGIN = 0.08
MEASUREMENT_PATTERN = r"([+-]?(?:\d[\d,]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*((?![eE][+-]?\d)[A-Za-z²³][A-Za-z0-9²³ ]*)"


def canonical_unit(value: Any) -> str | None:
    if value is None or not str(value).strip():
        return None
    return UNIT_ALIASES.get(header_key(value), str(value).strip())


def match_field(key: str) -> tuple[str | None, str, float]:
    if key in ALIASES:
        return ALIASES[key], "exact" if key in CANONICAL_KEYS else "alias", 1.0
    # Tiny names and semantic additions (e.g. "electricity cost") are never fuzzy-mapped.
    scores = {}
    for alias, field in ALIASES.items():
        if min(len(key), len(alias)) < 7 or abs(len(key) - len(alias)) > 2:
            continue
        score = SequenceMatcher(None, key, alias).ratio()
        scores[field] = max(scores.get(field, 0), score)
    ordered = sorted(scores.items(), key=lambda pair: (-pair[1], pair[0]))
    if ordered and ordered[0][1] >= FUZZY_THRESHOLD:
        if len(ordered) == 1 or ordered[0][1] - ordered[1][1] >= FUZZY_MARGIN:
            return ordered[0][0], "fuzzy", round(ordered[0][1], 4)
        return None, "ambiguous", round(ordered[0][1], 4)
    return None, "unmapped", 0


def map_column(label: str, unit: Any = None) -> tuple[FieldMapping, str | None]:
    """Map a label and optional explicit row unit; return mapping and warning text."""
    key = header_key(label)
    field, method, confidence = match_field(key)
    header_unit = None
    # Canonical quantity names carry their unit. Other labels may have a suffix.
    if key in CANONICAL_KEYS and field in EXPECTED_UNITS:
        header_unit = EXPECTED_UNITS[field] if FIELD_GROUPS[field] == "activity" or field == "floor_area_m2" else None
    if field is None or method == "fuzzy":
        for suffix in sorted(UNIT_ALIASES, key=len, reverse=True):
            if key.endswith(suffix):
                candidate, candidate_method, candidate_confidence = match_field(key[:-len(suffix)])
                if candidate:
                    field, method, confidence = candidate, candidate_method, candidate_confidence
                    header_unit = UNIT_ALIASES[suffix]
                    break
    explicit_unit = canonical_unit(unit)
    symbol_units = set(re.findall(r"[$€£%]", label))
    if symbol_units:
        header_unit = next(iter(symbol_units)) if len(symbol_units) == 1 else "multiple currency/percentage symbols"
    detected = explicit_unit or header_unit
    expected = EXPECTED_UNITS.get(field)
    warning = None
    if header_unit and explicit_unit and header_unit != explicit_unit:
        warning = f"Conflicting units for '{label}': header says {header_unit}, row says {explicit_unit}."
    elif field is None:
        if key == "energy":
            warning = f"Could not determine whether '{label}' represents kWh or cost."
        else:
            warning = f"Could not confidently map '{label}' to a GreenBridge field."
    elif FIELD_GROUPS[field] == "activity" and detected is None:
        warning = f"Could not determine the unit for '{label}'; supply an explicit unit (expected {expected})."
    elif detected and detected != expected and not (expected == "kWh" and detected in {"Wh", "MWh"}):
        warning = f"Unit '{detected}' for '{label}' cannot safely be converted to {expected or 'a unitless value'}."
    if warning:
        return FieldMapping(original_column=label, detected_unit=detected, normalized_unit=expected,
                            mapping_confidence=confidence, mapping_method="ambiguous" if field or method == "ambiguous" or key == "energy" else "unmapped"), warning
    return FieldMapping(original_column=label, mapped_field=field, detected_unit=detected,
                        normalized_unit=expected, mapping_confidence=confidence, mapping_method=method), None


def numeric_value(raw: Any, mapping: FieldMapping) -> tuple[Any, str | None]:
    """Normalize formatting and explicit units, rejecting incompatible currency/units."""
    value = raw
    cell_unit = None
    if isinstance(value, str):
        value = value.strip()
        if value.startswith("="):
            raise ValueError("Formula cells are unsupported; export values first")
        negative = value.startswith("(") and value.endswith(")")
        if negative:
            value = value[1:-1].strip()
        currency = re.match(r"^(RM|MYR|USD|SGD|EUR|[$€£])\s*", value, re.IGNORECASE)
        if currency:
            cell_unit = canonical_unit(currency.group(1))
            value = value[currency.end():].strip()
        suffix = re.fullmatch(MEASUREMENT_PATTERN, value)
        if suffix:
            suffix_unit = canonical_unit(suffix.group(2))
            if cell_unit and suffix_unit != cell_unit:
                raise ValueError("Conflicting currency/units within value")
            cell_unit = suffix_unit
            value = suffix.group(1)
        if negative:
            value = "-" + value
        if "," in value:
            if not re.fullmatch(r"[+-]?\d{1,3}(,\d{3})+(\.\d+)?", value):
                raise ValueError("Invalid thousands grouping")
            value = value.replace(",", "")
    detected = cell_unit or mapping.detected_unit
    if cell_unit and mapping.detected_unit and cell_unit != mapping.detected_unit:
        raise UnitInterpretationError(f"Value unit '{cell_unit}' contradicts column unit '{mapping.detected_unit}'.")
    expected = mapping.normalized_unit
    if detected and detected != expected and not (expected == "kWh" and detected in {"Wh", "MWh"}):
        raise UnitInterpretationError(f"Unit '{detected}' cannot safely be converted to {expected or 'a unitless value'}.")
    if expected == "kWh" and detected in {"Wh", "MWh"}:
        if isinstance(value, bool):
            raise ValueError("Boolean values are not valid numbers")
        value = float(value) * (0.001 if detected == "Wh" else 1000)
    return value, detected


class UnitInterpretationError(ValueError):
    """A valid-looking measurement lacks a safe unit interpretation."""
