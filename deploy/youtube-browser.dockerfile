FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DISPLAY=:99 \
    HOME=/home/browser PYTHONPATH=/opt/clipvelto-browser
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates curl xvfb x11vnc novnc websockify fluxbox fonts-liberation \
    && curl -fsSLo /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y --no-install-recommends /tmp/chrome.deb \
    && rm /tmp/chrome.deb && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 1000 --create-home --shell /bin/sh browser
RUN pip install --no-cache-dir playwright==1.64.1
COPY back-end/browser-session /opt/clipvelto-browser
USER browser
WORKDIR /opt/clipvelto-browser
CMD ["python", "browser-service.py"]
