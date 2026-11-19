// Rockstar Support confirms midnight local time on 19 November 2026.
// Explicit offsets are for this release date, avoiding the visitor's timezone
// and today's daylight-saving offset changing a region's deadline.
export const gtaRelease = {
  date: "November 19, 2026",
  source: "https://support.rockstargames.com/articles/29jV3Cv2cCgvwM1XgtMO5o/grand-theft-auto-vi-regional-pre-load-and-release-times-on-playstation-5-and-xbox-series-x-or-s?pubDate=20261107",
  screenshots: "https://www.rockstargames.com/VI/media/screenshots",
};

export const gtaRegions = [
  { zone: "Pacific/Auckland", city: "Auckland", label: "New Zealand", unlock: "2026-11-19T00:00:00+13:00" },
  { zone: "Australia/Sydney", city: "Sydney", label: "Australia · AEDT", unlock: "2026-11-19T00:00:00+11:00" },
  { zone: "Asia/Tokyo", city: "Tokyo", label: "Japan · JST", unlock: "2026-11-19T00:00:00+09:00" },
  { zone: "Asia/Dhaka", city: "Dhaka", label: "Bangladesh · BST", unlock: "2026-11-19T00:00:00+06:00" },
  { zone: "Asia/Kolkata", city: "New Delhi", label: "India · IST", unlock: "2026-11-19T00:00:00+05:30" },
  { zone: "Asia/Dubai", city: "Dubai", label: "United Arab Emirates · GST", unlock: "2026-11-19T00:00:00+04:00" },
  { zone: "Europe/Paris", city: "Paris", label: "Central Europe · CET", unlock: "2026-11-19T00:00:00+01:00" },
  { zone: "Europe/London", city: "London", label: "United Kingdom · GMT", unlock: "2026-11-19T00:00:00+00:00" },
  { zone: "America/New_York", city: "New York", label: "US Eastern · EST", unlock: "2026-11-19T00:00:00-05:00" },
  { zone: "America/Chicago", city: "Chicago", label: "US Central · CST", unlock: "2026-11-19T00:00:00-06:00" },
  { zone: "America/Denver", city: "Denver", label: "US Mountain · MST", unlock: "2026-11-19T00:00:00-07:00" },
  { zone: "America/Los_Angeles", city: "Los Angeles", label: "US Pacific · PST", unlock: "2026-11-19T00:00:00-08:00" },
  { zone: "Pacific/Honolulu", city: "Honolulu", label: "Hawaii · HST", unlock: "2026-11-19T00:00:00-10:00" },
] as const;

export function gtaTimeRemaining(unlock: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(unlock) - now) / 1000));
  return {
    total: seconds,
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}
