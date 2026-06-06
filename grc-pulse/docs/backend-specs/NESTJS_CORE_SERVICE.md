# NestJS Core Service Specification

## Overview

The Core Service is the primary backend application handling business logic, authentication, authorization, and data management for the Sentient GRC platform.

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | NestJS | 10.x |
| Language | TypeScript | 5.x |
| ORM | Prisma | 5.x |
| Validation | class-validator | 0.14.x |
| Authentication | Passport.js | 0.7.x |
| API Documentation | Swagger/OpenAPI | 7.x |
| Testing | Jest | 29.x |
| Queue | BullMQ | 5.x |

## Project Structure

```
core-service/
├── src/
│   ├── main.ts                     # Application entry point
│   ├── app.module.ts               # Root module
│   │
│   ├── common/                     # Shared utilities
│   │   ├── decorators/             # Custom decorators
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── current-org.decorator.ts
│   │   │   ├── permissions.decorator.ts
│   │   │   └── api-paginated.decorator.ts
│   │   ├── filters/
│   │   │   ├── http-exception.filter.ts
│   │   │   └── prisma-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── rbac.guard.ts
│   │   │   └── org-membership.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   └── timeout.interceptor.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   └── dto/
│   │       ├── pagination.dto.ts
│   │       └── response.dto.ts
│   │
│   ├── config/                     # Configuration
│   │   ├── config.module.ts
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   ├── redis.config.ts
│   │   └── validation.schema.ts
│   │
│   ├── modules/
│   │   ├── auth/                   # Authentication module
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── saml.strategy.ts
│   │   │   │   └── api-key.strategy.ts
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── register.dto.ts
│   │   │   │   └── token.dto.ts
│   │   │   └── guards/
│   │   │       └── mfa.guard.ts
│   │   │
│   │   ├── users/                  # User management
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   └── dto/
│   │   │       ├── create-user.dto.ts
│   │   │       ├── update-user.dto.ts
│   │   │       └── user-response.dto.ts
│   │   │
│   │   ├── organizations/          # Multi-tenancy
│   │   │   ├── organizations.module.ts
│   │   │   ├── organizations.controller.ts
│   │   │   ├── organizations.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── assets/                 # Asset management
│   │   │   ├── assets.module.ts
│   │   │   ├── assets.controller.ts
│   │   │   ├── assets.service.ts
│   │   │   ├── assets.repository.ts
│   │   │   └── dto/
│   │   │       ├── create-asset.dto.ts
│   │   │       ├── update-asset.dto.ts
│   │   │       └── asset-query.dto.ts
│   │   │
│   │   ├── risks/                  # Risk management
│   │   │   ├── risks.module.ts
│   │   │   ├── risks.controller.ts
│   │   │   ├── risks.service.ts
│   │   │   ├── risk-scoring.service.ts  # Context-aware scoring
│   │   │   ├── risks.repository.ts
│   │   │   └── dto/
│   │   │       ├── create-risk.dto.ts
│   │   │       ├── risk-query.dto.ts
│   │   │       └── risk-response.dto.ts
│   │   │
│   │   ├── vendors/                # Vendor management
│   │   │   ├── vendors.module.ts
│   │   │   ├── vendors.controller.ts
│   │   │   ├── vendors.service.ts
│   │   │   ├── vendor-scoring.service.ts
│   │   │   ├── vendor-incidents.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── controls/               # Compliance controls
│   │   │   ├── controls.module.ts
│   │   │   ├── controls.controller.ts
│   │   │   ├── controls.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── policies/               # Policy management
│   │   │   ├── policies.module.ts
│   │   │   ├── policies.controller.ts
│   │   │   ├── policies.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── business-processes/     # Business process mapping
│   │   │   ├── business-processes.module.ts
│   │   │   ├── business-processes.controller.ts
│   │   │   ├── business-processes.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── graph/                  # Neo4j graph queries
│   │   │   ├── graph.module.ts
│   │   │   ├── graph.service.ts
│   │   │   └── queries/
│   │   │       ├── impact-analysis.queries.ts
│   │   │       ├── risk-propagation.queries.ts
│   │   │       └── compliance-gaps.queries.ts
│   │   │
│   │   ├── audit/                  # Audit logging
│   │   │   ├── audit.module.ts
│   │   │   ├── audit.service.ts
│   │   │   ├── audit.interceptor.ts
│   │   │   └── dto/
│   │   │
│   │   ├── notifications/          # Alert system
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.service.ts
│   │   │   ├── notifications.gateway.ts  # WebSocket
│   │   │   └── channels/
│   │   │       ├── email.channel.ts
│   │   │       ├── slack.channel.ts
│   │   │       └── webhook.channel.ts
│   │   │
│   │   └── reports/                # Report generation
│   │       ├── reports.module.ts
│   │       ├── reports.controller.ts
│   │       ├── reports.service.ts
│   │       └── templates/
│   │
│   └── prisma/                     # Database
│       ├── prisma.module.ts
│       ├── prisma.service.ts
│       └── schema.prisma
│
├── test/                           # Tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── .env.example
├── nest-cli.json
├── package.json
└── tsconfig.json
```

