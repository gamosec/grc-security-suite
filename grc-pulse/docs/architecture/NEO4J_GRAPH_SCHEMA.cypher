// ============================================================================
// SENTIENT GRC PLATFORM - NEO4J GRAPH DATABASE SCHEMA
// Version: 1.0.0
// Description: Graph schema for risk contextualization and impact analysis
// ============================================================================

// ============================================================================
// SECTION 1: CONSTRAINTS & INDEXES
// ============================================================================

// Unique constraints for all node types
CREATE CONSTRAINT org_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT bu_id IF NOT EXISTS FOR (b:BusinessUnit) REQUIRE b.id IS UNIQUE;
CREATE CONSTRAINT bp_id IF NOT EXISTS FOR (p:BusinessProcess) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT asset_id IF NOT EXISTS FOR (a:Asset) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT vendor_id IF NOT EXISTS FOR (v:Vendor) REQUIRE v.id IS UNIQUE;
CREATE CONSTRAINT risk_id IF NOT EXISTS FOR (r:Risk) REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT control_id IF NOT EXISTS FOR (c:Control) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT framework_code IF NOT EXISTS FOR (f:Framework) REQUIRE f.code IS UNIQUE;
CREATE CONSTRAINT requirement_id IF NOT EXISTS FOR (r:Requirement) REQUIRE r.id IS UNIQUE;

// Performance indexes
CREATE INDEX asset_org IF NOT EXISTS FOR (a:Asset) ON (a.organization_id);
CREATE INDEX asset_type IF NOT EXISTS FOR (a:Asset) ON (a.type);
CREATE INDEX asset_criticality IF NOT EXISTS FOR (a:Asset) ON (a.criticality);
CREATE INDEX process_org IF NOT EXISTS FOR (p:BusinessProcess) ON (p.organization_id);
CREATE INDEX process_revenue IF NOT EXISTS FOR (p:BusinessProcess) ON (p.is_revenue_generating);
CREATE INDEX vendor_org IF NOT EXISTS FOR (v:Vendor) ON (v.organization_id);
CREATE INDEX vendor_tier IF NOT EXISTS FOR (v:Vendor) ON (v.tier);
CREATE INDEX risk_org IF NOT EXISTS FOR (r:Risk) ON (r.organization_id);
CREATE INDEX risk_status IF NOT EXISTS FOR (r:Risk) ON (r.status);
CREATE INDEX control_org IF NOT EXISTS FOR (c:Control) ON (c.organization_id);

// Full-text search indexes
CREATE FULLTEXT INDEX asset_search IF NOT EXISTS FOR (a:Asset) ON EACH [a.name, a.description];
CREATE FULLTEXT INDEX risk_search IF NOT EXISTS FOR (r:Risk) ON EACH [r.title, r.description];
CREATE FULLTEXT INDEX vendor_search IF NOT EXISTS FOR (v:Vendor) ON EACH [v.name, v.description];

// ============================================================================
// SECTION 2: NODE DEFINITIONS (Example Data)
// ============================================================================

// Organization Node
// Properties:
//   - id: UUID (synced from PostgreSQL)
//   - name: String
//   - slug: String
//   - industry: String
//   - subscription_tier: String
//   - compliance_frameworks: List<String>

// BusinessUnit Node
// Properties:
//   - id: UUID
//   - organization_id: UUID
//   - name: String
//   - annual_revenue: Float
//   - employee_count: Integer
//   - is_revenue_generating: Boolean
//   - criticality: String (critical|high|medium|low)

// BusinessProcess Node
// Properties:
//   - id: UUID
//   - organization_id: UUID
//   - name: String
//   - description: String
//   - criticality: String
//   - is_revenue_generating: Boolean
//   - is_customer_facing: Boolean
//   - is_regulatory_required: Boolean
//   - revenue_impact_per_hour: Float
//   - regulatory_fine_exposure: Float
//   - rto_hours: Integer
//   - rpo_hours: Integer

// Asset Node
// Properties:
//   - id: UUID
//   - organization_id: UUID
//   - external_id: String
//   - name: String
//   - type: String (server|database|application|etc.)
//   - cloud_provider: String
//   - region: String
//   - criticality: String
//   - data_classification: String
//   - contains_pii: Boolean
//   - contains_phi: Boolean
//   - contains_pci: Boolean
//   - business_impact_score: Float (calculated)
//   - status: String

