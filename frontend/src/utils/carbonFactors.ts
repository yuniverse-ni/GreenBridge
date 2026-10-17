// Documented Emission Factors Repository
// Sources: UK Government GHG Conversion Factors (DEFRA 2024), International Energy Agency (IEA 2023/2024),
// Suruhanjaya Tenaga (Energy Commission Malaysia Grid Emission Factors 2023), US EPA eGRID 2024.

import { ActivityCategory, EmissionScope, EmissionFactorReference } from '../types/transition';

export const DOCUMENTED_EMISSION_FACTORS: EmissionFactorReference[] = [
  // SCOPE 2: Purchased Electricity
  {
    category: 'electricity',
    name: 'Purchased Grid Electricity (Peninsular Malaysia)',
    scope: 'Scope 2',
    unit: 'kWh',
    factorKgCO2e: 0.584, // kgCO2e per kWh (Suruhanjaya Tenaga / Energy Commission Malaysia 2023)
    source: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    region: 'Peninsular Malaysia',
    effectiveYear: 2023,
    notes: 'Standard operating margin combined margin factor for Peninsular grid generation mix.'
  },
  {
    category: 'electricity',
    name: 'Purchased Grid Electricity (Sabah / Sarawak)',
    scope: 'Scope 2',
    unit: 'kWh',
    factorKgCO2e: 0.428,
    source: 'Suruhanjaya Tenaga 2023',
    region: 'Sabah / Sarawak',
    effectiveYear: 2023,
    notes: 'Reflects higher hydro share in Sarawak renewable grid mix.'
  },
  {
    category: 'electricity',
    name: 'Purchased Grid Electricity (UK Average)',
    scope: 'Scope 2',
    unit: 'kWh',
    factorKgCO2e: 0.20705, // DEFRA 2024 kgCO2e per kWh
    source: 'UK DEFRA 2024 Conversion Factors',
    region: 'United Kingdom',
    effectiveYear: 2024,
    notes: 'UK national electricity transmission and distribution average.'
  },
  {
    category: 'electricity',
    name: 'Purchased Grid Electricity (US National Average)',
    scope: 'Scope 2',
    unit: 'kWh',
    factorKgCO2e: 0.386, // EPA eGRID 2024 kgCO2e/kWh
    source: 'US EPA eGRID 2024',
    region: 'United States',
    effectiveYear: 2024,
    notes: 'US national generation resource mix.'
  },
  {
    category: 'electricity',
    name: 'Purchased Grid Electricity (EU Average)',
    scope: 'Scope 2',
    unit: 'kWh',
    factorKgCO2e: 0.245,
    source: 'European Environment Agency (EEA) 2024',
    region: 'European Union',
    effectiveYear: 2024,
    notes: 'EU-27 power sector emission intensity average.'
  },

  // SCOPE 1: Direct Fuel Combustion
  {
    category: 'fuel_diesel',
    name: 'Diesel / Gas Oil (Commercial Fleet & Generators)',
    scope: 'Scope 1',
    unit: 'L',
    factorKgCO2e: 2.6865, // DEFRA 2024 100% mineral diesel / average biofuel blend
    source: 'UK DEFRA / IPCC 2024 Fuel Conversion Factors',
    region: 'Global / Standard',
    effectiveYear: 2024,
    notes: 'Includes CO2, CH4, and N2O direct combustion emissions from standard road/generator diesel.'
  },
  {
    category: 'fuel_petrol',
    name: 'Motor Gasoline / Petrol (Passenger & Light Vans)',
    scope: 'Scope 1',
    unit: 'L',
    factorKgCO2e: 2.3144, // DEFRA 2024
    source: 'UK DEFRA / IPCC 2024',
    region: 'Global / Standard',
    effectiveYear: 2024,
    notes: 'Combustion emissions per liter of forecourt petrol.'
  },
  {
    category: 'fuel_gas',
    name: 'Natural Gas (Pipeline Gas for Industrial Boilers / Heating)',
    scope: 'Scope 1',
    unit: 'm3',
    factorKgCO2e: 2.0226, // DEFRA 2024 natural gas per cubic meter
    source: 'DEFRA / Gas Malaysia Industrial Tariff 2024',
    region: 'Global / Standard',
    effectiveYear: 2024,
    notes: 'Gross calorific value basis (approx 0.185 kgCO2e per kWh thermal equivalent).'
  },
  {
    category: 'fuel_lpg',
    name: 'Liquefied Petroleum Gas (LPG Cylinders & Tanks)',
    scope: 'Scope 1',
    unit: 'kg',
    factorKgCO2e: 2.939, // DEFRA 2024 LPG per kg
    source: 'DEFRA 2024 Fuel Table',
    region: 'Global / Standard',
    effectiveYear: 2024,
    notes: 'Direct stationary combustion factor for propane/butane mix.'
  },
  {
    category: 'water',
    name: 'Supply Water Treatment & Distribution',
    scope: 'Scope 1', // Typically Scope 3, tracked for utility completeness
    unit: 'm3',
    factorKgCO2e: 0.149,
    source: 'DEFRA 2024 Water Supply',
    region: 'Global / Standard',
    effectiveYear: 2024,
    notes: 'Pumping and municipal treatment emissions.'
  },
  {
    category: 'refrigerant',
    name: 'R-410A Air Conditioning Refrigerant Top-up (GWP)',
    scope: 'Scope 1',
    unit: 'kg',
    factorKgCO2e: 2088.0, // IPCC AR4 / DEFRA 2024
    source: 'IPCC 4th Assessment Report (AR4) GWP-100',
    region: 'Global',
    effectiveYear: 2024,
    notes: 'Fugitive emissions from HVAC maintenance and chilling systems.'
  }
];

export function getEmissionFactorForActivity(category: ActivityCategory, region: string = 'Peninsular Malaysia'): EmissionFactorReference {
  const match = DOCUMENTED_EMISSION_FACTORS.find(
    (f) => f.category === category && (f.region === region || f.region.toLowerCase().includes(region.toLowerCase()))
  );
  if (match) return match;

  // Fallback to first factor of category
  const defaultFactor = DOCUMENTED_EMISSION_FACTORS.find((f) => f.category === category);
  if (defaultFactor) return defaultFactor;

  // Generic fallback
  return {
    category,
    name: `Custom Activity (${category})`,
    scope: category === 'electricity' ? 'Scope 2' : 'Scope 1',
    unit: 'units',
    factorKgCO2e: 1.0,
    source: 'Default User Factor',
    region: 'Generic',
    effectiveYear: 2024,
    notes: 'Unverified default factor'
  };
}
