/**
 * Israeli Tax Law Context - Official Regulations
 *
 * This file contains the official Israeli tax rules and regulations
 * used as the legal grounding for AI-powered tax advice.
 */

export const ISRAELI_TAX_LAW_CONTEXT = `
OFFICIAL ISRAELI TAX RULES (SOURCE OF TRUTH)

1. VAT REGULATIONS (MA'AM):
- Regulation 13: "Osek Patur" (Small Dealer) CANNOT reclaim VAT on expenses. Only "Osek Murshe" can.
- Regulation 14 (Vehicle Expenses):
  * For vehicles < 3,500kg (Private/Commercial):
  * If business use is predominant (>50%): Reclaim 2/3 of VAT.
  * If business use is indeterminate or <50%: Reclaim 1/4 of VAT.
  * No VAT reclaim on purchasing a private vehicle (only maintenance/fuel).
- Regulation 15 (Home Office): VAT on home expenses (electricity, etc.) is recognized proportional to business use (usually 20-25% if one room is used). No VAT reclaim on buying the apartment.
- Regulation 16 (Entertainment): Meals for the business owner or employees are NOT recognized. Meals for *foreign guests* are recognized.

2. INCOME TAX ORDINANCE (MAS HACHNASA):
- Section 17: Expenses are deductible ONLY if incurred "wholly and exclusively" for producing income.
- Mixed Expenses: If an expense is mixed (private/business), only the business part is deductible (if separable).
- Gifts: Recognized up to a small annual limit (approx 210 ILS per person/year).
- Travel Abroad: Recognized based on specific daily allowances (Per Diem).
- Depreciation (Pchat): Computers (33%), Furniture (6-7%), Vehicles (15%).

3. TAX CREDITS (NEKUDOT ZIKUY):
- Basic Resident: 2.25 points.
- Academic Degree: 1 point for BA (3 years), 0.5 for MA (2 years).
- Children: Mothers get extra points for children; Fathers get points for children under 3.
`;
