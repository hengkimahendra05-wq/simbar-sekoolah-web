"""Shared Pydantic base for all Mongo-backed documents.

Ids are uuid4 strings (never ObjectId), and every datetime is normalised to
aware UTC on the way in, so Pydantic serialises with an offset that JavaScript
`new Date(...)` can parse (TEMPLATE.md §4).
"""

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, model_validator


def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class BaseDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def _aware_utc(cls, data: object) -> object:
        if isinstance(data, dict):
            for key, val in list(data.items()):
                if isinstance(val, datetime) and val.tzinfo is None:
                    data[key] = val.replace(tzinfo=timezone.utc)
        return data
