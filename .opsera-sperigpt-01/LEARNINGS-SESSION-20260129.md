# Code-to-Cloud v0.6 Session Learnings
## Session: sperigpt-01 Automatic Promotion Chain Implementation
### Date: 2026-01-29 | Duration: ~45 minutes

---

## Executive Summary

This session implemented automatic promotion chaining (DEV → QA → Staging) for the sperigpt-01 application. Several critical issues were discovered and fixed, leading to **5 new learnings** and **2 new rules** for the Code-to-Cloud skill.

---

## Timeline

| Time (UTC) | Event | Duration | Status |
|------------|-------|----------|--------|
| 12:55:55 | Push: World Clock feature | - | Triggered |
| 12:55:55 | DEV deployment started | 1m54s | ✅ Success |
| 12:57:40 | QA auto-promotion triggered | 28s | ⚠️ Jobs Skipped |
| 13:00:31 | QA retry (wrong image tag) | 6m35s | ⚠️ ImagePullBackOff |
| 13:05:00 | Workflow fix committed | - | ✅ Pushed |
| 13:08:50 | QA retry (correct image tag) | 6m31s | ✅ Success |
| 13:15:21 | QA deployment complete | - | ⚠️ Staging not triggered |

---

## Issues Discovered & Fixes Applied

### ISSUE 1: Jobs Skipped When Builds Skipped
**Severity:** Critical
**Impact:** Broke entire promotion chain

**Symptom:**
```
JOBS
✓ 🔍 Verify Bootstrap
✓ 📝 Update Manifests (qa)
- 🔨 Build Backend (skipped)
- 🔨 Build Frontend (skipped)
- 🔄 Deploy to qa (SKIPPED!)  ← Should have run
```

**Root Cause:**
When `image_tag` input is provided, build jobs are skipped via `if: inputs.image_tag == ''`. However, downstream jobs without `if: always()` are automatically skipped when upstream jobs are skipped.

**Fix Applied:**
```yaml
# BEFORE (broken)
sync-and-wait:
  needs: [verify-bootstrap, update-manifests]
  # No if condition - gets skipped when builds skipped

# AFTER (fixed)
sync-and-wait:
  needs: [verify-bootstrap, update-manifests]
  if: always() && needs.update-manifests.result == 'success'
```

**NEW RULE 42:** Always add `if: always() && needs.<job>.result == 'success'` to jobs that should run regardless of skipped upstream jobs.

---

### ISSUE 2: Image Tag Mismatch on Manual Promotion
**Severity:** High
**Impact:** Canary pods stuck in ImagePullBackOff

**Symptom:**
```
backend-rollout-64f64f6856-zvkfz    0/1     ImagePullBackOff
```

**Root Cause:**
When manually triggering promotion, the wrong image tag was used:
- Used: `ea11a24-20260129125555`
- Actual in ECR: `ea11a24-20260129125607`

The timestamp portion differs because image tags are generated at build time with `$(date +%Y%m%d%H%M%S)`.

**Fix Applied:**
Always verify image exists in ECR before triggering promotion:
```bash
# Verify image tag exists
aws ecr describe-images --repository-name sperigpt-01-backend \
  --query 'imageDetails[*].imageTags' --output text
```

**NEW LEARNING 446:** When manually triggering promotion with `image_tag`, always verify the exact tag exists in ECR first. Use `aws ecr describe-images` to list available tags.

---

### ISSUE 3: Canary Timeout Prevents Auto-Promotion
**Severity:** Medium
**Impact:** Staging promotion not triggered

**Symptom:**
```
📋 Pipeline Summary
  DEPLOY_SUCCESS: false

- 🚀 Promote to staging (skipped)
```

**Root Cause:**
The `sync-and-wait` job has a 5-minute (300s) timeout for pod readiness. But QA uses **Canary deployment** with steps:
- Step 1: 10% traffic → pause
- Step 2: 30% traffic → pause
- Step 3: 60% traffic → pause
- Step 4: 100% traffic → complete

The canary rollout takes longer than 5 minutes, so the job times out and sets `deploy_success=false`.

**Fix Required:**
```yaml
# Increase timeout for canary environments
- name: Wait for Deployment
  env:
    ENVIRONMENT: ${{ needs.verify-bootstrap.outputs.environment }}
  run: |
    # Canary takes longer - use 10 minute timeout for QA/Staging
    if [ "$ENVIRONMENT" = "qa" ] || [ "$ENVIRONMENT" = "staging" ]; then
      TIMEOUT=600  # 10 minutes for progressive delivery
    else
      TIMEOUT=300  # 5 minutes for direct deployment
    fi
```

