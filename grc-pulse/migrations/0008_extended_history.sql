-- Migration: 0008_extended_history.sql
-- Description: Add 12 months of historical trend data
-- Date: 2024-12-31

-- Delete existing demo data and add full 12 months
DELETE FROM compliance_snapshots WHERE organization_id = 'org-001';
DELETE FROM domain_snapshots WHERE organization_id = 'org-001';
DELETE FROM risk_snapshots WHERE organization_id = 'org-001';

-- ISO 27001 historical scores (12 months)
INSERT INTO compliance_snapshots (id, organization_id, framework_id, snapshot_date, basic_score, advanced_score, implemented_count, in_progress_count, not_started_count, total_controls, avg_maturity) VALUES
('snap-iso-m12', 'org-001', 'fw-iso27001', date('now', '-12 months'), 25, 18, 23, 10, 60, 93, 1.5),
('snap-iso-m11', 'org-001', 'fw-iso27001', date('now', '-11 months'), 32, 24, 30, 12, 51, 93, 1.8),
('snap-iso-m10', 'org-001', 'fw-iso27001', date('now', '-10 months'), 38, 30, 35, 14, 44, 93, 2.0),
('snap-iso-m09', 'org-001', 'fw-iso27001', date('now', '-9 months'), 45, 38, 42, 15, 36, 93, 2.2),
('snap-iso-m08', 'org-001', 'fw-iso27001', date('now', '-8 months'), 50, 42, 47, 16, 30, 93, 2.4),
('snap-iso-m07', 'org-001', 'fw-iso27001', date('now', '-7 months'), 55, 48, 51, 17, 25, 93, 2.6),
('snap-iso-m06', 'org-001', 'fw-iso27001', date('now', '-6 months'), 58, 51, 54, 18, 21, 93, 2.7),
('snap-iso-m05', 'org-001', 'fw-iso27001', date('now', '-5 months'), 63, 56, 59, 16, 18, 93, 2.9),
('snap-iso-m04', 'org-001', 'fw-iso27001', date('now', '-4 months'), 68, 61, 63, 14, 16, 93, 3.1),
('snap-iso-m03', 'org-001', 'fw-iso27001', date('now', '-3 months'), 73, 66, 68, 12, 13, 93, 3.2),
('snap-iso-m02', 'org-001', 'fw-iso27001', date('now', '-2 months'), 78, 71, 73, 10, 10, 93, 3.4),
('snap-iso-m01', 'org-001', 'fw-iso27001', date('now', '-1 months'), 82, 75, 76, 9, 8, 93, 3.5),
('snap-iso-m00', 'org-001', 'fw-iso27001', date('now'), 84, 77, 78, 8, 7, 93, 3.6);

-- SOC 2 historical scores (12 months)
INSERT INTO compliance_snapshots (id, organization_id, framework_id, snapshot_date, basic_score, advanced_score, implemented_count, in_progress_count, not_started_count, total_controls, avg_maturity) VALUES
('snap-soc2-m12', 'org-001', 'fw-soc2', date('now', '-12 months'), 15, 10, 7, 5, 36, 48, 1.2),
('snap-soc2-m11', 'org-001', 'fw-soc2', date('now', '-11 months'), 21, 15, 10, 6, 32, 48, 1.5),
('snap-soc2-m10', 'org-001', 'fw-soc2', date('now', '-10 months'), 27, 20, 13, 8, 27, 48, 1.7),
('snap-soc2-m09', 'org-001', 'fw-soc2', date('now', '-9 months'), 33, 26, 16, 9, 23, 48, 1.9),
('snap-soc2-m08', 'org-001', 'fw-soc2', date('now', '-8 months'), 38, 30, 18, 10, 20, 48, 2.1),
('snap-soc2-m07', 'org-001', 'fw-soc2', date('now', '-7 months'), 42, 34, 20, 11, 17, 48, 2.3),
('snap-soc2-m06', 'org-001', 'fw-soc2', date('now', '-6 months'), 46, 38, 22, 10, 16, 48, 2.5),
('snap-soc2-m05', 'org-001', 'fw-soc2', date('now', '-5 months'), 50, 42, 24, 10, 14, 48, 2.7),
('snap-soc2-m04', 'org-001', 'fw-soc2', date('now', '-4 months'), 54, 46, 26, 9, 13, 48, 2.8),
('snap-soc2-m03', 'org-001', 'fw-soc2', date('now', '-3 months'), 56, 48, 27, 9, 12, 48, 2.9),
('snap-soc2-m02', 'org-001', 'fw-soc2', date('now', '-2 months'), 58, 52, 28, 8, 12, 48, 3.0),
('snap-soc2-m01', 'org-001', 'fw-soc2', date('now', '-1 months'), 60, 55, 29, 7, 12, 48, 3.1),
('snap-soc2-m00', 'org-001', 'fw-soc2', date('now'), 62, 58, 30, 6, 12, 48, 3.2);

