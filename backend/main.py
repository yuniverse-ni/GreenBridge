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

app = FastAPI(
    title="TransitionAI — Finance & Transition Backend",
    description=(
        "Deterministic calculation engine for SME green transition, financial statements, "
        "cash flow, tax, debt capacity, and decarbonisation options."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# Mount with /api/finance prefix for Part 3 agent tools
app.include_router(finance_router, prefix="/api/finance")
# Also mount with /api/data prefix for data ingestion workflows
app.include_router(finance_router, prefix="/api/data")
# Also mount root so direct paths without prefixes work seamlessly
app.include_router(finance_router)