// Vendor Node
// Properties:
//   - id: UUID
//   - organization_id: UUID
//   - name: String
//   - tier: String (critical|high|medium|low)
//   - vendor_type: String
//   - has_data_access: Boolean
//   - data_types_accessed: List<String>
//   - current_risk_score: Float
//   - certifications: List<String>
//   - status: String

// Risk Node
// Properties:
//   - id: UUID
//   - organization_id: UUID
//   - title: String
//   - description: String
//   - category: String
//   - risk_source: String
//   - inherent_score: Float
//   - residual_score: Float
//   - business_impact_score: Float (calculated)
//   - context_priority_score: Float (calculated - THE MAGIC)
//   - financial_exposure: Float
//   - status: String
//   - due_date: Date

// Control Node
// Properties:
//   - id: UUID
//   - organization_id: UUID
//   - control_id: String
//   - name: String
//   - category: String
//   - control_type: String
//   - implementation_status: String
//   - effectiveness_rating: String

// Framework Node
// Properties:
//   - code: String (SOC2, ISO27001, GDPR, etc.)
//   - name: String
//   - version: String
//   - authority: String

// Requirement Node
// Properties:
//   - id: UUID
//   - framework_code: String
//   - requirement_id: String (CC1.1, A.5.1, etc.)
//   - title: String
//   - description: String
//   - control_type: String
//   - is_mandatory: Boolean

// User Node
// Properties:
//   - id: UUID
//   - organization_id: UUID
//   - email: String
//   - display_name: String
//   - department: String
//   - job_title: String

// ============================================================================
// SECTION 3: RELATIONSHIP DEFINITIONS
// ============================================================================

// Organization Structure
// (Organization)-[:HAS_UNIT]->(BusinessUnit)
// (BusinessUnit)-[:PARENT_OF]->(BusinessUnit)
// (BusinessUnit)-[:RUNS]->(BusinessProcess)
// (Organization)-[:EMPLOYS]->(User)

// Asset Relationships
// (Asset)-[:DEPENDS_ON {criticality: "high"}]->(Asset)
// (Asset)-[:CONNECTS_TO {protocol: "https", port: 443}]->(Asset)
// (Asset)-[:STORES_DATA_IN {data_type: "PII"}]->(Asset)
// (Asset)-[:HOSTS]->(Asset)
// (Asset)-[:RUNS_ON]->(Asset)

// Business Process Dependencies
// (BusinessProcess)-[:USES {dependency_type: "critical"}]->(Asset)
// (BusinessProcess)-[:DEPENDS_ON {dependency_level: "critical"}]->(Vendor)
// (BusinessProcess)-[:DEPENDS_ON]->(BusinessProcess)
// (BusinessProcess)-[:OWNED_BY]->(User)

// Risk Relationships
// (Risk)-[:AFFECTS]->(Asset)
// (Risk)-[:AFFECTS]->(Vendor)
// (Risk)-[:IMPACTS]->(BusinessProcess)
// (Risk)-[:MITIGATED_BY]->(Control)
// (Risk)-[:ASSIGNED_TO]->(User)

// Control Relationships
// (Control)-[:PROTECTS]->(Asset)
// (Control)-[:OWNED_BY]->(User)
// (Control)-[:SATISFIES {coverage: "full"}]->(Requirement)
// (Requirement)-[:BELONGS_TO]->(Framework)
// (Requirement)-[:PARENT_OF]->(Requirement)

// Vendor Relationships
// (Vendor)-[:PROVIDES_SERVICE_TO]->(BusinessProcess)
// (Vendor)-[:HAS_SUBCONTRACTOR]->(Vendor)
// (Vendor)-[:MANAGED_BY]->(User)

// User Relationships
// (User)-[:OWNS]->(Asset)
// (User)-[:OWNS]->(Control)
// (User)-[:MANAGES]->(BusinessProcess)
// (User)-[:MANAGES]->(Vendor)
// (User)-[:ASSIGNED_TO]->(Risk)

// ============================================================================
// SECTION 4: CORE GRAPH QUERIES
// ============================================================================

