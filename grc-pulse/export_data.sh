#!/bin/bash

# Tables to export
TABLES=(
  "organizations"
  "users"
  "business_units"
  "assets"
  "risk_items"
  "control_library"
  "control_assessments"
  "control_mappings"
  "control_risk_mappings"
  "control_risk_suggestions"
  "compliance_frameworks_v2"
  "compliance_snapshots"
  "domain_snapshots"
  "risk_snapshots"
  "maturity_assessments"
  "maturity_category_scores"
  "maturity_responses"
  "vendors"
  "organization_profile"
  "org_framework_applicability"
  "soa_entries"
)

echo "-- GRC Pulse Database Export"
echo "-- Generated: $(date)"
echo ""

for table in "${TABLES[@]}"; do
  echo "-- Exporting $table..."
  result=$(wrangler d1 execute grc-pulse-db --remote --command="SELECT * FROM $table" 2>&1)
  if echo "$result" | grep -q '"results"'; then
    echo "-- Table: $table"
    echo "$result" | grep -o '\[.*\]' | head -1
    echo ""
  fi
done
