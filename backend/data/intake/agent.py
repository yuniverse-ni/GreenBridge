"""Pydantic public facade; raw LangGraph checkpoints remain internal."""

from typing import Any

from .graph import build_intake_graph
from .models import DataIntakeResult, IntakeInput
from .result import build_result


class DataIntakeAgent:
    def __init__(self, *, checkpointer: Any = None, assistant: Any = None):
        self.graph = build_intake_graph(checkpointer=checkpointer, assistant=assistant)

    def invoke(self, inputs: Any, config: dict) -> DataIntakeResult:
        """Accept IntakeInput/dict or Command(resume=...) on the same thread."""
        if isinstance(inputs, IntakeInput):
            inputs = inputs.model_dump()
        return build_result(self.graph.invoke(inputs, config))

    async def ainvoke(self, inputs: Any, config: dict) -> DataIntakeResult:
        if isinstance(inputs, IntakeInput):
            inputs = inputs.model_dump()
        return build_result(await self.graph.ainvoke(inputs, config))

    def get_result(self, config: dict) -> DataIntakeResult:
        return build_result(self.graph.get_state(config).values)
