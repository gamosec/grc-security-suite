#!/bin/bash
# GRC Pulse Database Export Script

TABLES=(
  "organizations"
  "users"
  "business_units"
  "business_processes"
  "assets"
  "asset_relationships"
  "asset_process_mappings"
  "vendors"
  "vendor_process_mappings"
  "vendor_incidents"
  "risk_items"
  "risk_history"
  "compliance_frameworks"
  "controls"
  "policies"
  "maturity_assessments"
  "maturity_responses"
  "maturity_category_scores"
  "maturity_improvement_actions"
  "pentest_sync_log"
  "compliance_frameworks_v2"
  "control_library"
  "iso27001_themes"
  "control_mappings"
  "org_framework_applicability"
  "control_assessments"
  "compliance_scores"
  "compliance_history"
  "organization_profile"
  "framework_applicability"
  "soa_entries"
  "industry_framework_requirements"
  "data_type_framework_requirements"
  "region_framework_requirements"
  "compliance_snapshots"
  "domain_snapshots"
  "risk_snapshots"
  "control_risk_mappings"
  "control_asset_mappings"
  "risk_asset_mappings"
  "control_risk_suggestions"
)

echo "-- GRC Pulse Database Export" > database_dump.sql
echo "-- Generated: $(date)" >> database_dump.sql
echo "" >> database_dump.sql

for table in "${TABLES[@]}"; do
  echo "Exporting $table..."
  wrangler d1 execute grc-pulse-db --remote --command="SELECT * FROM $table" --json 2>/dev/null | \
    python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    results = data[0].get('results', [])
    if results:
        table = '$table'
        for row in results:
            cols = ', '.join(row.keys())
            vals = ', '.join([repr(str(v)) if v is not None else 'NULL' for v in row.values()])
            print(f\"INSERT INTO {table} ({cols}) VALUES ({vals});\" )
except:
    pass
" >> database_dump.sql
done

echo "Export complete: database_dump.sql"
