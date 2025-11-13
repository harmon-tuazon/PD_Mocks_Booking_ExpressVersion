# CLAUDE.md - System Prompt for PrepDoctors HubSpot Automation Framework

This file provides critical guidance to Claude Code (claude.ai/code) for this project.

# Core Development Philosophy #
KISS (Keep It Simple, Stupid)
Simplicity should be a key goal in design. Choose straightforward solutions over complex ones whenever possible. Simple solutions are easier to understand, maintain, and debug.

YAGNI (You Aren't Gonna Need It)
Avoid building functionality on speculation. Implement features only when they are needed, not when you anticipate they might be useful in the future.

IF IT'S NOT BROKEN, DON'T FIX IT 
Prioritize reusing old components, endpoints, functions, logic, etc. when they are available. Always refer to documentation\MOCKS_BOOKING_README.md, documentation\api, and documentation\frontend to check if there are already existing items we can reuse.

### Framework Core Components:
1. **PRD-Driven Development**: Comprehensive plans ensuring 7-10 confidence scores
2. **Specialized Developer Agents**: Each writes specific code types (NOT runtime functions)
3. **5-Phase Workflow**: Guaranteed progression from idea to production
4. **HubSpot-Centric Architecture**: No databases, HubSpot is the single source of truth
5. **Vercel Driven Hosting**: Assume that hosting is generally using Vercel with a special emphasis on serverless architecture and design
6. **Leveraging MCPs**: MANDATORY - Always use MCPs when applicable:
   - **Serena MCP**: For ALL code generation, refactoring, and IDE assistance
   - **Vercel MCP**: For ALL deployment, serverless config, and environment management
   - **HubSpot MCP**: When available, for CRM operations and schema management

## 🚨 MANDATORY MCP USAGE GUIDELINES

### When to Use Serena MCP (IDE Assistant)
**ALWAYS USE SERENA FOR:**
- Code generation and scaffolding
- Refactoring existing code
- Finding code patterns and examples
- Debugging assistance
- Test generation
- Code review and optimization
- Documentation generation from code

### When to Use Vercel MCP (Deployment)
**ALWAYS USE VERCEL MCP FOR:**
- Creating and managing serverless functions
- Configuring vercel.json
- Setting environment variables
- Deployment to staging/production
- Monitoring function performance
- Managing domains and routing
- Checking deployment logs and metrics

### When to Use HubSpot MCP (When Available)
**USE HUBSPOT MCP FOR:**
- Creating custom objects and properties
- Managing associations between objects
- Bulk data operations
- Schema validation and updates
- Webhook configuration
- API rate limit monitoring

**⚠️ CRITICAL**: Never manually write code that MCPs can generate. Always check if an MCP can handle the task first!

## 🚀 MONOREPO DEPLOYMENT GUIDELINES

### CRITICAL: Complete Monorepo Deployment Protocol

**IMPORTANT**: This is a monorepo with both frontend and backend components. ALWAYS ensure complete deployment of ALL changes.

### Pre-Deployment Checklist (MANDATORY)
```bash
# 1. CRITICAL: Ensure you're in the monorepo ROOT directory (not frontend/)
pwd  # Should show /path/to/mocks_booking (not /path/to/mocks_booking/frontend)

# 2. Stage ALL changes across the entire monorepo
git add .
git status  # Verify all frontend AND backend files are staged

# 3. Clean rebuild from monorepo root
rm -rf frontend/dist frontend/node_modules/.vite
npm run build  # This runs build from ROOT, not frontend/

# 4. Verify build includes all recent changes
ls -la frontend/dist/
ls -la frontend/dist/assets/
ls -la api/  # Verify API files exist

# 5. Check that all new components are in the build
grep -r "SidebarNavigation\|MainLayout\|BookingsCalendar" frontend/dist/assets/ || echo "⚠️ Components missing!"
```

### Deployment Commands (Use These EXACTLY)
```bash
# ⚠️ CRITICAL: Run from MONOREPO ROOT (not frontend/)
pwd  # Verify you're in monorepo root before deploying

# For Production Deployment
vercel --prod

# For Staging Deployment
vercel

# Use --force flag only when necessary:
# - After significant file structure changes
# - When cached builds are causing issues
# - When Vercel seems to miss file updates
vercel --prod --force  # Only when needed

# 🚨 NEVER deploy from frontend/ directory - always from ROOT
# ✅ Standard deployments work well without --force in most cases
```

### Expected Upload Size Indicators
```bash
# ✅ GOOD: Large upload (200MB+) indicates complete monorepo deployment
# ❌ BAD: Small upload (<10MB) indicates only frontend files

# Example of successful deployment:
# Uploading [====================] (226.4MB/226.4MB)  ← FULL MONOREPO
#
# Example of incomplete deployment:
# Uploading [====================] (1.8MB/1.8MB)      ← FRONTEND ONLY
```

### Post-Deployment Verification (MANDATORY)
```bash
# 1. Check deployment includes all components
curl -s [PRODUCTION_URL] | grep -q "SidebarNavigation\|vertical.*nav" || echo "❌ Navigation missing!"

# 2. Verify API endpoints are working
curl -s [PRODUCTION_URL]/api/health || echo "❌ API endpoints missing!"

# 3. Test key functionality
echo "✅ Manual verification required:"
echo "- Login flow works"
echo "- Navigation sidebar appears"
echo "- Booking calendar shows statistics"
echo "- Credit cards display correctly"
```

### Why This Matters
- **Monorepo Structure**: Frontend built from `/frontend/` but served from root
- **Vercel Caching**: May serve cached versions without --force flag
- **Component Dependencies**: New React components need complete rebuild
- **API Integration**: Both frontend AND backend files must deploy together

### Deployment Troubleshooting
If deployment seems incomplete:
1. Run `rm -rf frontend/dist` and rebuild
2. Use `vercel --prod --force --debug` for detailed logs
3. Check Vercel dashboard for build errors
4. Verify vercel.json configuration is correct

**🔥 REMEMBER**: Use `--force` flag only when standard deployment doesn't capture all changes!

## 🔄 The 5-Phase Development Workflow

**THIS IS YOUR PRIMARY WORKFLOW - USE IT FOR EVERY FEATURE:**

### Phase 1: Planning & PRD Generation (2-4 hours)
```bash
# Step 1: Define what you want to build
echo "## FEATURE: [Name]
- Requirement 1
- Requirement 2
- Success criteria" > features/[feature-name].md

# Step 2: Generate comprehensive PRD with agent assignments
generate-prd features/[feature-name].md
# Output: PRDs/[feature-name].md with confidence score 7-10
```

### Phase 2: Parallel Component Development (4-8 hours)
```bash
# Execute PRD - This automatically invokes 3 agents SIMULTANEOUSLY:
execute-prd PRDs/[feature-name].md
```

**Critical Files to Understand:**
- `README.md` - Complete framework overview (MAIN GUIDE)
- `AGENT_DEVELOPER_COORDINATION_RULES.md` - How agents collaborate
-  Can Memories under Serena (.serena\memories)

## Global Development Rules

### Core Development Philosophy

#### KISS (Keep It Simple, Stupid)
Simplicity is paramount in our HubSpot-centric architecture. Choose HubSpot's built-in features over custom solutions. Simple solutions are easier to maintain in a serverless environment.

#### YAGNI (You Aren't Gonna Need It)
Avoid building functionality on speculation. Our payment app has proven that minimal, focused features work best. Implement only what's needed now.

IF IT'S NOT BROKEN, DON'T FIX IT 
Prioritize reusing old components, endpoints, functions, logic, etc. when they are available. Always refer to documentation\MOCKS_BOOKING_README.md, documentation\api, and documentation\frontend to check if there are already existing items we can reuse.

### Design Principles

- **API-First Architecture**: HubSpot and Stripe APIs are our backend - no custom databases
- **Stateless by Design**: Every Vercel function execution is independent
- **Error-First Callbacks**: Always handle errors as the first parameter in callbacks
- **Async by Default**: Use async/await for all API calls to HubSpot and Stripe
- **Fail Fast**: Validate inputs early using Joi schemas
- **Security First**: Never trust user input, always validate with existing validation.js patterns

### Search Command Requirements

**CRITICAL**: Always use `rg` (ripgrep) instead of traditional `grep` and `find` commands:

```bash
# ❌ Don't use grep
grep -r "pattern" .

# ✅ Use rg instead
rg "pattern"

# ❌ Don't use find with name
find . -name "*.js"

# ✅ Use rg with file filtering
rg --files -g "*.js"
```

### HubSpot-Centric Guidelines

1. **HubSpot as Single Source of Truth**
   - Never cache data locally beyond request lifecycle
   - Always query HubSpot for current state
   - Use custom object properties for all status tracking

2. **Deal Timeline for Audit Trail**
   - Log all business events as formatted notes
   - Use consistent icons (✅ ❌ 🔁 📊)
   - Include structured data in note HTML

3. **Property-Based State Management**
   - Use existing properties before creating new ones
   - Batch property updates for efficiency
   - Validate property values match HubSpot enumeratio
1. **Function Timeout Awareness**
   - Maximum 60 seconds per function execution
   - Design for quick response times
   - Use batch operations to stay within limits

2. **Cold Start Optimization**
   - Minimize dependencies
   - Lazy load when possible
   - Keep functions focused and small

3. **Environment Variables**
   - Never hardcode credentials
   - Validate all required vars on startup
   - Use CRON_SECRET for scheduled job auth

### Testing Requirements

- Test HubSpot integration with dry-run modes
- Mock external API calls in unit tests
- Always test with production-like data volumes
- Validate API endpoints and data integrity in tests

### Security Requirements

1. **Token Validation**
   - Always validate access tokens
   - Check CRON_SECRET for automated jobs
   - Verify API signatures and authentication

2. **Input Sanitization**
   - Use existing validation.js patterns
   - Sanitize HTML with xss library
   - Validate all HubSpot object IDs

3. **Rate Limiting**
   - Respect HubSpot API limits (100 requests/10 seconds)
   - Implement exponential backoff for retries
   - Use existing rate limiting middleware

## Authentication Policy

### Authentication-Only Model (No Role-Based Authorization)

The admin system uses a **simplified authentication model** without role-based authorization. This means:

#### Key Principles

✅ **Authentication**: Verifies user identity (logged in via Supabase)
❌ **Authorization**: No role-based permissions or access control levels
✅ **Access Model**: Any authenticated user has full admin access
✅ **Simplicity**: Reduces complexity, easier to maintain

#### Implementation Pattern

**Correct Usage** (Authentication Check Only):
```javascript
// api/admin/mock-exams/list.js
const { requireAdmin } = require('../middleware/requireAdmin');

module.exports = async (req, res) => {
  try {
    // requireAdmin only verifies authentication - no role checking
    const user = await requireAdmin(req);

    // User is authenticated, proceed with admin operation
    const exams = await hubspot.listMockExams();

    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }
};
```

**Legacy Compatibility**:
- `requireAdmin` middleware name kept for backward compatibility
- Internally, it only calls `requireAuth` (no role checking)
- Any authenticated user can access all admin endpoints

#### Security Considerations

**What This Means**:
- Single authentication tier: logged in vs not logged in
- No admin vs regular user distinction at API level
- Access control managed externally (if needed in future)
- Simplified token validation and session management

**When to Use**:
- Internal admin tools with trusted user base
- Applications where all authenticated users should have full access
- Systems where external authorization layer exists (e.g., network ACLs)
- Prototypes and MVPs requiring fast iteration

**Migration Path** (if role-based auth needed in future):
```javascript
// Future enhancement (not currently implemented)
const user = await requireAdmin(req);

// Add role check if needed
if (user.role !== 'admin') {
  throw new Error('Admin role required');
}
```

#### Middleware Architecture

```
Request → requireAdmin() → requireAuth() → Supabase JWT Validation
                              ↓
                    ✅ Valid Token → Allow Access
                    ❌ Invalid Token → 401 Unauthorized
```

**No Role Checking Layer**:
```javascript
// admin_root/api/admin/middleware/requireAdmin.js
async function requireAdmin(req) {
  // Only verifies authentication, not roles
  const user = await requireAuth(req);
  return user;  // No role validation
}
```

#### Best Practices

1. **Always use `requireAdmin` for admin endpoints** (even though it's just auth)
2. **Do not implement custom role checking** unless explicitly required
3. **Trust that authentication = authorization** for this system
4. **Document any future role requirements** before implementation
5. **Keep middleware simple and focused** on authentication only

## 🎯 Framework Project Structure

**This structure applies to ANY automation you build:**

```
[automation-name]/
├── /features/                 # Feature requirements (start here!)
├── /PRDs/                    # Product Requirements Documents (COMMITTED TO GIT)
│   ├── /admin/              # Admin app PRDs (admin_root/)
│   └── /user/               # User app PRDs (user_root/)
├── /planning/                # Development specifications
│   ├── /current/            # Active development
│   └── /archive/            # Completed features
├── /services/               # Core business logic
├── /api/                    # Serverless endpoints
├── /shared/                 # Reusable utilities
├── /tests/                  # Test suites
├── vercel.json              # Deployment configuration
└── checkpoints/             # Development snapshots
```

### PRD Organization Guidelines

**IMPORTANT:** All PRDs MUST be placed in the `/PRDs/` directory and MUST be committed to git.

**Folder Structure:**
```
PRDs/
├── admin/                    # PRDs for admin app features (admin_root/)
│   ├── feature-name.md      # Use kebab-case for file names
│   └── another-feature.md   # Descriptive names for easy identification
└── user/                     # PRDs for user app features (user_root/)
    ├── feature-name.md
    └── another-feature.md
```

**Examples:**
```
PRDs/
├── admin/
│   ├── bulk-selection-toolbar.md
│   ├── attendance-tracking-feature.md
│   ├── batch-booking-cancellation.md
│   ├── mock-exam-deletion.md
│   └── trainee-dashboard.md
└── user/
    ├── booking-race-condition-redis-locking.md
    ├── time-conflict-detection.md
    └── frontend-api-performance-optimization.md
```

**Rules:**
1. **ALWAYS** place PRDs in either `/PRDs/admin/` or `/PRDs/user/` based on which app the feature belongs to
2. **NEVER** place PRDs in ignored directories (features/, documentation/, etc.)
3. Use kebab-case for file names
4. PRDs are version-controlled documentation - they must be in git
5. Only two folders exist: `admin/` and `user/` - no other subfolders

## Essential Commands

### Framework Workflow Commands
```bash
# ALWAYS START WITH THIS
primer                                    # Load context and current state

# USE MCPs FOR DEVELOPMENT (MANDATORY)
serena generate [component]               # Use Serena for code generation
vercel deploy                            # Use Vercel MCP for deployment

# CREATE NEW AUTOMATIONS
generate-prd features/[feature].md   # Generate PRD
execute-prd PRDs/[feature].md        # Execute implementation

# BUILD & TEST
npm run build                            # Install all dependencies
npm test                                 # Run all tests
npm run test:coverage                    # Check coverage (must be >70%)

# DEVELOPMENT
vercel dev                               # Test serverless functions

# DEPLOYMENT
vercel                                   # Deploy to staging
vercel --prod                           # Deploy to production
```

## Architecture Overview

**FRAMEWORK PRINCIPLE**: This architecture applies to ALL automations,

## Documentation References

### Critical Documentation Files
- **documentations/HUBSPOT_SCHEMA_DOCUMENTATION.md**: Complete HubSpot CRM integration reference
- **documentations/HUBSPOT_CURRENT_STATE_ANALYSIS.md**: Current HubSpot configuration
- **documentations/FINAL_IMPLEMENTATION_PLAN.md**: Complete transformation roadmap
- **documentations/IMPLEMENTATION_QUICK_START.md**: Day-by-day implementation guide

**⚠️ IMPORTANT**: Always update documentation when making changes to:
- HubSpot object schemas or properties
- Payment schedule logic or status flows
- API integration patterns
- New features or removed limitations

## Critical Integration Points

### HubSpot CRM
- Private app authentication via `HS_PRIVATE_APP_TOKEN`
- Custom objects (Object Type ID): 
  - Transactions (`2-47045790`)
  - Payment Schedules (`2-47381547`)
  - Credit Notes (`2-41609496`)
  - Contacts (`0-1`)
  - Deals (`0-3`)
  - Courses (`0-410`)
  - Campus Venues (`2-41607847`)
  - Enrollments (`2-41701559`)
  - Lab Stations (`2-41603799`)
  - Bookings (`2-50158943`)
  - Mock Exams (`2-50158913`)

## Input Validation Standards

### Always Use Joi Schemas
```javascript
// Example from shared/validation.js
const paymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  token: Joi.string().uuid().required(),
  scheduleId: Joi.string().pattern(/^\d+$/).required()
});

// Validate before processing
const { error, value } = paymentSchema.validate(req.body);
if (error) {
  return res.status(400).json({ error: error.details[0].message });
}
```

## Error Handling Patterns

### Operational vs Programming Errors
```javascript
// Operational error - expected, handle gracefully
if (!customer.invoice_settings?.default_payment_method) {
  await loggingService.logChargeEvent(dealId, 'failed', {
    error: 'No payment method on file',
    action: 'Manual intervention required'
  });
  return;
}

// Programming error - unexpected, log and alert
catch (error) {
  console.error('Unexpected error in charge processing:', error);
  // Don't expose internal errors to users
  res.status(500).json({ error: 'An error occurred processing your request' });
}
```

## Performance Guidelines

### Batch Operations
```javascript
// ✅ Good - Batch API calls
const batchUpdate = schedules.map(schedule => ({
  id: schedule.id,
  properties: { status: 'processed' }
}));
await hubspot.crm.objects.batchApi.update(objectType, { inputs: batchUpdate });

// ❌ Bad - Individual API calls in loop
for (const schedule of schedules) {
  await hubspot.crm.objects.basicApi.update(objectType, schedule.id, {...});
}
```

### Respect API Limits
```javascript
// Implement exponential backoff
async function hubspotApiCall(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 429 && i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      } else {
        throw error;
      }
    }
  }
}
```

## Testing Strategy

### Test Categories
1. **Unit Tests** (`/tests/unit/`)
   - Isolated function testing
   - Mock all external dependencies
   - Focus on business logic

2. **Integration Tests** (`/tests/integration/`)
   - Test API endpoints
   - Use test HubSpot sandbox
   - Validate webhook processing

3. **Manual Testing Scripts** (`/tests/manual/`)
   - `test-hubspot.js` - Verify HubSpot connection
   - `test-charge.js` - Dry run charge processing
   - `test-single.js` - Process specific schedule

### Coverage Requirements
- Minimum 70% coverage for critical paths
- 100% coverage for payment processing logic
- All error paths must have tests

## Deployment Checklist

### Before Deployment
- [ ] All tests passing
- [ ] Environment variables configured in Vercel
- [ ] HubSpot properties created/extended
- [ ] Dry run successful on test data
- [ ] Team briefed on changes

### After Deployment
- [ ] Health check endpoint responding
- [ ] Monitor first cron execution
- [ ] Check deal timelines for logs
- [ ] Verify transaction creation
- [ ] Review error logs

## Common Pitfalls to Avoid

1. **Creating duplicate HubSpot properties** - Always check existing first
2. **Forgetting record associations** - Critical for data integrity
3. **Not handling rate limits** - Implement exponential backoff
4. **Exposing internal errors** - Sanitize error messages for users
5. **Blocking operations** - Everything must be async
6. **Missing CRON_SECRET** - Always authenticate scheduled jobs
7. **Not using dry-run mode** - Test before processing real data
8. **React Component Structure Issues** - Ensure proper JSX syntax and component closure
   - Never have return statements outside the main component function
   - Remove duplicate code sections that create structural conflicts
   - Ensure single export statement at component end

## Maintenance Notes

### When Making Changes
1. **Before modifying code**: Review relevant documentation
2. **After implementing changes**: Update documentation
3. **Version tracking**: Update version in package.json
4. **Breaking changes**: Notify team and update migration guide

### Documentation Update Checklist
- [ ] Updated property schemas if HubSpot objects changed
- [ ] Updated API endpoint documentation if routes changed
- [ ] Updated workflow diagrams if business logic changed
- [ ] Updated code examples to reflect current implementation
- [ ] Added troubleshooting entries for new known issues

## 🚀 Building ANY  Automation

### The Framework Can Build ANYTHING
This framework has already proven it can reduce development time by **85%** (from 6-8 weeks to 5 days). Use it to build:


### Success Metrics from Real Implementation
```yaml
HubSpot_Automation_System:
  Traditional_Approach: 6-8 weeks
  Framework_Approach: 5 days
  Time_Saved: 85%
  Test_Coverage: 70%
  Bugs_Reduced: 90%
  Documentation: 100% complete
```

## 🎯 Critical Framework Rules

### MANDATORY Workflow Steps
1. **ALWAYS run `primer` first** - No exceptions, this loads your context
2. **ALWAYS generate PRD before coding** - Ensures 7-10 confidence score
3. **ALWAYS use execute-nodejs-hubspot-prp** - Let agents write the code
4. **ALWAYS maintain checkpoints** - Update DEVELOPMENT_CHECKPOINT.md daily
5. **ALWAYS achieve >70% test coverage** - Framework enforces this

### Framework Best Practices
- **Trust the Process**: The 5-phase workflow guarantees success
- **Trust the Agents**: Each is expert in their domain
- **Use HubSpot Properties**: Never create local databases
- **Implement Idempotency**: Every operation must be retryable
- **Log to Deal Timelines**: Complete audit trail with icons

### Development Rules
- **MCP FIRST**: Always check if Serena or Vercel MCP can handle the task before manual coding
- **FRAMEWORK FIRST**: Always use the framework workflow, don't code manually
- **PRD REQUIRED**: Never skip PRD generation - it ensures one-pass success
- **START WITH PRIMER**: Begin EVERY session with the primer command
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files unless explicitly requested
- ALWAYS keep existing documentation in sync with code changes
- ALWAYS use rg instead of grep or find commands
- NEVER use synchronous I/O operations
- ALWAYS validate inputs with Joi schemas
- NEVER store secrets in code
- ALWAYS use HubSpot as the single source of truth

## Agent Development Team

Our specialized agents are DEVELOPERS who write code for ANY PrepDoctors automation:

### Agent Roles - CODE WRITERS, NOT EXECUTORS

Each agent is a specialized developer who WRITES code, not performs functions:

### Agent Communication = Code Handoffs

When agents communicate, they're handing off code tasks:
- "I wrote the API endpoint, you need to write the tests"
- "I wrote the HubSpot query, you need to write error handling"
- "I wrote the payment logic, you need to write the security validation"

### Code Review Protocol

Each agent reviews code in their domain:
1. Security agent reviews ALL new endpoints
2. Test agent ensures > 70% coverage
3. HubSpot agent reviews all CRM integrations
4. Serverless-infra-engineer reviews vercel configuration

### Simple Agent Developer Rules

1. **One Developer Per File** - Each file has a primary developer owner
2. **Code Reviews Required** - Domain experts review their areas
3. **Explicit Handoffs** - "I wrote X, you write Y"
4. **Test Everything** - test-validation-specialist writes tests for all code

```

### Developer Task Assignment Example

When implementing a new feature:
1. **data-flow-architect** writes the state flow design
2. **hubspot-crm-specialist** writes HubSpot integration code
3. **stripe-integration-specialist** writes payment processing code
4. **error-recovery-specialist** writes retry and error handling
5. **security-compliance-auditor** writes validation schemas
6. **test-validation-specialist** writes all tests
7. **serverless-infra-engineer** writes deployment config

Remember: Agents write code, they don't run the application!

---

---

## 🔥 THE BOTTOM LINE

**This framework transforms 6-8 week projects into 5-day implementations.**

When you start ANY new PrepDoctors automation:
1. Run `primer` to load context
2. Create your feature in `features/`
3. Run `generate-prp`
4. Run `execute--prp`
5. Deploy with `vercel --prod`

## 📡 MCP Server Configuration & Usage

### MANDATORY MCP Installation
Always install and use these MCP servers:

**Serena MCP (IDE Assistant)**
```bash
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)
```
**Usage**: ALWAYS for code generation, refactoring, testing, debugging

**Vercel MCP (Deployment)**
```bash
claude mcp add --transport http vercel https://mcp.vercel.com/
```
**Usage**: ALWAYS for serverless config, deployment, environment variables

**HubSpot MCP (When Available)**
```bash
# Installation command will be added when available
```
**Usage**: For all HubSpot CRM operations when available

### MCP Usage Priority
1. **FIRST**: Check if task can be done with MCP
2. **SECOND**: Use framework agents if MCP cannot handle
3. **LAST**: Manual implementation only if absolutely necessary  

**That's it. The framework handles everything else.**

Welcome to the future of PrepDoctors automation development.

---

_This is the PrepDoctors HubSpot Automation Development Framework - Building ANY automation, 10x faster._
_Framework Version: 1.0.0_
_Last updated: September 7, 2025_
_Created By Dr. Faris Marei