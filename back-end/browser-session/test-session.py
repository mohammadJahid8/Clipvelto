import json
import fcntl
import importlib.util
import sys
import os
from pathlib import Path
import tempfile
import time
import unittest

from access import BrowserToken
from cookies import atomic_write, youtube_export


def cookie(name, domain=".youtube.com", value="fixture", expires=-1):
    return {"name": name, "value": value, "domain": domain, "path": "/", "secure": True, "httpOnly": True, "expires": expires}


class PrivateSessionTests(unittest.TestCase):
    def test_export_filters_unrelated_expired_and_partitioned_cookies(self):
        values = [cookie("SID"), cookie("SAPISID"), cookie("secret", ".google.com"),
                  cookie("expired", expires=1), {**cookie("partitioned"), "partitionKey": "https://other.test"}]
        text, _ = youtube_export(values)
        self.assertNotIn(".google.com", text)
        self.assertNotIn("expired", text)
        self.assertNotIn("partitioned", text)
        self.assertIn("#HttpOnly_.youtube.com\tTRUE", text)
        self.assertIsNone(youtube_export([cookie("VISITOR_INFO1_LIVE")]))

    def test_non_auth_cookie_changes_do_not_reopen_a_paused_session(self):
        values = [cookie("SID"), cookie("SAPISID"), cookie("PREF", value="a")]
        _, first = youtube_export(values)
        values[-1]["value"] = "b"
        _, second = youtube_export(values)
        self.assertEqual(first, second)
        values[0]["value"] = "rotated"
        self.assertNotEqual(first, youtube_export(values)[1])
        with self.assertRaises(ValueError):
            youtube_export([cookie("SID", value="injected\nrow"), cookie("SAPISID")])

    def test_private_atomic_files_and_expiring_fixed_target_access(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "access.json"
            atomic_write(target, json.dumps({"token": "private-fixture", "expiresAt": time.time() + 60}))
            self.assertEqual(os.stat(target).st_mode & 0o777, 0o600)
            access = BrowserToken(target)
            self.assertIsNone(access.lookup("wrong"))
            self.assertEqual(access.lookup("private-fixture"), ["127.0.0.1", "5900"])
            atomic_write(target, json.dumps({"token": "private-fixture", "expiresAt": 0}))
            self.assertIsNone(access.lookup("private-fixture"))
            target.unlink()
            self.assertIsNone(access.lookup("private-fixture"))

    def test_import_holds_browser_refresh_until_it_finishes(self):
        spec = importlib.util.spec_from_file_location("import_youtube", Path(__file__).parents[1] / "media/import-youtube.py")
        importer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(importer)
        before = sys.argv
        try:
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "cookies.txt"
                lock = path.with_name("browser.lock")
                lock.touch(mode=0o600)
                sys.argv = ["import-youtube.py", "--cookies-file", str(path)]
                fd = os.open(lock, os.O_RDWR)
                try:
                    with importer.browser_session_guard():
                        with self.assertRaises(BlockingIOError):
                            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    fcntl.flock(fd, fcntl.LOCK_UN)
                finally:
                    os.close(fd)
        finally:
            sys.argv = before


if __name__ == "__main__":
    unittest.main()
