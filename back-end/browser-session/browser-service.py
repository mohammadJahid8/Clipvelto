"""Dedicated headed Chrome profile with bounded, private YouTube session syncing."""
import asyncio
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import time

from playwright.async_api import async_playwright
from cookies import atomic_write, youtube_export

ROOT = Path("/tmp/clipvelto-browser")
PROFILE = Path("/home/browser/profile")
SESSION = Path("/run/clipvelto-youtube/cookies.txt")
CHROME = "/usr/bin/google-chrome"
children = []
stopping = False


def child(arguments):
    process = subprocess.Popen(arguments, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    children.append(process)
    return process


def status(state, **details):
    atomic_write(ROOT / "status.json", json.dumps({"state": state, "checkedAt": time.time(), **details}))


def stop(_signal=None, _frame=None):
    global stopping
    stopping = True


async def main():
    os.umask(0o077)
    ROOT.mkdir(mode=0o700, exist_ok=True)
    PROFILE.mkdir(mode=0o700, exist_ok=True)
    # Container hostnames/PIDs can change after recreation. Only discard Chrome's
    # stale singleton artifacts after claiming exclusive ownership of the profile.
    profile_lock = os.open(PROFILE / "service.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    fcntl.flock(profile_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    for name in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
        (PROFILE / name).unlink(missing_ok=True)
    lock_fd = os.open(SESSION.with_name("browser.lock"), os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    status("starting")
    display = child(["Xvfb", ":99", "-screen", "0", "1280x800x24", "-nolisten", "tcp"])
    for _ in range(100):
        if Path("/tmp/.X11-unix/X99").exists():
            break
        await asyncio.sleep(0.1)
    child(["fluxbox"])
    # Chrome runs as uid 1000 with its sandbox enabled. CDP is container-local;
    # neither its debugging port nor raw VNC are published on the VPS.
    chrome = child([CHROME, "--user-data-dir=" + str(PROFILE), "--remote-debugging-address=127.0.0.1",
                    "--remote-debugging-port=9222", "--no-first-run", "--no-default-browser-check",
                    "--disable-background-networking", "--window-size=1280,800", "https://www.youtube.com/"])
    vnc = child(["x11vnc", "-display", ":99", "-localhost", "-rfbport", "5900", "-forever", "-shared", "-nopw", "-quiet"])

    def start_gateway():
        # System websockify is installed by apt, independently of Playwright's venv.
        return child(["/usr/bin/websockify", "--web=/usr/share/novnc", "--token-plugin=access.BrowserToken",
                      "--token-source=" + str(ROOT / "ui-access.json"), "6080"])

    gateway = start_gateway()
    browser = None
    try:
        saved = json.loads((PROFILE / "sync-state.json").read_text())
    except (OSError, ValueError):
        saved = {}
    last_auth = saved.get("fingerprint", "")
    published_at = saved.get("publishedAt", 0)
    refreshed_at = 0
    last_state = ""
    async with async_playwright() as playwright:
        while not stopping:
            if chrome.poll() is not None or display.poll() is not None:
                status("browser-stopped")
                raise RuntimeError("Browser process stopped")
            try:
                access = json.loads((ROOT / "ui-access.json").read_text())
                access_expired = access["expiresAt"] <= time.time()
            except (OSError, ValueError, KeyError, TypeError):
                access_expired = False
            if access_expired or (ROOT / "revoke-ui").exists():
                (ROOT / "ui-access.json").unlink(missing_ok=True)
                (ROOT / "revoke-ui").unlink(missing_ok=True)
                gateway.terminate()
                gateway.wait(timeout=5)
                gateway = start_gateway()
            if gateway.poll() is not None or vnc.poll() is not None:
                status("login-view-stopped")
                raise RuntimeError("Private login viewer stopped")
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                status("import-in-progress", publishedAt=published_at or None)
                await asyncio.sleep(10)
                continue
            try:
                if browser is None or not browser.is_connected():
                    browser = await playwright.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=10000)
                context = browser.contexts[0]
                approved = (PROFILE / "sync-approved").is_file()
                page = next((p for p in context.pages if p.url.startswith("https://www.youtube.com/")), None)
                # Never navigate a human away from Google sign-in/challenge screens.
                if not approved:
                    state = "awaiting-operator-approval"
                elif page is None:
                    state = "login-required"
                else:
                    # Renew normally through the same browser, at a bounded rate.
                    # Skip navigation while the private login viewer is enabled.
                    if not (ROOT / "ui-access.json").exists() and time.time() - refreshed_at >= 900:
                        await page.goto("https://www.youtube.com/", wait_until="domcontentloaded", timeout=30000)
                        refreshed_at = time.time()
                    signed_in = await page.locator("#avatar-btn").first.is_visible()
                    exported = youtube_export(await context.cookies(["https://www.youtube.com/"])) if signed_in else None
                    if not exported:
                        state = "login-required"
                    else:
                        text, fingerprint = exported
                        if fingerprint != last_auth and time.time() - published_at >= 300:
                            atomic_write(SESSION, text)
                            last_auth = fingerprint
                            published_at = time.time()
                            atomic_write(PROFILE / "sync-state.json", json.dumps({
                                "fingerprint": last_auth, "publishedAt": published_at}))
                        state = "session-synced"
                status(state, syncEnabled=approved, publishedAt=published_at or None)
                if state != last_state:
                    print(json.dumps({"state": state}), flush=True)
                    last_state = state
            except Exception:
                # Do not log Playwright errors, page URLs, screenshots or cookies:
                # they may contain login/account data. Existing export is preserved.
                status("browser-check-retrying", publishedAt=published_at or None)
                browser = None
            finally:
                fcntl.flock(lock_fd, fcntl.LOCK_UN)
            await asyncio.sleep(10)


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
try:
    asyncio.run(main())
finally:
    for process in reversed(children):
        if process.poll() is None:
            process.terminate()
    for process in reversed(children):
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