**NEW RULE 43:** Use environment-aware timeouts. DEV (direct deploy) = 5 min, QA/Staging (canary/blue-green) = 10 min.

---

### ISSUE 4: Git Push Rejected During Workflow
**Severity:** Low
**Impact:** Manual retry needed

**Symptom:**
```
! [rejected] main -> main (fetch first)
error: failed to push some refs
```

**Root Cause:**
The CI workflow updates manifests and pushes to main. When running locally at the same time, conflicts occur.

**Fix Applied:**
Always pull before push:
```bash
git pull --rebase origin main && git push origin main
```

**NEW LEARNING 447:** Always use `git pull --rebase` before pushing when CI workflows may have modified the same branch.

---

## Embedded Templates

### Template: Auto-Promotion Chain Workflow

```yaml
# ════════════════════════════════════════════════════════════════════════════
# AUTO-PROMOTION CHAIN WORKFLOW TEMPLATE
# Pattern: DEV → QA (Canary) → Staging (Blue-Green)
# ════════════════════════════════════════════════════════════════════════════

name: "🔨 ${APP_NAME}: CI Build & Push"

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
      - 'backend/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        type: choice
        options: [dev, qa, staging]
        default: 'dev'
      auto_promote:
        description: 'Auto-promote to next environment'
        type: boolean
        default: true
      image_tag:
        description: 'Use existing image (skip build)'
        type: string

jobs:
  verify-bootstrap:
    outputs:
      environment: ${{ steps.env.outputs.environment }}
      next_environment: ${{ steps.env.outputs.next_environment }}
      auto_promote: ${{ steps.env.outputs.auto_promote }}
      image_tag: ${{ steps.tag.outputs.image_tag }}
    steps:
      - name: Determine Environment Chain
        id: env
        run: |
          if [ "${{ github.event_name }}" = "push" ]; then
            ENVIRONMENT="dev"
            AUTO_PROMOTE="true"
          else
            ENVIRONMENT="${{ inputs.environment }}"
            AUTO_PROMOTE="${{ inputs.auto_promote }}"
          fi

          # Chain: dev → qa → staging → (end)
          case "$ENVIRONMENT" in
            dev) NEXT_ENV="qa" ;;
            qa) NEXT_ENV="staging" ;;
            staging) NEXT_ENV="" ;;
          esac

          echo "environment=${ENVIRONMENT}" >> $GITHUB_OUTPUT
          echo "next_environment=${NEXT_ENV}" >> $GITHUB_OUTPUT
          echo "auto_promote=${AUTO_PROMOTE}" >> $GITHUB_OUTPUT

  build-frontend:
    needs: [verify-bootstrap]
    if: inputs.image_tag == ''  # Skip if reusing image
    # ... build steps ...

  build-backend:
    needs: [verify-bootstrap]
    if: inputs.image_tag == ''  # Skip if reusing image
    # ... build steps ...

  update-manifests:
    needs: [verify-bootstrap, build-frontend, build-backend]
    # RULE 42: Use always() to run even when builds skipped
    if: |
      always() &&
      needs.verify-bootstrap.result == 'success' &&
      (needs.build-frontend.result == 'success' || needs.build-frontend.result == 'skipped') &&
      (needs.build-backend.result == 'success' || needs.build-backend.result == 'skipped')
    # ... manifest update steps ...

  sync-and-wait:
    needs: [verify-bootstrap, update-manifests]
    # RULE 42: Must have always() when upstream jobs may be skipped
    if: always() && needs.update-manifests.result == 'success'
    outputs:
      deploy_success: ${{ steps.wait.outputs.success }}
    steps:
      - name: Wait for Deployment
        id: wait
        env:
          ENVIRONMENT: ${{ needs.verify-bootstrap.outputs.environment }}
        run: |
          # RULE 43: Environment-aware timeouts
          case "$ENVIRONMENT" in
            dev) TIMEOUT=300 ;;      # 5 min for direct deploy
            qa|staging) TIMEOUT=600 ;; # 10 min for canary/blue-green
          esac

          # Wait loop with timeout
          ELAPSED=0
          while [ $ELAPSED -lt $TIMEOUT ]; do
            READY=$(kubectl get pods -n $NAMESPACE -o jsonpath='{.items[*].status.phase}' | tr ' ' '\n' | grep -c Running || echo 0)
            TOTAL=$(kubectl get pods -n $NAMESPACE --no-headers | wc -l)

            if [ "$TOTAL" -gt 0 ] && [ "$READY" -eq "$TOTAL" ]; then
              echo "success=true" >> $GITHUB_OUTPUT
              exit 0
            fi

            sleep 15
            ELAPSED=$((ELAPSED + 15))
          done

          echo "success=false" >> $GITHUB_OUTPUT

  auto-promote:
    needs: [verify-bootstrap, sync-and-wait]
    # RULE 42: always() required for chain continuation
    if: |
      always() &&
      needs.sync-and-wait.outputs.deploy_success == 'true' &&
      needs.verify-bootstrap.outputs.auto_promote == 'true' &&
      needs.verify-bootstrap.outputs.next_environment != ''
    steps:
      - name: Trigger Next Environment
        env:
          GH_TOKEN: ${{ secrets.GH_PAT }}
          NEXT_ENV: ${{ needs.verify-bootstrap.outputs.next_environment }}
          IMAGE_TAG: ${{ needs.verify-bootstrap.outputs.image_tag }}
        run: |
          gh workflow run "${WORKFLOW_FILE}" \
            --repo ${{ github.repository }} \
            -f environment=${NEXT_ENV} \
            -f auto_promote=true \
            -f image_tag=${IMAGE_TAG}
```

