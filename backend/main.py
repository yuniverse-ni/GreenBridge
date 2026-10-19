import os
import sys

# Ensure both backend directory and project root are in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(backend_dir)
for p in (project_root, backend_dir):
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from finance_transition.router import router as finance_router
from backend.data.intake.router import router as intake_router, intake_registry
from backend.agent.router import create_agent_router
from backend.finance_transition.intake_router import create_intake_finance_router
from backend.runtime.services import build_production_services
from backend.carbon.router import create_carbon_router
from auth import auth_router, init_db

app = FastAPI(
    title="TransitionAI — Finance, Security & Transition Backend",
    description=(
        "Deterministic calculation engine for SME green transition, financial statements, "
        "cash flow, debt capacity, and SQLite-backed authentication."
    ),
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite database and seed demo accounts
@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "db": "sqlite_connected"}


# Mount Authentication endpoints
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])

# Mount with /api/finance prefix for Part 3 agent tools
app.include_router(finance_router, prefix="/api/finance")
# Also mount with /api/data prefix for data ingestion workflows
app.include_router(finance_router, prefix="/api/data")
# Also mount root so direct paths without prefixes work seamlessly
app.include_router(finance_router)

# Mount Intake and Agent services from agent-v2
app.include_router(intake_router)
analysis_services = build_production_services()
app.include_router(create_agent_router(intake_registry, services=analysis_services))
app.include_router(create_intake_finance_router(intake_registry, services=analysis_services))
app.include_router(create_carbon_router(intake_registry, services=analysis_services))
