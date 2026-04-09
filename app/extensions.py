"""Shared Flask extensions — imported by routes and initialised in create_app()."""

try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address

    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[],
        storage_uri="memory://",
    )
except ImportError:
    limiter = None
