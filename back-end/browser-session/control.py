"""Operator commands run only through docker exec over authenticated SSH."""
import json
from pathlib import Path
import secrets
import sys
import time
from urllib.parse import urlencode

from cookies import atomic_write
ROOT = Path("/tmp/clipvelto-browser")
PROFILE = Path("/home/browser/profile")

command = sys.argv[1] if len(sys.argv) == 2 else "status"
if command == "open":
    ROOT.mkdir(mode=0o700, exist_ok=True)
    token = secrets.token_urlsafe(32)
    atomic_write(ROOT / "ui-access.json", json.dumps({"token": token, "expiresAt": time.time() + 3600}))
    print("http://127.0.0.1:6082/vnc.html?" + urlencode({"autoconnect": "true", "resize": "scale", "path": "websockify?token=" + token}))
elif command in ("enable-sync", "disable-sync"):
    if command == "enable-sync":
        atomic_write(PROFILE / "sync-approved", "approved\n")
    else:
        (PROFILE / "sync-approved").unlink(missing_ok=True)
    print(json.dumps({"syncEnabled": command == "enable-sync"}))
elif command == "close":
    (ROOT / "ui-access.json").unlink(missing_ok=True)
    atomic_write(ROOT / "revoke-ui", "revoke\n")
    print(json.dumps({"loginAccessRevoked": True}))
elif command == "health":
    try:
        data = json.loads((ROOT / "status.json").read_text())
        sys.exit(0 if time.time() - data["checkedAt"] < 120 else 1)
    except (OSError, ValueError, KeyError):
        sys.exit(1)
elif command == "status":
    print((ROOT / "status.json").read_text())
else:
    raise SystemExit("Use open, close, enable-sync, disable-sync, status or health")
