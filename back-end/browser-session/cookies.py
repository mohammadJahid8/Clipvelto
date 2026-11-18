"""Private, atomic session publication. No cookie values are logged."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time

AUTH_NAMES = {"SID", "SAPISID", "__Secure-1PSID", "__Secure-3PSID",
              "__Secure-1PAPISID", "__Secure-3PAPISID",
              "__Secure-1PSIDTS", "__Secure-3PSIDTS",
              "__Secure-1PSIDCC", "__Secure-3PSIDCC"}


def atomic_write(path, text):
    path = Path(path)
    fd, temporary = tempfile.mkstemp(prefix=".session-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as output:
            os.fchmod(output.fileno(), 0o600)
            output.write(text)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def youtube_export(cookies, now=None):
    now = time.time() if now is None else now
    selected = []
    for cookie in cookies:
        domain = cookie["domain"].lstrip(".").lower()
        if domain != "youtube.com" and not domain.endswith(".youtube.com"):
            continue
        if cookie.get("partitionKey"):
            continue
        expires = cookie.get("expires", -1)
        if expires > 0 and expires <= now:
            continue
        values = [cookie["domain"], cookie.get("path", "/"), cookie["name"], cookie["value"]]
        if any(any(c in value for c in "\r\n\t") for value in values):
            raise ValueError("Invalid cookie row")
        selected.append(cookie)
    names = {cookie["name"] for cookie in selected}
    if not (names & {"SID", "__Secure-1PSID", "__Secure-3PSID"}) or not (
            names & {"SAPISID", "__Secure-1PAPISID", "__Secure-3PAPISID"}):
        return None
    rows = ["# Netscape HTTP Cookie File"]
    for cookie in sorted(selected, key=lambda c: (c["domain"], c.get("path", "/"), c["name"])):
        domain = ("#HttpOnly_" if cookie.get("httpOnly") else "") + cookie["domain"]
        rows.append("\t".join([domain, "TRUE" if cookie["domain"].startswith(".") else "FALSE",
                               cookie.get("path", "/"), "TRUE" if cookie.get("secure") else "FALSE",
                               str(max(0, int(cookie.get("expires", 0)))), cookie["name"], cookie["value"]]))
    # Visitor/analytics changes alone must not continually reopen a paused importer.
    auth = sorted((c["domain"], c["name"], c["value"]) for c in selected if c["name"] in AUTH_NAMES)
    fingerprint = hashlib.sha256(json.dumps(auth, separators=(",", ":")).encode()).hexdigest()
    return "\n".join(rows) + "\n", fingerprint
