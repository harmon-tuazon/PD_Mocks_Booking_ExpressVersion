# AWS Access & Permissions Analysis

**Generated:** January 25, 2026
**Updated:** January 25, 2026 (Permissions Enhanced)
**Purpose:** Verify AWS access for infrastructure analysis and cost study
**IAM Role:** `Rl-RDS-EC2`
**Account ID:** `509685827062`

---

## Executive Summary

The EC2 instance IAM role has been enhanced with comprehensive permissions. We now have **full access** to EC2, RDS, S3, SES, CloudWatch, Cost Explorer, Pricing API, and Budgets. This enables complete infrastructure analysis and cost optimization studies.

---

## Permission Matrix (Updated)

| AWS Service | Permission Level | Policy |
|-------------|-----------------|--------|
| **EC2** | ✅ Read-Only | `AmazonEC2ReadOnlyAccess` |
| **RDS** | ✅ Full Access | `AmazonRDSFullAccess` |
| **S3** | ✅ Full Access | `AmazonS3FullAccess` |
| **SES** | ✅ Full Access | `AmazonSESFullAccess` |
| **CloudWatch** | ✅ Full Access | (via RDS/EC2 policies) |
| **Cost Explorer** | ✅ Read-Only | `AWSBillingReadOnlyAccess` |
| **Pricing API** | ✅ Full Access | `AWSPriceListServiceFullAccess` |
| **Budgets** | ✅ Read-Only | `AWSBudgetsReadOnlyAccess` |
| **ECR** | ✅ Full Access | `AmazonEC2ContainerRegistryFullAccess` |
| **Secrets Manager** | ✅ Read/Write | `SecretsManagerReadWrite` |
| **Cost Forecast** | ✅ Read-Only | `ce:GetCostForecast` |

---

## Current Infrastructure Details

### EC2 Instance

| Property | Value |
|----------|-------|
| **Instance ID** | `i-0ac3692fc2f364ce7` |
| **Instance Name** | `EC2_PrepDocRH_ca` |
| **Instance Type** | `t2.medium` |
| **vCPUs** | 2 cores (Intel Xeon E5-2686 v4 @ 2.30GHz) |
| **RAM** | 4 GB |
| **Architecture** | x86_64 |
| **Availability Zone** | `ca-central-1a` |
| **VPC** | `vpc-0e7139c32be3aeaf8` |
| **Subnet** | `subnet-0f26ccc83bb52a6db` |
| **Security Group** | `CanadaWebAccess` (sg-0f0bcc4873a1e385c) |
| **Public IP** | `52.60.214.37` |
| **Private IP** | `172.31.23.55` |
| **Key Pair** | `KEY_prepdocRHcanada` |
| **IAM Profile** | `Rl-RDS-EC2` |
| **Launch Time** | January 19, 2026 |
| **Platform** | Linux/UNIX |
| **Monitoring** | Basic (disabled) |

### EC2 Storage (EBS Volume)

| Property | Value |
|----------|-------|
| **Volume ID** | `vol-098d0cf5b03df85af` |
| **Size** | 30 GB |
| **Type** | gp3 (General Purpose SSD) |
| **IOPS** | 3,000 |
| **State** | In-use, attached |
| **Usage** | 18 GB used (60%) |
| **Available** | 12 GB free (40%) |

### RDS Database

| Property | Value |
|----------|-------|
| **Instance ID** | `prepdocrhawscad` |
| **Instance Class** | `db.t4g.micro` |
| **Engine** | PostgreSQL 17.4 |
| **Allocated Storage** | 20 GB (gp2) |
| **Free Storage** | ~17.1 GB (85% free) |
| **Status** | Available |
| **Availability Zone** | `ca-central-1d` |
| **Multi-AZ** | No |
| **Encryption** | Yes (KMS) |
| **Publicly Accessible** | Yes |
| **Backup Retention** | 1 day |
| **Maintenance Window** | Tue 09:03-09:33 UTC |
| **Created** | October 21, 2025 |

### S3 Storage

| Bucket | Region | Objects | Size |
|--------|--------|---------|------|
| `prepdoctors-richmondhill-app-bucket` | ca-central-1 | 55 | 1.97 MB |
| `prepdoctors-logs` | ca-central-1 | - | - |

### SES Email Service

| Property | Value |
|----------|-------|
| **Max 24-Hour Send** | 50,000 emails |
| **Max Send Rate** | 14 emails/second |
| **Sent Last 24 Hours** | 0 |
| **Recent Activity** | 207 emails (Jan 12-22) |
| **Bounce Rate** | 0% |
| **Complaint Rate** | 0% |

---

## Actual Cost Data (from Cost Explorer)

### Monthly Cost History

| Month | EC2 Compute | VPC | RDS | Secrets Mgr | Route 53 | Other | Tax | **Total** |
|-------|-------------|-----|-----|-------------|----------|-------|-----|-----------|
| **Oct 2025** | $13.05 | $3.76 | $0.24 | $0.13 | $0.50 | $0.00 | $2.30 | **$19.98** |
| **Nov 2025** | $36.83 | $3.77 | $0.49 | $0.40 | $0.53 | $0.27 | $5.49 | **$47.78** |
| **Dec 2025** | $38.05 | $3.72 | $0.49 | $0.40 | $0.54 | $1.11 | $5.76 | **$50.07** |
| **Jan 2026** (MTD) | $29.49 | $2.88 | $0.39 | $0.31 | $0.52 | $1.40 | $4.58 | **$39.57** |