// ---------------------------------------------------------
// QUERY 1: Business Impact Analysis for an Asset
// Find all revenue-generating processes affected by an asset
// ---------------------------------------------------------

// MATCH (a:Asset {id: $assetId})
// OPTIONAL MATCH (a)<-[:USES*1..3]-(p:BusinessProcess)
// WHERE p.is_revenue_generating = true
// WITH a, collect(DISTINCT p) as processes
// RETURN a.name as asset,
//        size(processes) as affected_process_count,
//        reduce(total = 0.0, p IN processes | total + coalesce(p.revenue_impact_per_hour, 0)) as total_hourly_impact,
//        [p IN processes | {name: p.name, impact: p.revenue_impact_per_hour}] as process_details
// ORDER BY total_hourly_impact DESC

// ---------------------------------------------------------
// QUERY 2: Risk Contextualization (THE MAGIC SAUCE)
// Calculate context-aware priority for a risk
// ---------------------------------------------------------

// MATCH (r:Risk {id: $riskId})-[:AFFECTS]->(target)
// WHERE target:Asset OR target:Vendor
// 
// // Find all business processes affected through the target
// OPTIONAL MATCH (target)<-[:USES|DEPENDS_ON*1..3]-(p:BusinessProcess)
// 
// WITH r, target, collect(DISTINCT p) as processes
// 
// // Calculate impact scores
// WITH r, target,
//      size(processes) as process_count,
//      size([p IN processes WHERE p.is_revenue_generating]) as revenue_process_count,
//      size([p IN processes WHERE p.is_customer_facing]) as customer_facing_count,
//      size([p IN processes WHERE p.is_regulatory_required]) as regulatory_count,
//      reduce(total = 0.0, p IN processes | total + coalesce(p.revenue_impact_per_hour, 0)) as total_revenue_impact
// 
// // Calculate context priority score (0-100)
// WITH r, target,
//      process_count,
//      revenue_process_count,
//      customer_facing_count,
//      regulatory_count,
//      total_revenue_impact,
//      // Weighted scoring formula
//      (r.inherent_score * 0.3) +
//      (CASE WHEN revenue_process_count > 0 THEN 25 ELSE 0 END) +
//      (CASE WHEN customer_facing_count > 0 THEN 20 ELSE 0 END) +
//      (CASE WHEN regulatory_count > 0 THEN 15 ELSE 0 END) +
//      (CASE 
//          WHEN total_revenue_impact > 100000 THEN 10
//          WHEN total_revenue_impact > 10000 THEN 7
//          WHEN total_revenue_impact > 1000 THEN 4
//          ELSE 0 
//       END) as context_priority_score
// 
// RETURN r.id, r.title, r.inherent_score,
//        context_priority_score,
//        revenue_process_count,
//        total_revenue_impact,
//        CASE 
//            WHEN context_priority_score >= 80 THEN 'CRITICAL - Immediate action required'
//            WHEN context_priority_score >= 60 THEN 'HIGH - Address within 24 hours'
//            WHEN context_priority_score >= 40 THEN 'MEDIUM - Address within 1 week'
//            ELSE 'LOW - Address within 30 days'
//        END as priority_recommendation

// ---------------------------------------------------------
// QUERY 3: Vendor Breach Impact Analysis
// Analyze impact of a vendor security incident
// ---------------------------------------------------------

// MATCH (v:Vendor {id: $vendorId})-[:PROVIDES_SERVICE_TO]->(p:BusinessProcess)
// 
// // Find all dependent assets
// OPTIONAL MATCH (p)-[:USES]->(a:Asset)
// 
// // Find downstream processes
// OPTIONAL MATCH (p)<-[:DEPENDS_ON]-(downstream:BusinessProcess)
// 
// WITH v, 
//      collect(DISTINCT p) as direct_processes,
//      collect(DISTINCT a) as affected_assets,
//      collect(DISTINCT downstream) as downstream_processes
// 
// RETURN v.name as vendor,
//        size(direct_processes) as direct_process_count,
//        size(affected_assets) as affected_asset_count,
//        size(downstream_processes) as downstream_process_count,
//        reduce(total = 0.0, p IN direct_processes | total + coalesce(p.revenue_impact_per_hour, 0)) as direct_revenue_impact,
//        [p IN direct_processes | p.name] as affected_processes,
//        [a IN affected_assets | a.name] as affected_assets_list

