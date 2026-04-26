from collections.abc import Mapping, Sequence
from typing import Any

SENSITIVE_KEY_PARTS = (
    "token",
    "secret",
    "password",
    "authorization",
    "cookie",
    "powens_code",
    "access_code",
    "api_key",
    "bearer",
    "session",
)


def redact_value(value: Any, *, max_string_length: int = 2048) -> Any:
    if isinstance(value, Mapping):
        redacted: dict[str, Any] = {}
        for key, nested in value.items():
            normalized_key = str(key).lower()
            if any(part in normalized_key for part in SENSITIVE_KEY_PARTS):
                redacted[str(key)] = "[redacted]"
            else:
                redacted[str(key)] = redact_value(nested, max_string_length=max_string_length)
        return redacted

    if isinstance(value, str):
        if len(value) > max_string_length:
            return f"{value[:max_string_length]}...[truncated]"
        return value

    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray, str)):
        return [redact_value(item, max_string_length=max_string_length) for item in value[:100]]

    return value