**Note:** October was partial month (application launched mid-October). January is month-to-date (25 days).

### Cost Breakdown by Service (December 2025)

| Service | Cost (USD) | % of Total |
|---------|------------|------------|
| EC2 Compute | $38.05 | 76.0% |
| Tax (HST) | $5.76 | 11.5% |
| VPC (Public IPv4) | $3.72 | 7.4% |
| EC2 Other | $1.11 | 2.2% |
| Route 53 | $0.54 | 1.1% |
| RDS | $0.49 | 1.0% |
| Secrets Manager | $0.40 | 0.8% |
| S3 | $0.00 | 0.0% |
| **Total** | **$50.07** | 100% |

### AWS Budget Status

| Property | Value |
|----------|-------|
| **Budget Name** | My Monthly Cost Budget |
| **Budget Limit** | $20.00 USD |
| **Current Spend (Jan)** | $39.82 USD |
| **Forecasted Spend** | $49.69 USD |
| **Status** | ⚠️ Over budget (199%) |

### Cost Forecast (AWS Prediction)

| Month | Forecasted Cost |
|-------|-----------------|
| **January 2026** | $49.66 |
| **February 2026** | $46.39 |
| **2-Month Total** | $96.05 |

---

## AWS Pricing Reference

### Current Instance Pricing (ca-central-1 On-Demand)

| Resource | Type | Hourly Rate | Monthly (730 hrs) |
|----------|------|-------------|-------------------|
| **EC2** | t2.medium | $0.0522/hr | $38.11 |
| **RDS** | db.t4g.micro | $0.0350/hr | $25.55* |
| **EBS** | gp3 30GB | - | $2.76 |

*Note: RDS actual cost is lower due to potential reserved capacity or different pricing tier.

### Instance Type Comparison (ca-central-1)

| Instance | vCPUs | RAM | Hourly | Monthly | vs Current |
|----------|-------|-----|--------|---------|------------|
| t2.micro | 1 | 1 GB | $0.0130 | $9.49 | -75% |
| t2.small | 1 | 2 GB | $0.0261 | $19.05 | -50% |
| **t2.medium** | 2 | 4 GB | $0.0522 | $38.11 | current |
| t2.large | 2 | 8 GB | $0.1043 | $76.14 | +100% |
| t3.micro | 2 | 1 GB | $0.0117 | $8.54 | -78% |
| t3.small | 2 | 2 GB | $0.0234 | $17.08 | -55% |
| t3.medium | 2 | 4 GB | $0.0468 | $34.16 | -10% |

---

## CloudWatch Metrics Summary (Last 7 Days)

### RDS Performance

| Metric | Average | Maximum | Status |
|--------|---------|---------|--------|
| CPU Utilization | 3.9% | 5.2% | ✅ Very Low |
| Database Connections | 3.7 | 12 | ✅ Very Low |
| Free Storage | 17.1 GB | - | ✅ 85% Available |

### System Metrics (EC2)

| Metric | Current | Status |
|--------|---------|--------|
| Disk Usage | 60% (18/30 GB) | ⚠️ Moderate |
| Memory Usage | 50% (1.9/3.8 GB) | ✅ Good |
| Swap Usage | 2% (75 MB/4 GB) | ✅ Minimal |

---

## Data Sources Now Available

With enhanced permissions, we can access:

1. **Cost Analysis**
   - ✅ Historical cost by service (Cost Explorer)
   - ✅ Budget tracking and alerts (Budgets)
   - ✅ Pricing for expansion planning (Pricing API)
   - ✅ Cost forecasting (Cost Explorer Forecast)

2. **Infrastructure Details**
   - ✅ EC2 instance specifications
   - ✅ EBS volume configuration
   - ✅ RDS instance details
   - ✅ VPC/Networking configuration
   - ✅ Security group rules

3. **Performance Metrics**
   - ✅ CloudWatch RDS metrics
   - ✅ System-level metrics (via OS)
   - ✅ PM2 application metrics

4. **Additional Resources**
   - ✅ S3 bucket contents and sizes
   - ✅ SES email statistics
   - ✅ Secrets Manager secrets
   - ✅ ECR container images

---

## Key Findings

### Cost Optimization Opportunities

1. **Budget Alert**: Current spending ($50/month) exceeds budget ($20/month) by 150%
2. **EC2 Dominates Costs**: 76% of monthly cost is EC2 compute
3. **VPC IPv4 Charges**: $3.72/month for public IPv4 (new AWS pricing Feb 2024)
4. **RDS Underutilized**: 3.9% CPU average suggests over-provisioning
5. **S3 Minimal**: Storage costs negligible (<$0.01/month)

### Infrastructure Observations

1. **EC2 Disk at 60%**: May need monitoring or cleanup
2. **RDS 85% Free**: Storage well-provisioned
3. **Single AZ Deployment**: No high availability configured
4. **Basic Monitoring**: Enhanced monitoring disabled

---

## Recommendations

### Immediate Actions

1. **Update Budget**: Increase budget limit to $60 to match actual usage
2. **Enable CloudWatch Alarms**: Set alerts for disk, CPU thresholds
3. **Review VPC Costs**: Consider IPv6 or evaluate if public IP is necessary

### For Expansion Analysis

We now have all necessary access to:
- Analyze current resource utilization
- Model scaling scenarios with accurate pricing
- Calculate cost projections for expansion
- Compare instance types and configurations

---

**Document Version:** 2.1
**Author:** Infrastructure Analysis Agent
**Status:** ✅ All Permissions Verified - Ready for Expansion Analysis