// ---------------------------------------------------------
// QUERY 4: Compliance Coverage Analysis
// Find gaps in compliance framework coverage
// ---------------------------------------------------------

// MATCH (f:Framework {code: $frameworkCode})-[:HAS_REQUIREMENT]->(req:Requirement)
// 
// // Check if requirement is satisfied
// OPTIONAL MATCH (req)<-[:SATISFIES]-(c:Control {organization_id: $orgId})
// WHERE c.implementation_status = 'implemented'
// 
// WITH req, c, f
// 
// // Find assets that would be affected by the gap
// OPTIONAL MATCH (c)-[:PROTECTS]->(a:Asset)
// OPTIONAL MATCH (a)<-[:USES]-(p:BusinessProcess)
// 
// WITH req, c, f,
//      collect(DISTINCT a) as protected_assets,
//      collect(DISTINCT p) as covered_processes
// 
// RETURN req.requirement_id,
//        req.title,
//        CASE WHEN c IS NOT NULL THEN 'Covered' ELSE 'Gap' END as status,
//        coalesce(c.effectiveness_rating, 'N/A') as effectiveness,
//        size(protected_assets) as asset_coverage,
//        size(covered_processes) as process_coverage,
//        reduce(total = 0.0, p IN covered_processes | total + coalesce(p.revenue_impact_per_hour, 0)) as revenue_at_risk
// ORDER BY status, revenue_at_risk DESC

// ---------------------------------------------------------
// QUERY 5: Attack Path Analysis
// Find all paths from external risk to critical assets
// ---------------------------------------------------------

// MATCH (entry:Asset {type: 'application', is_external_facing: true})
// MATCH (critical:Asset {criticality: 'critical'})
// WHERE entry.organization_id = $orgId AND critical.organization_id = $orgId
// 
// // Find attack paths
// MATCH path = shortestPath((entry)-[:CONNECTS_TO|DEPENDS_ON|HOSTS*1..5]->(critical))
// 
// WITH path, entry, critical,
//      length(path) as path_length,
//      [n IN nodes(path) | n.name] as path_nodes,
//      [r IN relationships(path) | type(r)] as path_relationships
// 
// // Get risks along the path
// UNWIND nodes(path) as node
// OPTIONAL MATCH (r:Risk {status: 'open'})-[:AFFECTS]->(node)
// 
// WITH path, entry, critical, path_length, path_nodes, path_relationships,
//      collect(DISTINCT r) as risks_along_path
// 
// RETURN entry.name as entry_point,
//        critical.name as critical_asset,
//        path_length as hops,
//        path_nodes,
//        path_relationships,
//        size(risks_along_path) as open_risks_count,
//        [r IN risks_along_path | {title: r.title, score: r.inherent_score}] as risks
// ORDER BY size(risks_along_path) DESC, path_length ASC

// ---------------------------------------------------------
// QUERY 6: Risk Propagation Simulation
// Simulate impact if an asset becomes compromised
// ---------------------------------------------------------

// MATCH (compromised:Asset {id: $assetId})
// 
// // Find all reachable nodes through dependencies
// CALL apoc.path.subgraphNodes(compromised, {
//     relationshipFilter: "DEPENDS_ON>|HOSTS>|STORES_DATA_IN>|CONNECTS_TO>",
//     maxLevel: 4,
//     labelFilter: "+Asset|+BusinessProcess"
// }) YIELD node
// 
// WITH compromised, collect(node) as affected_nodes
// 
// // Separate by type
// WITH compromised,
//      [n IN affected_nodes WHERE n:Asset] as affected_assets,
//      [n IN affected_nodes WHERE n:BusinessProcess] as affected_processes
// 
// // Calculate total impact
// WITH compromised,
//      affected_assets,
//      affected_processes,
//      size(affected_assets) as asset_count,
//      size(affected_processes) as process_count,
//      size([p IN affected_processes WHERE p.is_revenue_generating]) as revenue_process_count,
//      reduce(total = 0.0, p IN affected_processes | total + coalesce(p.revenue_impact_per_hour, 0)) as total_revenue_impact
// 
// RETURN compromised.name as compromised_asset,
//        asset_count as cascade_asset_count,
//        process_count as affected_process_count,
//        revenue_process_count as revenue_processes_at_risk,
//        total_revenue_impact as hourly_revenue_at_risk,
//        total_revenue_impact * 24 as daily_revenue_at_risk,
//        [a IN affected_assets[0..10] | a.name] as sample_affected_assets,
//        [p IN affected_processes[0..10] | p.name] as sample_affected_processes

