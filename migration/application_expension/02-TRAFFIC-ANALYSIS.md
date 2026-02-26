# Application Traffic Analysis

**Generated:** January 25, 2026
**Data Period:** January 16-25, 2026 (10 days of NGINX logs)
**Purpose:** Analyze application usage patterns for expansion planning

---

## Executive Summary

The application serves **175 registered users** with an average of **~147 unique visitors per day**. Traffic is well within infrastructure limits during normal operation. However, **CPU reached 100%** during deployment/build operations (not user traffic), indicating a potential bottleneck for scaling. The RDS database is significantly under-utilized at **16% of connection capacity**.

---

## 1. User Base Analysis

### Registered Users (Database)

| User Type | Count |
|-----------|-------|
| Trainees | 156 |
| Administrators | 13 |
| Instructors | 6 |
| **Total Registered** | **175** |

### Active Users (From NGINX Logs)

| Metric | Value |
|--------|-------|
| **Total Unique IPs (10 days)** | 205 |
| **Average Unique IPs/Day** | 147 |
| **Peak Unique IPs (Single Day)** | 164 (Jan 21) |
| **Unique IPs Today** | 87 |

### Daily Traffic Breakdown

| Date | Requests | Unique IPs | Avg Req/IP |
|------|----------|------------|------------|
| Jan 16 | 1,053 | 135 | 8 |
| Jan 17 | 5,680 | 161 | 35 |
| Jan 18 | 17,503 | 137 | 128 |
| Jan 19 | 946 | 138 | 7 |
| Jan 20 | 6,445 | 155 | 42 |
| Jan 21 | 21,817 | 164 | 133 |
| Jan 22 | 20,918 | 128 | 163 |
| Jan 23 | 13,851 | 151 | 92 |
| Jan 24 | 19,850 | 156 | 127 |
| Jan 25 | 18,740 | 131 | 143 |
| **Total** | **126,803** | **205 unique** | **~95 avg** |

---

## 2. Concurrent Users Analysis

### Peak Concurrent Access

| Metric | Value | When |
|--------|-------|------|
| **Peak Requests/Second** | 640 | Jan 25, 14:22:50 |
| **Peak Requests/Minute** | 2,905 | Jan 25, 14:22 |
| **Peak Requests/Hour** | ~3,000 | Jan 25, 14:00-15:00 |
| **Unique IPs During Peak Second** | 3 | Jan 25, 14:22:50 |
| **Unique IPs During Peak Minute** | ~5 | Jan 25, 14:22 |

### Observation
The peak of 640 requests/second from only 3 unique IPs suggests this was likely:
- Automated testing or health checks
- A single user rapidly navigating/refreshing
- Bot or crawler activity

**True concurrent human users** appear to be much lower, typically **5-15 simultaneous users** based on IP analysis during busy periods.

---

## 3. API Call Analysis

### Total Requests by Type

| Request Type | Count | Percentage |
|--------------|-------|------------|
| **Total Requests (10 days)** | 126,803 | 100% |
| **API Calls (/api/)** | 30,683 | 24.2% |
| **Static Assets** | ~96,120 | 75.8% |

### API Calls Per Hour (Peak Hours)

| Timestamp | API Calls/Hour |
|-----------|----------------|
| Jan 25, 14:00 | 112 |
| Jan 24, 18:00 | 53 |
| Jan 24, 17:00 | 47 |
| Jan 25, 00:00 | 44 |
| Jan 24, 18:00 | 44 |

### HTTP Response Codes

| Status | Count | Percentage | Meaning |
|--------|-------|------------|---------|
| 304 | 30,282 | 86.0% | Not Modified (cached) |
| 404 | 3,585 | 10.2% | Not Found |
| 200 | 664 | 1.9% | OK |
| 500 | 287 | 0.8% | Server Error |
| 403 | 246 | 0.7% | Forbidden |
| Other | ~300 | 0.4% | Various |

---

## 4. Infrastructure Limits

### EC2 t2.medium Specifications

| Resource | Limit | Current Peak | Utilization |
|----------|-------|--------------|-------------|
| **vCPUs** | 2 | 2 (100%) | ⚠️ Hit during builds |
| **Memory** | 4 GB | 1.9 GB | 50% |
| **Network** | ~300 Mbps | ~50 Mbps est. | ~17% |
| **CPU Credits** | 576 max | 62 min observed | Never depleted |
| **Disk** | 30 GB | 18 GB | 60% |

### RDS db.t4g.micro Specifications

