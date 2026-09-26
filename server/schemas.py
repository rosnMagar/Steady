"""Request models. Ingest is deliberately permissive (the Shortcut sends messy shapes we normalize
server-side); check-in and feedback are strict."""
from pydantic import BaseModel, Field, ConfigDict


class DailyRaw(BaseModel):
    """Raw daily payload from the iPhone Shortcut. Extra keys (sleep_raw, resting_heart_rate, …) are
    allowed and handled by server.normalize."""
    model_config = ConfigDict(extra="allow")
    person_id: str
    date: str


class BackfillBody(BaseModel):
    days: list[DailyRaw] = Field(min_length=1, max_length=60)


class Checkin(BaseModel):
    model_config = ConfigDict(extra="ignore")
    person_id: str
    date: str
    stress: int = Field(ge=1, le=5)
    tags: list[str] = []
    source: str = "apple_watch"


class Feedback(BaseModel):
    program_id: str
    helpful: bool