// ---------------------------------------------------------
// QUERY 7: Vendor Dependency Chain
// Find deep vendor dependencies (4th party risk)
// ---------------------------------------------------------

// MATCH (v:Vendor {organization_id: $orgId})
// WHERE v.tier IN ['critical', 'high']
// 
// // Find subcontractor chains
// OPTIONAL MATCH path = (v)-[:HAS_SUBCONTRACTOR*1..3]->(sub:Vendor)
// 
// WITH v, collect(path) as subcontractor_paths
// 
// // Get services provided
// MATCH (v)-[:PROVIDES_SERVICE_TO]->(p:BusinessProcess)
// 
// WITH v, subcontractor_paths, collect(DISTINCT p) as services
// 
// RETURN v.name as vendor,
//        v.tier as tier,
//        v.current_risk_score as risk_score,
//        size(services) as service_count,
//        reduce(total = 0.0, p IN services | total + coalesce(p.revenue_impact_per_hour, 0)) as revenue_dependency,
//        size(subcontractor_paths) as subcontractor_count,
//        [path IN subcontractor_paths | [n IN nodes(path) | n.name]] as dependency_chains
// ORDER BY revenue_dependency DESC

// ---------------------------------------------------------
// QUERY 8: Executive Risk Summary
// Aggregate risk metrics for board reporting
// ---------------------------------------------------------

// MATCH (r:Risk {organization_id: $orgId})
// WHERE r.status IN ['open', 'in_progress']
// 
// // Get business impact
// OPTIONAL MATCH (r)-[:IMPACTS]->(p:BusinessProcess)
// 
// WITH r, collect(DISTINCT p) as affected_processes
// 
// // Aggregate by category
// WITH r.category as category,
//      count(r) as risk_count,
//      avg(r.inherent_score) as avg_inherent_score,
//      avg(r.context_priority_score) as avg_priority_score,
//      sum(coalesce(r.financial_exposure, 0)) as total_exposure,
//      collect(DISTINCT r) as risks,
//      reduce(all_processes = [], r IN collect(r) | all_processes + affected_processes) as all_affected
// 
// RETURN category,
//        risk_count,
//        round(avg_inherent_score, 2) as avg_inherent_score,
//        round(avg_priority_score, 2) as avg_priority_score,
//        total_exposure,
//        size([r IN risks WHERE r.context_priority_score >= 80]) as critical_count,
//        size([r IN risks WHERE r.context_priority_score >= 60 AND r.context_priority_score < 80]) as high_count,
//        size([r IN risks WHERE r.context_priority_score >= 40 AND r.context_priority_score < 60]) as medium_count,
//        size([r IN risks WHERE r.context_priority_score < 40]) as low_count
// ORDER BY total_exposure DESC

// ============================================================================
// SECTION 5: GRAPH ALGORITHMS (using APOC/GDS)
// ============================================================================

// ---------------------------------------------------------
// ALGORITHM 1: PageRank for Asset Criticality
// Identify most "central" assets in the infrastructure
// ---------------------------------------------------------

// CALL gds.pageRank.stream('asset-graph', {
//     nodeLabels: ['Asset'],
//     relationshipTypes: ['DEPENDS_ON', 'CONNECTS_TO', 'HOSTS'],
//     maxIterations: 20,
//     dampingFactor: 0.85
// })
// YIELD nodeId, score
// WITH gds.util.asNode(nodeId) AS asset, score
// WHERE asset.organization_id = $orgId
// RETURN asset.name, asset.type, asset.criticality, score AS pagerank_score
// ORDER BY score DESC
// LIMIT 20

// ---------------------------------------------------------
// ALGORITHM 2: Community Detection for Asset Clusters
// Identify groups of tightly-coupled assets
// ---------------------------------------------------------

