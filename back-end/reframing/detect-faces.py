"""Bounded local face-guided crop positions. No recognition or model downloads."""
import argparse
import json
import statistics
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--frames", required=True)
    args = parser.parse_args()
    files = sorted(Path(args.frames).glob("frame-*.jpg"))
    if not 1 <= len(files) <= 121:
        raise ValueError("Invalid frame count")
    import cv2
    cv2.setNumThreads(2)
    frontal = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml")
    profile = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
    if frontal.empty() or profile.empty():
        raise ValueError("Face framing unavailable")
    points, centers, vertical_centers = [], [], []
    last_image, last_center, missed = None, 0.5, 0
    for index, path in enumerate(files):
        frame = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
        if frame is None:
            raise ValueError("Unreadable sample")
        thumbnail = cv2.resize(frame, (32, 18))
        cut = last_image is not None and float(cv2.absdiff(thumbnail, last_image).mean()) > 38
        last_image = thumbnail
        gray = cv2.equalizeHist(frame)
        faces = list(frontal.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(20, 20)))
        if not faces:
            faces = list(profile.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(20, 20)))
            faces.extend((gray.shape[1] - x - w, y, w, h) for x, y, w, h in profile.detectMultiScale(cv2.flip(gray, 1), scaleFactor=1.2, minNeighbors=5, minSize=(20, 20)))
        if faces:
            x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
            center = float((x + w / 2) / gray.shape[1])
            centers.append(center)
            vertical_centers.append(float((y + h / 2) / gray.shape[0]))
            missed = 0
            center = center if cut or not points else last_center * 0.25 + center * 0.75
        else:
            missed += 1
            center = last_center if not cut and missed <= 3 else 0.5
        if not points or cut or abs(center - last_center) >= 0.025:
            points.append({"time": index / 2, "focusX": round(center, 4), "cut": bool(cut)})
            last_center = center
    if len(centers) < 2:
        points = [{"time": 0, "focusX": 0.5, "cut": False}]
    if len(points) > 48:
        points = [points[round(index * (len(points) - 1) / 47)] for index in range(48)]
    print(json.dumps({"focusX": statistics.median(centers) if len(centers) >= 2 else 0.5,
                      "focusY": statistics.median(vertical_centers) if len(vertical_centers) >= 2 else 0.5,
                      "method": "face" if len(centers) >= 2 else "center",
                      "matchedSamples": len(centers), "points": points}))


if __name__ == "__main__":
    main()