| Resource | Limit | Current Peak | Utilization |
|----------|-------|--------------|-------------|
| **Max Connections** | ~85 | 14 | **16%** |
| **vCPUs** | 2 | 5% avg | 3% |
| **Memory** | 1 GB | - | Low |
| **Storage** | 20 GB | 2.9 GB | 15% |
| **IOPS** | 3,000 | Low | Minimal |

### Theoretical Capacity Estimates

Based on current infrastructure:

| Metric | Current | Estimated Max | Headroom |
|--------|---------|---------------|----------|
| **Concurrent Users** | ~15 | ~50-75 | 3-5x |
| **Daily Unique Users** | 164 | ~500 | 3x |
| **Requests/Second** | 640 peak | ~1,000 sustained | 1.5x |
| **DB Connections** | 14 | 85 | 6x |
| **API Calls/Hour** | 112 | ~500 | 4.5x |

---

## 5. Limitation Events

### CPU at 100% (Critical Events)

| Timestamp | Duration | Cause |
|-----------|----------|-------|
| Jan 4, 18:00 | ~1 hour | Deployment/Build |
| Jan 6, 14:00 | ~1 hour | Deployment/Build |
| Jan 19, 04:00 | ~1 hour | Instance restart/Build |
| Jan 24, 16:00-19:00 | ~3 hours | Heavy activity |

**Note:** CPU spikes to 100% correlate with deployment activities (`npm run build`), not user traffic. The Next.js build process is CPU-intensive.

### 500 Server Errors

| Total 500 Errors | 294 (0.8% of requests) |
|------------------|------------------------|
| **Peak Error Rate** | 33 errors in 1 minute (Jan 24, 16:22) |
| **Primary Cause** | Frontend unavailable during deployment |

### Error Analysis (Jan 24, 16:22)
```
76.70.20.183 - GET /login HTTP/1.1" 500 - During frontend restart
```
All 33 errors were from the same IP hitting `/login` during a brief service interruption.

### CPU Credits

| Metric | Value |
|--------|-------|
| Minimum Credits Observed | 62 (Jan 18, 16:00) |
| Maximum Possible | 576 |
| **Credits Depleted?** | ❌ No - Never ran out |

---

## 6. Top Traffic Sources

### Top 10 IPs by Request Count (Today)

| Rank | IP Address | Requests | % of Total |
|------|------------|----------|------------|
| 1 | 76.70.20.183 | 12,615 | 67.3% |
| 2 | 84.247.170.185 | 2,842 | 15.2% |
| 3 | 192.159.178.59 | 341 | 1.8% |
| 4 | 192.53.122.11 | 261 | 1.4% |
| 5 | 104.28.242.246 | 78 | 0.4% |
| 6 | 104.28.227.231 | 78 | 0.4% |
| 7 | 104.28.195.231 | 78 | 0.4% |
| 8 | 195.178.110.195 | 73 | 0.4% |
| 9 | 82.165.66.87 | 46 | 0.2% |
| 10 | 141.98.10.53 | 24 | 0.1% |

**Observation:** Traffic is highly concentrated - top 2 IPs account for 82.5% of requests. This is likely admin/power users or the development team.

---

## 7. Key Findings

### Strengths
1. **Database has significant headroom** - Only 16% of connection capacity used
2. **Memory is adequate** - 50% utilization with room to grow
3. **CPU credits never depleted** - Burst capacity available
4. **Low error rate** - 0.8% 500 errors, mostly during deployments

### Bottlenecks Identified
1. **CPU during builds** - 100% utilization during deployments
2. **Single point of failure** - No redundancy (single AZ)
3. **Disk at 60%** - Needs monitoring for log/build artifact growth

### Scaling Recommendations

| If User Growth | Recommended Action |
|----------------|-------------------|
| **2x users (350)** | Current infrastructure sufficient |
| **3x users (525)** | Consider t3.medium (better CPU) |
| **5x users (875)** | Add load balancer, consider t3.large |
| **10x users (1750)** | Multi-AZ RDS, auto-scaling group |

---

## 8. Missing Permissions

The following additional permission would enhance future analysis:

| Permission | Purpose |
|------------|---------|
| `logs:DescribeLogGroups` | Access CloudWatch Logs for application-level metrics |
| `logs:GetLogEvents` | Query application logs for error patterns |

---

## Appendix: Data Sources

| Source | Access | Data Gathered |
|--------|--------|---------------|
| NGINX Access Logs | ✅ sudo | Request counts, IPs, status codes |
| CloudWatch EC2 | ✅ API | CPU, Network, Credits |
| CloudWatch RDS | ✅ API | Connections, CPU, Storage |
| PostgreSQL DB | ✅ API | User counts |
| CloudWatch Logs | ❌ Denied | Application logs not accessible |

---

**Document Version:** 1.0
**Author:** Infrastructure Analysis Agent
