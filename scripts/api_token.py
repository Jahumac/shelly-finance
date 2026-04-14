"""CLI tool for managing API tokens.

Usage:
    python scripts/api_token.py create <username> [label]
    python scripts/api_token.py list <username>
    python scripts/api_token.py revoke <token_id>

The token is printed once on creation. Save it somewhere safe — it can't be
recovered later (only revoked and replaced).
"""
import sys

from app import create_app
from app.models import (
    create_api_token,
    fetch_api_tokens,
    get_user_by_username,
    revoke_api_token,
)


def _cmd_create(username, label=None):
    user = get_user_by_username(username)
    if not user:
        print(f"error: user '{username}' not found", file=sys.stderr)
        sys.exit(2)
    token = create_api_token(user.id, label=label)
    print(f"Token created for {username} (label: {label or '-'})")
    print(f"\n  {token}\n")
    print("Save this token — it will not be shown again.")
    print("Use it as:  Authorization: Bearer <token>")


def _cmd_list(username):
    user = get_user_by_username(username)
    if not user:
        print(f"error: user '{username}' not found", file=sys.stderr)
        sys.exit(2)
    rows = fetch_api_tokens(user.id)
    if not rows:
        print(f"No tokens for {username}.")
        return
    print(f"{'ID':<5} {'Preview':<10} {'Label':<20} {'Created':<20} {'Last used'}")
    for r in rows:
        print(f"{r['id']:<5} {r['token_preview']+'…':<10} {(r['label'] or '-'):<20} "
              f"{r['created_at'] or '-':<20} {r['last_used_at'] or '-'}")


def _cmd_revoke(token_id, username=None):
    # If username given, scope to that user; otherwise find owner first.
    if username:
        user = get_user_by_username(username)
        if not user:
            print(f"error: user '{username}' not found", file=sys.stderr)
            sys.exit(2)
        ok = revoke_api_token(int(token_id), user.id)
    else:
        # Revoke across any user — convenience for a single-user self-host.
        from app.models import get_connection
        with get_connection() as conn:
            row = conn.execute(
                "SELECT user_id FROM api_tokens WHERE id = ?", (int(token_id),)
            ).fetchone()
        if row is None:
            print(f"error: token id {token_id} not found", file=sys.stderr)
            sys.exit(2)
        ok = revoke_api_token(int(token_id), row["user_id"])
    print("Revoked." if ok else "No matching token.")


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        sys.exit(1)

    app = create_app()
    with app.app_context():
        cmd = argv[1]
        if cmd == "create" and len(argv) >= 3:
            _cmd_create(argv[2], argv[3] if len(argv) >= 4 else None)
        elif cmd == "list" and len(argv) >= 3:
            _cmd_list(argv[2])
        elif cmd == "revoke" and len(argv) >= 3:
            _cmd_revoke(argv[2], argv[3] if len(argv) >= 4 else None)
        else:
            print(__doc__)
            sys.exit(1)


if __name__ == "__main__":
    main(sys.argv)
