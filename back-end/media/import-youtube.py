"""Download one permitted YouTube recording or bounded capture of an active live."""
import argparse
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time
from urllib.parse import urlparse


class ImportFailure(Exception):
    def __init__(self, code, **details):
        self.code = code
        self.details = details
        super().__init__(code)


def copy_youtube_session(source, directory):
    """Use a private per-job copy; never rewrite the mounted account session."""
    try:
        # Session files are administrator-provided secrets, never browser input.
        # Refuse symlinks, shared-readable files and oversized cookie exports.
        fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(fd, "rb") as session:
            info = os.fstat(session.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077
                    or info.st_size > 1024 * 1024):
                raise ValueError("Invalid session file")
            content = session.read(1024 * 1024 + 1)
        if len(content) > 1024 * 1024:
            raise ValueError("Session file exceeds limit")
        content = content.decode("utf-8")
        if not content.startswith((
                "# Netscape HTTP Cookie File", "# HTTP Cookie File")):
            raise ValueError("Expected a Netscape cookie file")
        rows = ["# Netscape HTTP Cookie File"]
        for line in content.splitlines():
            if not line or (line.startswith("#") and not line.startswith("#HttpOnly_")):
                continue
            fields = line.split("\t")
            if len(fields) != 7:
                raise ValueError("Invalid cookie row")
            domain = fields[0].removeprefix("#HttpOnly_").lstrip(".").lower()
            # Never pass unrelated Google/Gmail or other sites' sessions along.
            if domain == "youtube.com" or domain.endswith(".youtube.com"):
                rows.append(line)
        if len(rows) == 1:
            raise ValueError("No YouTube cookies")
        target = directory / "youtube-session.txt"
        with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as copy:
            copy.write("\n".join(rows) + "\n")
        return str(target)
    except (OSError, ValueError):
        raise ImportFailure("SESSION_UNAVAILABLE") from None


