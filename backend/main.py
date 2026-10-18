import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI
from finance_transition.router import router as finance_router

app = FastAPI(
    title="TransitionAI — Finance & Transition Backend",
    description=(
        "Deterministic calculation engine for SME green transition, financial statements, "
        "cash flow, tax, debt capacity, and decarbonisation options."
    ),
    version="1.0.0",
)


@app.get("/health")
def health():
    return {"status": "ok"}


# Mount with /api/finance prefix for Part 3 agent tools
app.include_router(finance_router, prefix="/api/finance")
# Also mount root so direct paths without /api/finance work seamlessly
app.include_router(finance_router)
