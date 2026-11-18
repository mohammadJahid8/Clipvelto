"""Expiring private noVNC access; the upstream target is never user-controlled."""
import hmac
import json
import time
from pathlib import Path


class BrowserToken:
    def __init__(self, source):
        self.source = Path(source)

    def lookup(self, token):
        try:
            data = json.loads(self.source.read_text())
            if (isinstance(token, str) and data["expiresAt"] > time.time()
                    and hmac.compare_digest(token, data["token"])):
                return ["127.0.0.1", "5900"]
        except (OSError, KeyError, TypeError, ValueError):
            pass
        return None
