# Chat App

A fullstack chat application with Python FastAPI backend and React Vite frontend, featuring OpenAI ChatGPT integration.

## Project Structure

```
chat-app/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── requirements.txt  # Python dependencies
│   ├── Dockerfile        # Backend container
│   └── .env.example      # Environment template
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Main React component
│   │   └── ...
│   ├── package.json      # Node dependencies
│   ├── Dockerfile        # Frontend container
│   └── nginx.conf        # Nginx configuration
├── docker-compose.yml    # Container orchestration
└── README.md
```

## Quick Start (Local Development)

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
uvicorn main:app --reload
```
Backend runs at: http://localhost:8000

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: http://localhost:5173

## Docker Deployment

### Build and Run with Docker Compose
```bash
# Set your OpenAI API key
export OPENAI_API_KEY=your_key_here

# Build and run
docker-compose up --build

# Run in background
docker-compose up -d --build
```

Access the app at: http://localhost

### Individual Container Builds
```bash
# Backend
docker build -t chat-app-backend ./backend
docker run -p 8000:8000 -e OPENAI_API_KEY=your_key chat-app-backend

# Frontend
docker build -t chat-app-frontend ./frontend
docker run -p 80:80 chat-app-frontend
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/test` | GET | Test connectivity |
| `/chat` | POST | Send message to ChatGPT |
| `/docs` | GET | Swagger API documentation |

## Features

- Modern React 18 with Vite
- FastAPI with async support
- OpenAI ChatGPT integration
- Tailwind CSS styling
- Framer Motion animations
- Docker containerization
- Docker Compose orchestration

---

## 🚀 CI/CD Pipeline (Code-to-Cloud v0.6)

This project includes an enterprise-grade CI/CD pipeline powered by **Opsera**.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CODE-TO-CLOUD PIPELINE                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GitHub Actions          AWS ECR              ArgoCD           AWS EKS      │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   ┌─────────────┐ │
│  │ Build &     │────▶│ Container   │────▶│ GitOps      │──▶│ Kubernetes  │ │
│  │ Push        │     │ Registry    │     │ Sync        │   │ Cluster     │ │
│  └─────────────┘     └─────────────┘     └─────────────┘   └─────────────┘ │
│                                                                             │
│  Deployment Strategy: Canary (10% → 30% → 60% → 100%)                       │
│  Auto-Rollback: On health check failure                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### GitHub Actions Workflows

| Workflow | Description |
|----------|-------------|
| `🚀 00: Bootstrap Infrastructure` | One-time setup for ArgoCD, namespaces |
| `🔨 20: CI Build & Push` | Build Docker images, push to ECR |
| `🔐 30: Setup HTTPS` | Configure cert-manager & TLS |
| `📊 Canary Watch Dashboard` | Live monitoring during deployments |
| `⚙️ 90: Rollout Operations` | Promote, abort, retry rollouts |
| `🧹 99: Clean It All` | Delete all resources |

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key for ECR/EKS |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `GH_PAT` | GitHub token for ArgoCD repo access |

### Deployment Steps

1. **Initial Setup** (one-time):
   ```bash
   # Push code with skip-ci to avoid premature builds
   git add .
   git commit -m "feat: add CI/CD pipeline [skip ci]"
   git push origin main
   ```

2. **Bootstrap Infrastructure**:
   - Go to Actions → `🚀 00: Bootstrap Infrastructure` → Run workflow
   - This creates ArgoCD application and namespaces

3. **Build & Deploy**:
   - Go to Actions → `🔨 20: CI Build & Push` → Run workflow
   - Or push changes to `frontend/` or `backend/` directories

4. **Setup HTTPS**:
   - Go to Actions → `🔐 30: Setup HTTPS` → Run workflow

5. **Monitor Canary**:
   - Go to Actions → `📊 Canary Watch Dashboard` → Run workflow

### Canary Deployment

The QA environment uses **Canary deployment** strategy:

```
Traffic: 10% → 30% → 60% → 100%
Pauses: 2 minutes between each step
Analysis: HTTP health checks
Rollback: Automatic on failure
```

### Expected URL

```
https://opsera-chat-app-qa.agent.opsera.dev
```

### File Structure

```
.github/workflows/
├── 00-bootstrap-infrastructure.yaml
├── 20-ci-build-push.yaml
├── 30-setup-https.yaml
├── 90-ops-rollout-actions.yaml
├── 99-clean-it-all.yaml
└── tmp-canary-watch.yaml

.opsera-chat-app/
├── Dockerfile.frontend
├── Dockerfile.backend
├── argocd/
│   └── application-qa.yaml
└── k8s/
    ├── base/
    │   ├── frontend-deployment.yaml
    │   ├── backend-deployment.yaml
    │   ├── services, ingress, configmap...
    │   └── rollouts/
    │       └── analysis-template-http.yaml
    └── overlays/qa/
        ├── frontend-rollout.yaml (canary)
        ├── backend-rollout.yaml (canary)
        └── environment patches...
```

---

*Powered by [Opsera](https://opsera.io) - The Unified DevOps Platform*