def main():
    parser = argparse.ArgumentParser()
    for name in ("id", "directory", "ffmpeg", "node"):
        parser.add_argument("--" + name, required=True)
    for name in ("max-bytes", "max-seconds", "capture-seconds"):
        parser.add_argument("--" + name, type=int, required=True)
    parser.add_argument("--preview-seconds", type=int, default=0)
    parser.add_argument("--metadata-only", action="store_true")
    parser.add_argument("--require-credit", action="store_true")
    parser.add_argument("--cookies-file")
    args = parser.parse_args()
    if args.preview_seconds not in (0, 180):
        raise ValueError("Invalid preview window")
    if not re.fullmatch(r"[\w-]{11}", args.id) or not 60 <= args.capture_seconds <= 600:
        raise ValueError("Invalid video or capture duration")
    import yt_dlp
    directory = Path(args.directory)
    url = "https://www.youtube.com/watch?v=" + args.id
    output = directory / "source.mp4"

    def progress(data):
        disk = os.statvfs(directory)
        if disk.f_bavail * disk.f_frsize < 1024 ** 3:
            raise ImportFailure("MEDIA_CAPACITY")
        if data.get("downloaded_bytes", 0) > args.max_bytes:
            raise ImportFailure("SIZE_LIMIT")
        if sum(p.stat().st_size for p in directory.iterdir() if p.is_file()) > args.max_bytes:
            raise ImportFailure("SIZE_LIMIT")

    options = {"noplaylist": True, "quiet": True, "no_warnings": True,
               # quiet suppresses normal messages, but download progress still
               # writes to stdout unless explicitly disabled. Results are files.
               "noprogress": True,
               "socket_timeout": 20, "retries": 1, "fragment_retries": 1,
               "skip_unavailable_fragments": False,
               "concurrent_fragment_downloads": 1, "max_filesize": args.max_bytes,
               "format": "bv*[width<=1920][height<=1920][ext=mp4]+ba[ext=m4a]/b[width<=1920][height<=1920][ext=mp4]",
               "outtmpl": str(directory / "download.%(ext)s"), "merge_output_format": "mp4",
               "ffmpeg_location": args.ffmpeg, "js_runtimes": {"node": {"path": args.node}},
               "progress_hooks": [progress], "restrictfilenames": True,
               "postprocessor_args": {"ffmpeg": ["-threads", "2"]},
               "cachedir": False}
    if args.cookies_file:
        options["cookiefile"] = copy_youtube_session(args.cookies_file, directory)
    with yt_dlp.YoutubeDL(options) as downloader:
        info = downloader.extract_info(url, download=False)
        if info.get("id") != args.id or info.get("_type") in ("playlist", "multi_video"):
            raise ValueError("Expected one YouTube video")
        if info.get("live_status") in ("is_upcoming", "post_live"):
            raise ImportFailure("NOT_READY")
        live = bool(info.get("is_live"))
        formats = info.get("requested_formats") or [info]
        estimated_bytes = sum(fmt.get("filesize") or fmt.get("filesize_approx") or 0 for fmt in formats)
        quote = {"title": (info.get("title") or "YouTube video")[:200], "live": live,
                 "durationSeconds": args.capture_seconds if live else info.get("duration"),
                 "sizeBytes": int(estimated_bytes)}
        if not quote["durationSeconds"] or quote["durationSeconds"] <= 0:
            raise ImportFailure("UNAVAILABLE")
        (directory / "quote.json").write_text(json.dumps(quote), encoding="utf-8")
        os.chmod(directory / "quote.json", 0o600)
        if args.metadata_only:
            return
        if args.require_credit:
            deadline = time.monotonic() + 60
            while not (directory / "credit-approved").exists():
                if time.monotonic() > deadline:
                    raise ImportFailure("TIMEOUT")
                time.sleep(0.1)
        if args.preview_seconds:
            if live or not info.get("duration"):
                raise ValueError("Preview trials require a finished recording")
            # Keep short imports ranged and reuse connections instead of fetching
            # large remote buffers. Older FFmpeg versions retain the safe fallback.
            network_options = ["-multiple_requests", "1"]
            try:
                help_text = subprocess.run([args.ffmpeg, "-hide_banner", "-h", "protocol=http"], capture_output=True, text=True, timeout=5).stdout
                if "-initial_request_size" in help_text and "-request_size" in help_text:
                    network_options += ["-request_size", "1048576", "-initial_request_size", "262144"]
            except (OSError, subprocess.SubprocessError):
                pass
            def capture_preview(formats):
                command = [args.ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y"]
                for fmt in formats:
                    media_url = fmt.get("url", "")
                    parsed = urlparse(media_url)
                    if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".googlevideo.com"):
                        raise ValueError("Unsupported media host")
                    headers = fmt.get("http_headers") or info.get("http_headers") or {}
                    for name, option in (("User-Agent", "-user_agent"), ("Referer", "-referer")):
                        value = headers.get(name)
                        if isinstance(value, str) and "\r" not in value and "\n" not in value:
                            command += [option, value]
                    if fmt.get("protocol", "https") in ("http", "https"):
                        command += network_options
                    command += ["-rw_timeout", "20000000", "-protocol_whitelist", "https,tls,tcp,crypto", "-threads", "2", "-i", media_url]
                command += ["-map", "0:v:0", "-map", "1:a:0" if len(formats) > 1 else "0:a:0", "-t", str(min(info["duration"], args.preview_seconds - 1)), "-c", "copy", "-fs", str(args.max_bytes), "-movflags", "+faststart", str(output)]
                return subprocess.run(command, stderr=subprocess.PIPE, text=True, timeout=160, stdin=subprocess.DEVNULL)

            result = capture_preview(info.get("requested_formats") or [info])
            if result.returncode and "403" in result.stderr:
                # Some recordings reject direct media URLs but provide working HLS.
                # Retry once using the same resolution cap and original size/window limits.
                selector = downloader.build_format_selector(
                    "bv[protocol^=m3u8][vcodec^=avc1][width<=1920][height<=1920]+ba[protocol^=m3u8]/"
                    "b[protocol^=m3u8][width<=1920][height<=1920]"
                )
                alternate = next(selector(info), None)
                if alternate:
                    result = capture_preview(alternate.get("requested_formats") or [alternate])
            if result.returncode:
                # Do not include signed CDN URLs or request headers in the traceback.
                raise ValueError("YouTube denied access to the recording" if "403" in result.stderr else "YouTube preview import failed")
        elif live:
            # Record only the next bounded window. No indefinite or from-start capture.
            if args.capture_seconds > args.max_seconds:
                raise ImportFailure("DURATION_LIMIT", durationSeconds=args.capture_seconds, maxSeconds=args.max_seconds)
            formats = info.get("requested_formats") or [info]
            command = [args.ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y"]
            for fmt in formats:
                media_url = fmt.get("url", "")
                parsed = urlparse(media_url)
                if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".googlevideo.com"):
                    raise ValueError("Unsupported live media host")
                command += ["-rw_timeout", "20000000", "-protocol_whitelist", "https,tls,tcp,crypto", "-threads", "2", "-i", media_url]
            command += ["-map", "0:v:0", "-map", "1:a:0" if len(formats) > 1 else "0:a:0", "-t", str(args.capture_seconds),
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", "2", "-c:a", "aac", "-b:a", "160k",
                        "-fs", str(args.max_bytes), "-movflags", "+faststart", str(output)]
            subprocess.run(command, check=True, timeout=args.capture_seconds + 120, stdin=subprocess.DEVNULL)
        else:
            duration = info.get("duration")
            if not duration:
                raise ImportFailure("UNAVAILABLE")
            if duration > args.max_seconds:
                raise ImportFailure("DURATION_LIMIT", durationSeconds=duration, maxSeconds=args.max_seconds)
            try:
                downloader.process_info(info)
            except yt_dlp.utils.DownloadError as error:
                # A recording can expose a format whose CDN requests return 403.
                # Try one freshly extracted alternative transport, not an endless
                # retry of the same rejected media URL. Access requirements stay
                # unchanged; reuse only the configured administrator session.
                if "403" not in str(error):
                    raise
                was_hls = any(str(fmt.get("protocol", "")).startswith("m3u8") for fmt in formats)
                alternative_options = dict(options)
                alternative_options["format"] = (
                    "bv*[protocol=https][width<=1920][height<=1920][ext=mp4]+ba[protocol=https][ext=m4a]/"
                    "b[protocol=https][width<=1920][height<=1920][ext=mp4]"
                    if was_hls else
                    "bv[protocol^=m3u8][vcodec^=avc1][width<=1920][height<=1920]+ba[protocol^=m3u8]/"
                    "b[protocol^=m3u8][width<=1920][height<=1920]"
                )
                with yt_dlp.YoutubeDL(alternative_options) as alternative:
                    try:
                        refreshed = alternative.extract_info(url, download=False)
                    except yt_dlp.utils.DownloadError as refresh_error:
                        if "requested format is not available" in str(refresh_error).lower():
                            raise ImportFailure("ACCESS_DENIED") from None
                        raise
                    # Do not download a changed source using the approved quote.
                    if (refreshed.get("id") != args.id
                            or refreshed.get("_type") in ("playlist", "multi_video")
                            or refreshed.get("live_status") in ("is_live", "is_upcoming", "post_live")
                            or refreshed.get("is_live")
                            or refreshed.get("duration") != duration):
                        raise ImportFailure("NOT_READY")
                    # Never combine partial fragments from different transports.
                    for partial in directory.glob("download.*"):
                        if partial.is_file():
                            partial.unlink()
                    alternative.process_info(refreshed)
            source = directory / "download.mp4"
            if not source.is_file():
                raise ValueError("No compatible MP4 was downloaded")
            source.rename(output)
    if not output.is_file() or output.stat().st_size > args.max_bytes:
        raise ImportFailure("SIZE_LIMIT")
    os.chmod(output, 0o600)
    (directory / "result.json").write_text(json.dumps({"title": (info.get("title") or "YouTube video")[:200], "live": live}), encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Only bounded, allowlisted diagnostics cross the process boundary.
        # Never save provider errors, signed media URLs or request headers.
        code, details = "IMPORT_FAILED", {}
        if isinstance(error, ImportFailure):
            code, details = error.code, error.details
        else:
            message = str(error).lower()
            if "not a bot" in message or "confirm you're not" in message or "confirm you’re not" in message:
                code = "BOT_CHECK"
            elif "403" in message or "sign in" in message or "denied access" in message:
                code = "ACCESS_DENIED"
            elif "size limit" in message or "larger than max-filesize" in message:
                code = "SIZE_LIMIT"
            elif any(value in message for value in ("unavailable", "private video", "removed", "members-only")):
                code = "UNAVAILABLE"
            elif "timed out" in message or isinstance(error, subprocess.TimeoutExpired):
                code = "TIMEOUT"
        try:
            directory = Path(sys.argv[sys.argv.index("--directory") + 1])
            error_file = directory / "error.json"
            error_file.write_text(json.dumps({"code": code, **details}), encoding="utf-8")
            os.chmod(error_file, 0o600)
        except (ValueError, IndexError, OSError):
            pass
        sys.exit(1)
