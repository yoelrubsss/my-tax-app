# Israeli VAT Management App - System Rules

## Target Audience
Israeli Authorized Dealer (עוסק מורשה)

## Tax Regulations
- **Reporting Period**: Bi-monthly (every 2 months)
- **VAT Rate**: 18% (as of 2025/2026)
- **Conservative Approach**: No VAT deduction on private cars unless explicitly specified

## Technical Requirements

### Database Design
- **Scaling**: Always include `user_id` in all database tables to support multi-user functionality

### User Interface
- **Language**: Hebrew (RTL support)
- **Reports**: No PDF generation - use summary screens optimized for copy-pasting to the Israeli Tax Authority VAT website

### Database Schema

#### users table
- id (primary key)
- name
- dealer_number (מספר עוסק)

#### transactions table
- id (primary key)
- user_id (foreign key)
- type (income/expense)
- amount (total amount including VAT)
- vat_amount (calculated VAT amount)
- date
- description
- category
- is_vat_deductible (boolean)

## Development Principles
- Keep it simple
- Cost-efficient solutions
- Focus on core functionality first