## Core Modules Specification

### 1. Authentication Module

```typescript
// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      // Increment failed attempts
      await this.incrementFailedAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.resetFailedAttempts(user.id);
    
    return user;
  }

  async login(user: any, mfaCode?: string) {
    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return { requiresMfa: true, userId: user.id };
      }
      const isValidMfa = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: mfaCode,
      });
      if (!isValidMfa) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    const payload = {
      sub: user.id,
      email: user.email,
      orgId: user.organizationId,
      roles: user.roles.map(r => r.role.name),
    };

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create audit log
    await this.createAuditLog(user.id, 'login', 'success');

    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        organization: user.organization,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersService.findById(payload.sub);
      
      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = {
        sub: user.id,
        email: user.email,
        orgId: user.organizationId,
        roles: user.roles.map(r => r.role.name),
      };

      return {
        accessToken: this.jwtService.sign(newPayload, { expiresIn: '15m' }),
        refreshToken: this.jwtService.sign(newPayload, { expiresIn: '7d' }),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async incrementFailedAttempts(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: { increment: 1 },
      },
    });

    // Lock account after 5 failed attempts
    if (user.failedLoginAttempts >= 5) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        },
      });
    }
  }

  private async resetFailedAttempts(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  private async createAuditLog(userId: string, action: string, status: string) {
    // Implementation
  }
}
```

### 2. Risk Scoring Service (Context-Aware)

