"""
Centralised slowapi rate-limiter configuration.

Usage
-----
Import `limiter` in main.py and attach it to the FastAPI app:

    from app.core.rate_limit import limiter
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

Then decorate individual endpoints:

    from app.core.rate_limit import limiter
    from fastapi import Request

    @router.post("/login")
    @limiter.limit("10/minute")
    def login(request: Request, ...):
        ...

The `request: Request` parameter is required by slowapi even if the endpoint
doesn't use it directly.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# Key function: use the real client IP.
# Behind a reverse proxy set FORWARDED_ALLOW_IPS / trust X-Forwarded-For as needed.
# Rate limiting is disabled entirely in the test environment so the test suite
# (which calls /auth/login many times in quick succession) is not blocked.
_enabled = settings.ENVIRONMENT != "testing"

limiter = Limiter(key_func=get_remote_address, default_limits=[], enabled=_enabled)