-- Domain historical scores (12 months - monthly)
INSERT INTO domain_snapshots (id, organization_id, snapshot_date, domain_name, basic_score, advanced_score, implemented_count, total_controls) VALUES
-- Organizational
('dsnap-org-m12', 'org-001', date('now', '-12 months'), 'Organizational', 22, 16, 8, 37),
('dsnap-org-m09', 'org-001', date('now', '-9 months'), 'Organizational', 38, 30, 14, 37),
('dsnap-org-m06', 'org-001', date('now', '-6 months'), 'Organizational', 54, 46, 20, 37),
('dsnap-org-m03', 'org-001', date('now', '-3 months'), 'Organizational', 68, 60, 25, 37),
('dsnap-org-m00', 'org-001', date('now'), 'Organizational', 76, 70, 28, 37),
-- People
('dsnap-ppl-m12', 'org-001', date('now', '-12 months'), 'People', 25, 18, 2, 8),
('dsnap-ppl-m09', 'org-001', date('now', '-9 months'), 'People', 50, 40, 4, 8),
('dsnap-ppl-m06', 'org-001', date('now', '-6 months'), 'People', 63, 54, 5, 8),
('dsnap-ppl-m03', 'org-001', date('now', '-3 months'), 'People', 75, 66, 6, 8),
('dsnap-ppl-m00', 'org-001', date('now'), 'People', 88, 82, 7, 8),
-- Physical
('dsnap-phy-m12', 'org-001', date('now', '-12 months'), 'Physical', 29, 20, 4, 14),
('dsnap-phy-m09', 'org-001', date('now', '-9 months'), 'Physical', 50, 42, 7, 14),
('dsnap-phy-m06', 'org-001', date('now', '-6 months'), 'Physical', 64, 56, 9, 14),
('dsnap-phy-m03', 'org-001', date('now', '-3 months'), 'Physical', 79, 72, 11, 14),
('dsnap-phy-m00', 'org-001', date('now'), 'Physical', 93, 88, 13, 14),
-- Technological
('dsnap-tech-m12', 'org-001', date('now', '-12 months'), 'Technological', 26, 18, 9, 34),
('dsnap-tech-m09', 'org-001', date('now', '-9 months'), 'Technological', 44, 36, 15, 34),
('dsnap-tech-m06', 'org-001', date('now', '-6 months'), 'Technological', 56, 48, 19, 34),
('dsnap-tech-m03', 'org-001', date('now', '-3 months'), 'Technological', 74, 66, 25, 34),
('dsnap-tech-m00', 'org-001', date('now'), 'Technological', 88, 82, 30, 34);

-- Risk historical data (12 months)
INSERT INTO risk_snapshots (id, organization_id, snapshot_date, total_risks, open_risks, critical_risks, high_risks, medium_risks, low_risks, total_exposure, avg_risk_score) VALUES
('rsnap-m12', 'org-001', date('now', '-12 months'), 35, 32, 8, 12, 9, 3, 65000000, 78),
('rsnap-m11', 'org-001', date('now', '-11 months'), 33, 29, 7, 11, 8, 3, 58000000, 72),
('rsnap-m10', 'org-001', date('now', '-10 months'), 30, 26, 6, 10, 7, 3, 52000000, 68),
('rsnap-m09', 'org-001', date('now', '-9 months'), 28, 24, 6, 9, 7, 2, 48000000, 64),
('rsnap-m08', 'org-001', date('now', '-8 months'), 26, 22, 5, 8, 7, 2, 42000000, 60),
('rsnap-m07', 'org-001', date('now', '-7 months'), 24, 20, 5, 7, 6, 2, 38000000, 56),
('rsnap-m06', 'org-001', date('now', '-6 months'), 22, 18, 4, 6, 6, 2, 34000000, 52),
('rsnap-m05', 'org-001', date('now', '-5 months'), 20, 16, 4, 5, 5, 2, 30000000, 48),
('rsnap-m04', 'org-001', date('now', '-4 months'), 18, 14, 3, 5, 4, 2, 26000000, 45),
('rsnap-m03', 'org-001', date('now', '-3 months'), 16, 12, 3, 4, 4, 1, 22000000, 42),
('rsnap-m02', 'org-001', date('now', '-2 months'), 15, 11, 2, 4, 4, 1, 20000000, 40),
('rsnap-m01', 'org-001', date('now', '-1 months'), 14, 10, 2, 3, 4, 1, 18000000, 38),
('rsnap-m00', 'org-001', date('now'), 13, 9, 2, 3, 3, 1, 15000000, 35);
