import type { Article, ContentSection } from "./articles";

const source = {
  label: "Rockstar Games official GTA VI screenshots",
  href: "https://www.rockstargames.com/VI/media/screenshots",
};
const image = (
  file: string,
  alt: string,
  caption: string,
): NonNullable<ContentSection["image"]> => ({
  src: `/blog/${file}.jpg`,
  alt,
  caption: `${caption} © Rockstar Games.`,
  source,
});

export const gtaMedia = {
  motorcycle: image(
    "gta-6-jason-motorcycle",
    "Jason beside a green sports motorcycle under palm trees in an official GTA VI screenshot.",
    "Jason and a motorcycle.",
  ),
  driving: image(
    "gta-6-jason-driving",
    "Jason seated behind the wheel of a car in an official GTA VI screenshot.",
    "Jason behind the wheel.",
  ),
  lucia: image(
    "gta-6-lucia-training",
    "Lucia throwing a punch during a training session in an official GTA VI screenshot.",
    "Lucia training.",
  ),
  skyline: image(
    "gta-6-vice-city-street",
    "An elevated view of Vice City buildings, roads and outdoor sports courts in an official GTA VI screenshot.",
    "Vice City from above.",
  ),
  friends: image(
    "gta-6-vice-city-friends",
    "Two men posing on a sunny city street in an official GTA VI screenshot.",
    "A Vice City street scene.",
  ),
  roadside: image(
    "gta-6-keys-roadside",
    "People, a bus and an alligator beside roadside businesses in an official GTA VI screenshot.",
    "A roadside scene in Leonida Keys.",
  ),
  motel: image(
    "gta-6-port-gellhorn",
    "A motel sign and buildings at dusk beneath palm trees in an official GTA VI screenshot.",
    "Port Gellhorn at dusk.",
  ),
  bikers: image(
    "gta-6-ambrosia",
    "A group of motorcycle riders on a road through Ambrosia in an official GTA VI screenshot.",
    "Motorcycle riders in Ambrosia.",
  ),
  dirtBikes: image(
    "gta-6-mount-kalaga",
    "Dirt-bike riders on a muddy course near industrial buildings in an official GTA VI screenshot.",
    "Dirt-bike riders.",
  ),
  pair: image(
    "gta-6-jason-lucia",
    "Jason and Lucia overlooking the waterfront in an official GTA VI screenshot.",
    "Jason and Lucia.",
  ),
  vault: image(
    "gta-6-jason-lucia-dock",
    "Jason and Lucia wearing protective vests inside a vault in an official GTA VI screenshot.",
    "Jason and Lucia in Rockstar’s promotional imagery.",
  ),
  balcony: image(
    "gta-6-vice-city-waterfront",
    "Two people on a balcony above palm trees, a pool and the beachfront in an official GTA VI screenshot.",
    "Overlooking the Vice City beachfront.",
  ),
  sign: image(
    "gta-6-vice-city",
    "A passenger plane flying above the Vice City sign at sunset in an official GTA VI screenshot.",
    "The Vice City sign.",
  ),
  keys: image(
    "gta-6-leonida-keys",
    "A seaplane above islands, a long bridge and blue water in an official GTA VI screenshot.",
    "Leonida Keys.",
  ),
  grassrivers: image(
    "gta-6-grassrivers",
    "Three armed characters beside an airboat and an alligator in an official GTA VI screenshot.",
    "Grassrivers.",
  ),
};

export function gtaCover(
  asset: NonNullable<ContentSection["image"]>,
): Pick<Article, "image" | "imageAlt" | "imageCaption" | "imageSource"> {
  return {
    image: asset.src,
    imageAlt: asset.alt,
    imageCaption: asset.caption,
    imageSource: asset.source,
  };
}