// CALL gds.louvain.stream('asset-graph', {
//     nodeLabels: ['Asset'],
//     relationshipTypes: ['DEPENDS_ON', 'CONNECTS_TO', 'STORES_DATA_IN'],
//     includeIntermediateCommunities: false
// })
// YIELD nodeId, communityId
// WITH gds.util.asNode(nodeId) AS asset, communityId
// WHERE asset.organization_id = $orgId
// RETURN communityId,
//        collect(asset.name) AS assets,
//        count(*) AS size
// ORDER BY size DESC

// ---------------------------------------------------------
// ALGORITHM 3: Betweenness Centrality for Bottleneck Detection
// Find assets that are single points of failure
// ---------------------------------------------------------

// CALL gds.betweenness.stream('asset-graph', {
//     nodeLabels: ['Asset'],
//     relationshipTypes: ['DEPENDS_ON', 'HOSTS']
// })
// YIELD nodeId, score
// WITH gds.util.asNode(nodeId) AS asset, score
// WHERE asset.organization_id = $orgId AND score > 0
// RETURN asset.name,
//        asset.type,
//        asset.criticality,
//        score AS betweenness_score,
//        CASE 
//            WHEN score > 1000 THEN 'CRITICAL BOTTLENECK'
//            WHEN score > 100 THEN 'HIGH RISK'
//            WHEN score > 10 THEN 'MODERATE RISK'
//            ELSE 'LOW RISK'
//        END AS bottleneck_risk
// ORDER BY score DESC
// LIMIT 20

// ============================================================================
// SECTION 6: DATA SYNC PROCEDURES
// ============================================================================

// ---------------------------------------------------------
// PROCEDURE: Sync Asset from PostgreSQL
// ---------------------------------------------------------

// MERGE (a:Asset {id: $asset.id})
// SET a.organization_id = $asset.organization_id,
//     a.name = $asset.name,
//     a.type = $asset.asset_type,
//     a.cloud_provider = $asset.cloud_provider,
//     a.region = $asset.region,
//     a.criticality = $asset.criticality,
//     a.data_classification = $asset.data_classification,
//     a.contains_pii = $asset.contains_pii,
//     a.contains_phi = $asset.contains_phi,
//     a.contains_pci = $asset.contains_pci,
//     a.status = $asset.status,
//     a.updated_at = datetime()
// 
// WITH a
// MATCH (o:Organization {id: $asset.organization_id})
// MERGE (o)-[:HAS_ASSET]->(a)
// 
// RETURN a

// ---------------------------------------------------------
// PROCEDURE: Sync Asset Relationship
// ---------------------------------------------------------

// MATCH (source:Asset {id: $rel.source_asset_id})
// MATCH (target:Asset {id: $rel.target_asset_id})
// 
// CALL apoc.merge.relationship(source, $rel.relationship_type, {}, $rel.metadata, target) YIELD rel
// 
// RETURN source.name, type(rel), target.name

// ---------------------------------------------------------
// PROCEDURE: Recalculate Business Impact Score
// ---------------------------------------------------------

// MATCH (a:Asset {id: $assetId})
// 
// // Find all affected business processes
// OPTIONAL MATCH (a)<-[:USES*1..3]-(p:BusinessProcess)
// 
// WITH a, collect(DISTINCT p) as processes
// 
// // Calculate weighted impact score
// WITH a, 
//      reduce(score = 0, p IN processes |
//          score + CASE p.criticality
//              WHEN 'critical' THEN 100
//              WHEN 'high' THEN 75
//              WHEN 'medium' THEN 50
//              WHEN 'low' THEN 25
//              ELSE 10
//          END +
//          CASE WHEN p.is_revenue_generating THEN 50 ELSE 0 END +
//          CASE WHEN p.is_customer_facing THEN 25 ELSE 0 END +
//          CASE WHEN p.is_regulatory_required THEN 25 ELSE 0 END
//      ) as raw_score,
//      size(processes) as process_count
// 
// // Normalize to 0-100
// WITH a, 
//      CASE WHEN process_count > 0 
//          THEN toFloat(raw_score) / (process_count * 200) * 100
//          ELSE 0 
//      END as normalized_score
// 
// SET a.business_impact_score = round(normalized_score, 2)
// 
// RETURN a.name, a.business_impact_score