```typescript
// src/modules/risks/risk-scoring.service.ts
import { Injectable } from '@nestjs/common';
import { GraphService } from '../graph/graph.service';
import { PrismaService } from '../../prisma/prisma.service';

interface BusinessImpact {
  affectedProcesses: number;
  revenueGeneratingProcesses: number;
  customerFacingProcesses: number;
  regulatoryRequiredProcesses: number;
  totalRevenueImpact: number;
}

interface ContextScore {
  contextPriorityScore: number;
  contextPriorityReason: string;
  businessImpactScore: number;
  financialExposure: number;
}

@Injectable()
export class RiskScoringService {
  constructor(
    private readonly graphService: GraphService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Calculate context-aware priority score for a risk
   * This is the "magic sauce" that differentiates from traditional CVSS
   */
  async calculateContextScore(riskId: string): Promise<ContextScore> {
    const risk = await this.prisma.riskItem.findUnique({
      where: { id: riskId },
      include: { affectedAsset: true, affectedVendor: true },
    });

    if (!risk) {
      throw new Error('Risk not found');
    }

    // Get business impact from graph database
    let businessImpact: BusinessImpact;
    
    if (risk.affectedAssetId) {
      businessImpact = await this.graphService.getAssetBusinessImpact(
        risk.affectedAssetId
      );
    } else if (risk.affectedVendorId) {
      businessImpact = await this.graphService.getVendorBusinessImpact(
        risk.affectedVendorId
      );
    } else {
      businessImpact = {
        affectedProcesses: 0,
        revenueGeneratingProcesses: 0,
        customerFacingProcesses: 0,
        regulatoryRequiredProcesses: 0,
        totalRevenueImpact: 0,
      };
    }

    // Calculate context priority score (0-100)
    // Weighted formula:
    // - Inherent Score: 30%
    // - Revenue-generating processes: 25 points
    // - Customer-facing systems: 20 points
    // - Regulatory requirements: 15 points
    // - Financial exposure magnitude: 10 points

    const inherentComponent = risk.inherentScore * 0.3;
    
    const revenueComponent = businessImpact.revenueGeneratingProcesses > 0 ? 25 : 0;
    const customerComponent = businessImpact.customerFacingProcesses > 0 ? 20 : 0;
    const regulatoryComponent = businessImpact.regulatoryRequiredProcesses > 0 ? 15 : 0;
    
    let financialComponent = 0;
    if (businessImpact.totalRevenueImpact > 100000) {
      financialComponent = 10;
    } else if (businessImpact.totalRevenueImpact > 10000) {
      financialComponent = 7;
    } else if (businessImpact.totalRevenueImpact > 1000) {
      financialComponent = 4;
    }

    const contextPriorityScore = Math.min(100, Math.round(
      inherentComponent +
      revenueComponent +
      customerComponent +
      regulatoryComponent +
      financialComponent
    ));

    // Generate human-readable explanation
    const reasons: string[] = [];
    if (businessImpact.revenueGeneratingProcesses > 0) {
      reasons.push(`Affects ${businessImpact.revenueGeneratingProcesses} revenue-generating process(es)`);
    }
    if (businessImpact.customerFacingProcesses > 0) {
      reasons.push(`Impacts ${businessImpact.customerFacingProcesses} customer-facing system(s)`);
    }
    if (businessImpact.regulatoryRequiredProcesses > 0) {
      reasons.push('Has regulatory compliance implications');
    }
    if (businessImpact.totalRevenueImpact > 0) {
      reasons.push(`$${(businessImpact.totalRevenueImpact).toLocaleString()}/hr revenue exposure`);
    }

    const contextPriorityReason = reasons.length > 0
      ? reasons.join('; ')
      : 'Limited business impact identified';

    // Calculate business impact score (0-100)
    const businessImpactScore = this.calculateBusinessImpactScore(businessImpact);

    // Estimate financial exposure (24-hour impact)
    const financialExposure = businessImpact.totalRevenueImpact * 24;

    return {
      contextPriorityScore,
      contextPriorityReason,
      businessImpactScore,
      financialExposure,
    };
  }

  private calculateBusinessImpactScore(impact: BusinessImpact): number {
    let score = 0;
    
    // Process count component (max 40)
    score += Math.min(40, impact.affectedProcesses * 10);
    
    // Revenue component (max 30)
    score += Math.min(30, impact.revenueGeneratingProcesses * 15);
    
    // Customer-facing component (max 20)
    score += impact.customerFacingProcesses > 0 ? 20 : 0;
    
    // Regulatory component (max 10)
    score += impact.regulatoryRequiredProcesses > 0 ? 10 : 0;
    
    return Math.min(100, score);
  }

  /**
   * Batch recalculate scores for all open risks
   * Called periodically or when business process mappings change
   */
  async recalculateAllOpenRisks(organizationId: string): Promise<void> {
    const openRisks = await this.prisma.riskItem.findMany({
      where: {
        organizationId,
        status: { in: ['open', 'in_progress'] },
      },
    });

    for (const risk of openRisks) {
      try {
        const scores = await this.calculateContextScore(risk.id);
        
        await this.prisma.riskItem.update({
          where: { id: risk.id },
          data: {
            contextPriorityScore: scores.contextPriorityScore,
            contextPriorityReason: scores.contextPriorityReason,
            businessImpactScore: scores.businessImpactScore,
            financialExposure: scores.financialExposure,
            lastAssessedAt: new Date(),
          },
        });
      } catch (error) {
        console.error(`Failed to recalculate risk ${risk.id}:`, error);
      }
    }
  }
}
```

### 3. Graph Service (Neo4j Integration)

