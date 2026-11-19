"use client";

import { Field, Label, Select } from "@headlessui/react";
import { Check, ChevronDown, Clock3, Globe2, Share2, ArrowDown, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { gtaRegions, gtaTimeRemaining } from "@/lib/gta-release";

const pad = (value: number) => String(value).padStart(2, "0");

export function GtaCountdown() {
  const [zone, setZone] = useState<string>("America/New_York");
  const [now, setNow] = useState<number | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const region = gtaRegions.find((item) => item.zone === zone) ?? gtaRegions[8];
  const remaining = now === null ? null : gtaTimeRemaining(region.unlock, now);
  const released = remaining?.total === 0;

  useEffect(() => {
    const time = Date.now();
    const linkedZone = new URLSearchParams(location.search).get("region");
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const linked = gtaRegions.find((item) => item.zone === linkedZone);
    const local = gtaRegions.find((item) => item.zone === localZone && Date.parse(item.unlock) > time);
    const next = gtaRegions.find((item) => Date.parse(item.unlock) > time);
    setZone((linked ?? local ?? next ?? gtaRegions[8]).zone);
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  function chooseRegion(value: string) {
    if (!gtaRegions.some((item) => item.zone === value)) return;
    setZone(value);
    setShareMessage("");
    const url = new URL(location.href);
    url.searchParams.set("region", value);
    window.history.replaceState(window.history.state, "", url);
  }

  async function share() {
    const url = new URL("/gta-6-countdown", location.origin);
    url.searchParams.set("region", region.zone);
    try {
      if (navigator.share) {
        await navigator.share({ title: "GTA 6 launch countdown", text: `GTA 6's midnight release in ${region.city}.`, url: url.href });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url.href);
        setShareMessage("Countdown link copied.");
      } else {
        chooseRegion(region.zone);
        setShareMessage("Copy this page’s address to share your region.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        chooseRegion(region.zone);
        setShareMessage("Copy this page’s address to share your region.");
      }
    }
  }

  return (
    <>
      <div className="gta-countdown-panel">
        <div className="gta-timer-heading" role="status">
          {released ? <Check size={18} aria-hidden="true" /> : <Clock3 size={18} aria-hidden="true" />}
          <span>{released ? `Midnight has arrived in ${region.city}` : `Until midnight in ${region.city}`}</span>
          <span className="gta-live-indicator">Live timer</span>
        </div>
        <div className="gta-digits" role="timer" aria-live="off" aria-label={remaining ? `${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes, ${remaining.seconds} seconds remaining for ${region.city}` : "Loading live countdown"}>
          {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
            <div className="gta-digit" key={unit}><strong>{remaining ? pad(remaining[unit]) : "—"}</strong><span>{unit}</span></div>
          ))}
        </div>
        {released && <p className="gta-unlocked" role="status">Welcome to Leonida. Check your console’s store to play.</p>}
        <div className="gta-region-row">
          <Field className="gta-region-field">
            <Label><Globe2 size={16} aria-hidden="true" /> Countdown region</Label>
            <div className="gta-select-wrap">
              <Select value={zone} onChange={(event) => chooseRegion(event.target.value)}>
                {gtaRegions.map((item) => <option key={item.zone} value={item.zone}>{item.city} · {item.label}</option>)}
              </Select>
              <ChevronDown size={17} aria-hidden="true" />
            </div>
          </Field>
          <p className="gta-unlock-date"><span>19 November 2026</span><strong>12:00 a.m. local time</strong></p>
        </div>
      </div>
      <div className="gta-hero-actions">
        <a href="#release-times" className="button button-primary">Regional release times <ArrowDown size={18} aria-hidden="true" /></a>
        <button type="button" className="gta-share" onClick={share}><Share2 size={18} aria-hidden="true" /> Share countdown</button>
      </div>
      <p className="gta-share-message" role="status">{shareMessage || "Choose the region associated with your console’s store."}</p>
    </>
  );
}

export function GtaRegionalTimes() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, []);
  return (
    <div className="gta-regions-grid">
      {gtaRegions.map((region) => {
        const remaining = now === null ? null : gtaTimeRemaining(region.unlock, now);
        const released = remaining?.total === 0;
        return <a className={`gta-region-card${released ? " is-released" : ""}`} href={`?region=${encodeURIComponent(region.zone)}#top`} key={region.zone}>
          <span className="gta-region-card-top"><strong>{region.city}</strong><ArrowUpRight size={17} aria-hidden="true" /></span>
          <span className="gta-region-label">{region.label}</span>
          <span className="gta-region-status">{released ? <><Check size={16} aria-hidden="true" /> Release time reached</> : remaining ? <><Clock3 size={16} aria-hidden="true" /> {pad(remaining.days * 24 + remaining.hours)}:{pad(remaining.minutes)}:{pad(remaining.seconds)} remaining</> : "Midnight · 19 November"}</span>
        </a>;
      })}
    </div>
  );
}