---

### Template: Canary Rollout with Analysis

```yaml
# ════════════════════════════════════════════════════════════════════════════
# CANARY ROLLOUT TEMPLATE (QA Environment)
# Strategy: 10% → 30% → 60% → 100% with health analysis
# ════════════════════════════════════════════════════════════════════════════

apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: backend-rollout
spec:
  replicas: 3
  strategy:
    canary:
      canaryService: backend-canary
      stableService: backend-stable
      steps:
        # Step 1: 10% traffic to canary
        - setWeight: 10
        - analysis:
            templates:
              - templateName: http-success-rate
            args:
              - name: service-name
                value: backend-canary

        # Step 2: 30% traffic
        - setWeight: 30
        - pause: { duration: 30s }

        # Step 3: 60% traffic
        - setWeight: 60
        - pause: { duration: 30s }

        # Step 4: Full promotion
        - setWeight: 100
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: ${ECR_URI}/${APP_NAME}-backend:${IMAGE_TAG}
          ports:
            - containerPort: 8000
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
```

---

## New Rules Summary

| Rule | Description | Category |
|------|-------------|----------|
| **RULE 42** | Always add `if: always() && needs.<job>.result == 'success'` to jobs that should run regardless of skipped upstream jobs | GitHub Actions |
| **RULE 43** | Use environment-aware timeouts: DEV=5min, QA/Staging=10min for progressive delivery | Deployment |

## New Learnings Summary

| Learning | Description | Category |
|----------|-------------|----------|
| **446** | When manually triggering promotion with `image_tag`, verify exact tag exists in ECR first | Operations |
| **447** | Always use `git pull --rebase` before pushing when CI workflows may have modified the branch | Git |
| **448** | Canary deployments require longer timeouts due to multi-step progressive rollout | Argo Rollouts |
| **449** | Use GHA diagnostic workflows (Full Diagnostics, Pod Logs) instead of local kubectl for debugging in CI/CD context | Operations |
| **450** | The `deploy_success` output must be explicitly set in ALL code paths (success AND failure) | GitHub Actions |

---

## Verification Commands

```bash
# Check promotion chain status
gh run list --workflow="sperigpt-01-20-ci-build-push.yaml" --limit 10

# Verify image exists before manual promotion
aws ecr describe-images --repository-name sperigpt-01-backend \
  --query 'imageDetails[*].imageTags' --output text

# Run full diagnostics via GHA
gh workflow run "🔬 sperigpt-01: Full Diagnostics" -f environment=qa

# Check canary rollout status via GHA
gh workflow run "⚡ sperigpt-01: 90 Rollout Operations" -f environment=qa -f action=status
```

---

## Merge Instructions

To merge these learnings into the main Code-to-Cloud v0.6 skill:

1. Add RULE 42 and RULE 43 to the rules section
2. Add Learnings 446-450 to the learnings database
3. Update the CI workflow template with:
   - `if: always()` conditions on downstream jobs
   - Environment-aware timeout logic
4. Add the verification commands to the troubleshooting guide

---

*Generated: 2026-01-29 | Session ID: sperigpt-01-20260129*
*Code-to-Cloud v0.6 - Powered by Opsera*