```typescript
// src/modules/graph/graph.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session } from 'neo4j-driver';

@Injectable()
export class GraphService implements OnModuleInit, OnModuleDestroy {
  private driver: Driver;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.driver = neo4j.driver(
      this.configService.get('NEO4J_URI'),
      neo4j.auth.basic(
        this.configService.get('NEO4J_USER'),
        this.configService.get('NEO4J_PASSWORD'),
      ),
    );
    await this.driver.verifyConnectivity();
  }

  async onModuleDestroy() {
    await this.driver.close();
  }

  private getSession(): Session {
    return this.driver.session();
  }

  /**
   * Get business impact for an asset by traversing the graph
   */
  async getAssetBusinessImpact(assetId: string): Promise<{
    affectedProcesses: number;
    revenueGeneratingProcesses: number;
    customerFacingProcesses: number;
    regulatoryRequiredProcesses: number;
    totalRevenueImpact: number;
  }> {
    const session = this.getSession();
    
    try {
      const result = await session.run(
        `
        MATCH (a:Asset {id: $assetId})
        OPTIONAL MATCH (a)<-[:USES*1..3]-(p:BusinessProcess)
        
        WITH a, collect(DISTINCT p) as processes
        
        RETURN 
          size(processes) as affectedProcesses,
          size([p IN processes WHERE p.is_revenue_generating = true]) as revenueGeneratingProcesses,
          size([p IN processes WHERE p.is_customer_facing = true]) as customerFacingProcesses,
          size([p IN processes WHERE p.is_regulatory_required = true]) as regulatoryRequiredProcesses,
          reduce(total = 0.0, p IN processes | total + coalesce(p.revenue_impact_per_hour, 0)) as totalRevenueImpact
        `,
        { assetId },
      );

      const record = result.records[0];
      
      return {
        affectedProcesses: record.get('affectedProcesses').toNumber(),
        revenueGeneratingProcesses: record.get('revenueGeneratingProcesses').toNumber(),
        customerFacingProcesses: record.get('customerFacingProcesses').toNumber(),
        regulatoryRequiredProcesses: record.get('regulatoryRequiredProcesses').toNumber(),
        totalRevenueImpact: record.get('totalRevenueImpact'),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get vendor impact by analyzing dependent business processes
   */
  async getVendorBusinessImpact(vendorId: string): Promise<{
    affectedProcesses: number;
    revenueGeneratingProcesses: number;
    customerFacingProcesses: number;
    regulatoryRequiredProcesses: number;
    totalRevenueImpact: number;
  }> {
    const session = this.getSession();
    
    try {
      const result = await session.run(
        `
        MATCH (v:Vendor {id: $vendorId})-[:PROVIDES_SERVICE_TO]->(p:BusinessProcess)
        
        WITH collect(DISTINCT p) as processes
        
        RETURN 
          size(processes) as affectedProcesses,
          size([p IN processes WHERE p.is_revenue_generating = true]) as revenueGeneratingProcesses,
          size([p IN processes WHERE p.is_customer_facing = true]) as customerFacingProcesses,
          size([p IN processes WHERE p.is_regulatory_required = true]) as regulatoryRequiredProcesses,
          reduce(total = 0.0, p IN processes | total + coalesce(p.revenue_impact_per_hour, 0)) as totalRevenueImpact
        `,
        { vendorId },
      );

      const record = result.records[0];
      
      return {
        affectedProcesses: record.get('affectedProcesses').toNumber(),
        revenueGeneratingProcesses: record.get('revenueGeneratingProcesses').toNumber(),
        customerFacingProcesses: record.get('customerFacingProcesses').toNumber(),
        regulatoryRequiredProcesses: record.get('regulatoryRequiredProcesses').toNumber(),
        totalRevenueImpact: record.get('totalRevenueImpact'),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Simulate risk propagation from a compromised asset
   */
  async simulateRiskPropagation(assetId: string): Promise<{
    affectedAssets: Array<{ id: string; name: string; criticality: string }>;
    affectedProcesses: Array<{ id: string; name: string; revenueImpact: number }>;
    totalHourlyImpact: number;
  }> {
    const session = this.getSession();
    
    try {
      const result = await session.run(
        `
        MATCH (a:Asset {id: $assetId})
        
        // Find all reachable assets
        CALL apoc.path.subgraphNodes(a, {
            relationshipFilter: "DEPENDS_ON>|HOSTS>|STORES_DATA_IN>|CONNECTS_TO>",
            maxLevel: 4,
            labelFilter: "+Asset"
        }) YIELD node as affectedAsset
        
        // Find affected business processes
        OPTIONAL MATCH (affectedAsset)<-[:USES]-(p:BusinessProcess)
        
        WITH collect(DISTINCT affectedAsset) as assets, collect(DISTINCT p) as processes
        
        RETURN 
          [a IN assets | {id: a.id, name: a.name, criticality: a.criticality}] as affectedAssets,
          [p IN processes | {id: p.id, name: p.name, revenueImpact: p.revenue_impact_per_hour}] as affectedProcesses,
          reduce(total = 0.0, p IN processes | total + coalesce(p.revenue_impact_per_hour, 0)) as totalHourlyImpact
        `,
        { assetId },
      );

      const record = result.records[0];
      
      return {
        affectedAssets: record.get('affectedAssets'),
        affectedProcesses: record.get('affectedProcesses'),
        totalHourlyImpact: record.get('totalHourlyImpact'),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Analyze compliance gaps with business impact
   */
  async getComplianceGapsWithImpact(
    organizationId: string,
    frameworkCode: string,
  ): Promise<Array<{
    requirementId: string;
    title: string;
    unprotectedAssets: string[];
    atRiskProcesses: string[];
    potentialExposure: number;
  }>> {
    const session = this.getSession();
    
    try {
      const result = await session.run(
        `
        MATCH (f:Framework {code: $frameworkCode})-[:HAS_REQUIREMENT]->(req:Requirement)
        WHERE NOT EXISTS {
            MATCH (req)<-[:SATISFIES]-(:Control {organization_id: $organizationId, implementation_status: 'implemented'})
        }
        
        // Find unprotected assets
        OPTIONAL MATCH (req)<-[:SHOULD_SATISFY]-(:Control)-[:PROTECTS]->(a:Asset {organization_id: $organizationId})
        OPTIONAL MATCH (a)<-[:USES]-(p:BusinessProcess)
        
        WITH req,
             collect(DISTINCT a.name) as unprotectedAssets,
             collect(DISTINCT p.name) as atRiskProcesses,
             sum(coalesce(p.revenue_impact_per_hour, 0)) * 24 as potentialExposure
        
        RETURN 
          req.requirement_id as requirementId,
          req.title as title,
          unprotectedAssets,
          atRiskProcesses,
          potentialExposure
        ORDER BY potentialExposure DESC
        `,
        { organizationId, frameworkCode },
      );

      return result.records.map(record => ({
        requirementId: record.get('requirementId'),
        title: record.get('title'),
        unprotectedAssets: record.get('unprotectedAssets'),
        atRiskProcesses: record.get('atRiskProcesses'),
        potentialExposure: record.get('potentialExposure'),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Sync asset from PostgreSQL to Neo4j
   */
  async syncAsset(asset: any): Promise<void> {
    const session = this.getSession();
    
    try {
      await session.run(
        `
        MERGE (a:Asset {id: $asset.id})
        SET a.organization_id = $asset.organizationId,
            a.name = $asset.name,
            a.type = $asset.assetType,
            a.cloud_provider = $asset.cloudProvider,
            a.criticality = $asset.criticality,
            a.data_classification = $asset.dataClassification,
            a.contains_pii = $asset.containsPii,
            a.status = $asset.status,
            a.updated_at = datetime()
        
        WITH a
        MATCH (o:Organization {id: $asset.organizationId})
        MERGE (o)-[:HAS_ASSET]->(a)
        `,
        { asset },
      );
    } finally {
      await session.close();
    }
  }
}
```

