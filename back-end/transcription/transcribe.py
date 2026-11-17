"""CPU-only local transcription. Uploads and speech never leave this process."""
import argparse
import json
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=("tiny", "base", "small"), default="small")
    parser.add_argument("--models", required=True)
    parser.add_argument("--threads", type=int, choices=(1, 2), default=2)
    parser.add_argument("--max-seconds", type=int, default=1800)
    parser.add_argument("--input")
    parser.add_argument("--output")
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    import av
    import numpy as np
    from faster_whisper import WhisperModel

    # Downloads occur only during explicit setup, never while handling a video.
    model = WhisperModel(args.model, device="cpu", compute_type="int8",
                         cpu_threads=args.threads, num_workers=1,
                         download_root=args.models, local_files_only=not args.prepare)
    if args.prepare or args.check:
        return
    if not args.input or not args.output or not 1 <= args.max_seconds <= 281474976709:
        raise ValueError("Input, output, and a bounded duration are required")

    result = {"language": "und", "model": args.model, "segments": []}
    chunks = []
    sample_count = 0
    # The decoder accepts only local supported containers, not playlists or URLs.
    with av.open(args.input, options={"protocol_whitelist": "file", "format_whitelist": "mov,mp4,m4a,3gp,3g2,mj2,matroska,webm"}) as container:
        if not container.streams.audio:
            result["emptyReason"] = "no_audio"
        else:
            stream = container.streams.audio[0]
            stream.codec_context.thread_count = args.threads
            resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)

            def append_frames(frames):
                nonlocal sample_count
                for frame in frames:
                    data = frame.to_ndarray().reshape(-1)
                    sample_count += len(data)
                    if sample_count > (args.max_seconds + 1) * 16000:
                        raise ValueError("Decoded audio exceeds the duration limit")
                    chunks.append(data)

            for frame in container.decode(stream):
                # Ignore discontinuous source timestamps; produce contiguous PCM.
                frame.pts = None
                append_frames(resampler.resample(frame))
            append_frames(resampler.resample(None))
    if chunks:
        audio = np.concatenate(chunks).astype(np.float32) / 32768.0
        del chunks
        segments, info = model.transcribe(audio, beam_size=1, word_timestamps=True,
                                          vad_filter=True, condition_on_previous_text=False)
        result["language"] = info.language
        previous_end = 0.0
        word_count = 0
        for segment in segments:
            text = segment.text.strip()
            if not text:
                continue
            start = round(max(previous_end, float(segment.start)), 3)
            end = round(max(start, min(float(segment.end), args.max_seconds + 1)), 3)
            words = [{"start": round(max(start, min(float(word.start), end)), 3),
                      "end": round(max(start, min(float(word.end), end)), 3),
                      "word": word.word} for word in (segment.words or []) if word.word.strip()]
            word_count += len(words)
            result["segments"].append({"start": start, "end": end, "text": text, "words": words})
            previous_end = end
            if word_count > (args.max_seconds + 1) * 50:
                raise ValueError("Transcript exceeds the size limit")
    if not result["segments"] and "emptyReason" not in result:
        result["emptyReason"] = "no_speech"
    encoded = json.dumps(result, ensure_ascii=False, allow_nan=False).encode("utf-8")
    if len(encoded) > 512 * 1024 ** 2:
        raise ValueError("Transcript exceeds the size limit")
    descriptor = os.open(Path(args.output), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as output:
        output.write(encoded)


if __name__ == "__main__":
    main()