### 4. RBAC Guard

```typescript
// src/common/guards/rbac.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true; // No permissions required
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !user.roles) {
      return false;
    }

    // Super admin has all permissions
    if (user.roles.includes('super_admin')) {
      return true;
    }

    // Check if user has any of the required permissions
    const userPermissions = this.getUserPermissions(user.roles);
    
    return requiredPermissions.some(permission =>
      userPermissions.includes(permission),
    );
  }

  private getUserPermissions(roles: string[]): string[] {
    // This would typically be cached or stored in Redis
    const rolePermissions: Record<string, string[]> = {
      org_admin: [
        'assets:*', 'risks:*', 'vendors:*', 'controls:*',
        'users:*', 'reports:*', 'policies:*',
      ],
      security_lead: [
        'assets:read', 'assets:write',
        'risks:*',
        'vendors:read', 'vendors:write',
        'controls:read', 'controls:write',
        'reports:read', 'reports:export',
      ],
      analyst: [
        'assets:read',
        'risks:read', 'risks:write',
        'vendors:read',
        'controls:read',
        'reports:read',
      ],
      auditor: [
        'assets:read',
        'risks:read',
        'vendors:read',
        'controls:read',
        'reports:read', 'reports:export',
      ],
      vendor: [
        'vendors:self:read', 'vendors:self:write',
      ],
    };

    const permissions = new Set<string>();
    
    for (const role of roles) {
      const rolePerms = rolePermissions[role] || [];
      rolePerms.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }
}
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/logout` | User logout |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/mfa/setup` | Setup MFA |
| POST | `/auth/mfa/verify` | Verify MFA code |
| GET | `/auth/saml/login` | SAML SSO login |
| POST | `/auth/saml/callback` | SAML callback |

### Risks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/risks` | List risks with filtering and pagination |
| GET | `/risks/:id` | Get risk details |
| POST | `/risks` | Create new risk |
| PATCH | `/risks/:id` | Update risk |
| DELETE | `/risks/:id` | Delete risk |
| POST | `/risks/:id/recalculate` | Recalculate context score |
| GET | `/risks/:id/impact-analysis` | Get business impact analysis |
| GET | `/risks/summary` | Get risk summary dashboard |

### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets` | List assets |
| GET | `/assets/:id` | Get asset details |
| POST | `/assets` | Create asset |
| PATCH | `/assets/:id` | Update asset |
| DELETE | `/assets/:id` | Delete asset |
| GET | `/assets/:id/relationships` | Get asset relationships |
| GET | `/assets/:id/propagation` | Simulate risk propagation |

### Vendors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vendors` | List vendors |
| GET | `/vendors/:id` | Get vendor details |
| POST | `/vendors` | Create vendor |
| PATCH | `/vendors/:id` | Update vendor |
| GET | `/vendors/:id/assessments` | Get vendor assessments |
| POST | `/vendors/:id/assessments` | Create assessment |
| GET | `/vendors/incidents` | Get all vendor incidents |
| POST | `/vendors/:id/incidents` | Report vendor incident |

### Compliance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/compliance/frameworks` | List frameworks |
| GET | `/compliance/frameworks/:code` | Get framework details |
| GET | `/compliance/frameworks/:code/gaps` | Get compliance gaps |
| GET | `/controls` | List controls |
| GET | `/controls/:id` | Get control details |
| PATCH | `/controls/:id` | Update control |
| POST | `/controls/:id/evidence` | Upload evidence |

## Configuration

```typescript
// .env.example
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sentient_grc

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=32-character-encryption-key

# External Services
AI_SERVICE_URL=http://localhost:8000
SECURITY_SCORECARD_API_KEY=
BITSIGHT_API_KEY=

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

## Testing

```typescript
// test/unit/risk-scoring.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RiskScoringService } from '../../src/modules/risks/risk-scoring.service';
import { GraphService } from '../../src/modules/graph/graph.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('RiskScoringService', () => {
  let service: RiskScoringService;
  let graphService: GraphService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskScoringService,
        {
          provide: GraphService,
          useValue: {
            getAssetBusinessImpact: jest.fn(),
            getVendorBusinessImpact: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            riskItem: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<RiskScoringService>(RiskScoringService);
    graphService = module.get<GraphService>(GraphService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('calculateContextScore', () => {
    it('should calculate high priority for revenue-impacting risks', async () => {
      const mockRisk = {
        id: 'risk-001',
        inherentScore: 70,
        affectedAssetId: 'asset-001',
        affectedVendorId: null,
        affectedAsset: { id: 'asset-001', name: 'payment-api' },
      };

      const mockImpact = {
        affectedProcesses: 3,
        revenueGeneratingProcesses: 2,
        customerFacingProcesses: 1,
        regulatoryRequiredProcesses: 1,
        totalRevenueImpact: 50000,
      };

      jest.spyOn(prismaService.riskItem, 'findUnique').mockResolvedValue(mockRisk as any);
      jest.spyOn(graphService, 'getAssetBusinessImpact').mockResolvedValue(mockImpact);

      const result = await service.calculateContextScore('risk-001');

      expect(result.contextPriorityScore).toBeGreaterThan(80); // Should be high priority
      expect(result.contextPriorityReason).toContain('revenue-generating');
    });

    it('should calculate low priority for non-business-critical risks', async () => {
      const mockRisk = {
        id: 'risk-002',
        inherentScore: 40,
        affectedAssetId: 'asset-002',
        affectedVendorId: null,
        affectedAsset: { id: 'asset-002', name: 'dev-server' },
      };

      const mockImpact = {
        affectedProcesses: 0,
        revenueGeneratingProcesses: 0,
        customerFacingProcesses: 0,
        regulatoryRequiredProcesses: 0,
        totalRevenueImpact: 0,
      };

      jest.spyOn(prismaService.riskItem, 'findUnique').mockResolvedValue(mockRisk as any);
      jest.spyOn(graphService, 'getAssetBusinessImpact').mockResolvedValue(mockImpact);

      const result = await service.calculateContextScore('risk-002');

      expect(result.contextPriorityScore).toBeLessThan(40); // Should be low priority
      expect(result.contextPriorityReason).toContain('Limited business impact');
    });
  });
});
```

## Docker Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  core-service:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/sentient_grc
      - NEO4J_URI=bolt://neo4j:7687
      - REDIS_HOST=redis
    depends_on:
      - db
      - redis
      - neo4j

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: sentient_grc
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  neo4j:
    image: neo4j:5-community
    environment:
      NEO4J_AUTH: neo4j/password
    volumes:
      - neo4j_data:/data

volumes:
  postgres_data:
  redis_data:
  neo4j_data:
```
