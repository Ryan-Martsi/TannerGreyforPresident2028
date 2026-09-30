/* Tanner Grey for President — site script.
   Pages are hash routes (#home, #platform, #foreign-policy, #newsroom, #article-<id>).
   Articles live in articles.json (and, as a fallback, inline in index.html). */
(() => {
"use strict";

// Where data files live; an embed (e.g. Google Sites) points this at a CDN copy of the site.
const ASSET_BASE = (typeof window.TG_ASSET_BASE === "string") ? window.TG_ASSET_BASE : "";
// Embedded (Google Sites): always the dark navy look, and a slim brand bar instead of the full menu.
if (typeof window.TG_ASSET_BASE === "string") {
  document.documentElement.setAttribute("data-theme", "dark");
  document.documentElement.classList.add("embedded");
}

const C = { first: "Tanner", last: "Grey", party: "Republican", state: "Arkansas", year: "2028" };

/* ------------------------------------------------------------------ utils */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmtDate = (d) => {
  if (!d) return "";
  const t = new Date(d + "T12:00:00");
  return isNaN(t) ? d : t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const paras = (text) => {
  const t = String(text || "").replace(/\r/g, "").trim();
  const parts = /\n\s*\n/.test(t) ? t.split(/\n\s*\n/) : t.split(/\n/);
  return parts.map((p) => p.trim()).filter(Boolean);
};
const excerpt = (text, n = 210) => {
  const t = paras(text).join(" ");
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
};
const slug = (s) => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "article") + "-" + Math.random().toString(36).slice(2, 7);

/* ------------------------------------------------------------------ state */
const state = {
  articles: [],
  updated: 0,
  canEdit: false,
  artifact: null,
  map: { mode: "now", theater: "all", selected: null, layers: { arcs: true, markers: true, corps: true, blocs: true } },
  editingId: null,
};

/* ================================================================== MAP DATA */
const STATUS = {
  home:      { label: "United States",               color: "--m-home" },
  ally:      { label: "Allied coalition",            color: "--m-ally" },
  frontline: { label: "Frontline partner (advanced systems)", color: "--m-frontline" },
  regional:  { label: "Regional partner",            color: "--m-regional" },
  reform:    { label: "Reform partner",              color: "--m-reform" },
  movement:  { label: "U.S.-backed movement",        color: "--m-movement" },
  adversary: { label: "Adversary under pressure",    color: "--m-adversary" },
  proxy:     { label: "Iranian proxy network",       color: "--m-proxy" },
  cleared:   { label: "Proxy network dismantled",    color: "--m-cleared" },
  influence: { label: "Russian / Chinese foothold",  color: "--m-influence" },
  laggard:   { label: "Ally with sanctions gaps",    color: "--m-laggard-b" },
  rival:     { label: "Rival faction (civil war)",   color: "--m-rival" },
  newstate:  { label: "New U.S.-backed state",       color: "--m-newstate" },
  none:      { label: "No active program",           color: "--land" },
};
const THEATERS = {
  all: { label: "Whole world" },
  me:  { label: "Middle East", box: [[24, 8], [66, 42]] },
  af:  { label: "Africa", box: [[-14, -15], [44, 34]] },
  ip:  { label: "Indo-Pacific", box: [[66, -14], [150, 48]] },
  eu:  { label: "Europe & Russia", box: [[-14, 34], [60, 68]] },
};

const EU_ALLY = {
  now: ["ally", "Ally, but relations with Washington are strained and each European government enforces Russia sanctions its own way. The alliance is not acting as one."],
  future: ["ally", "Relations repaired. NATO acts as a single alliance again, with one unified sanctions regime on Russia, stronger European forces and a smaller but steady U.S. presence."],
  tools: ["Repair relations", "Unified sanctions", "Stronger NATO", "China tariff coalition"],
};
const EU_FLANK = {
  now: ["ally", "NATO's eastern flank. Already spending heavily on defense and backing Ukraine, but the alliance behind it is divided."],
  future: ["ally", "Eastern flank secured inside a reunited NATO. A hub for drone co-production and for moving equipment into Ukraine."],
  tools: ["Stronger NATO", "Unified sanctions", "Drone co-production"],
};
const IPTO = "Indo-Pacific Treaty Organization";
const GULF = {
  now: ["regional", "Gulf partner in containing Iran. Shares intelligence, hosts air defense, and helps choke off proxy financing."],
  future: ["regional", "Part of a regional bloc that contains Iran without U.S. ground forces."],
  tools: ["Air defense", "Proxy financing crackdown"],
};

const COUNTRIES = {
  "840": { name: "United States", th: "am",
    now: ["home", "The production base for the Grey Doctrine: Rust Belt munitions and drone lines, expanded domestic drilling, and new oil transport capacity."],
    future: ["home", "Thousands of new manufacturing and energy jobs. American drone and munitions factories supply every partner on this map."],
    tools: ["Drone mass production", "Munitions jobs", "Energy expansion"] },
  "124": { name: "Canada", th: "am", now: ["ally", "Treaty ally and energy partner. Joins the allied tariff coalition on China."], future: ["ally", "Core member of the allied tariff coalition."], tools: ["China tariff coalition"] },

  // Europe
  "826": { name: "United Kingdom", th: "eu", ...EU_ALLY }, "250": { name: "France", th: "eu", ...EU_ALLY },
  "276": { name: "Germany", th: "eu", ...EU_ALLY }, "380": { name: "Italy", th: "eu", ...EU_ALLY },
  "724": { name: "Spain", th: "eu", ...EU_ALLY }, "620": { name: "Portugal", th: "eu", ...EU_ALLY },
  "528": { name: "Netherlands", th: "eu", ...EU_ALLY }, "056": { name: "Belgium", th: "eu", ...EU_ALLY },
  "442": { name: "Luxembourg", th: "eu", ...EU_ALLY }, "208": { name: "Denmark", th: "eu", ...EU_ALLY },
  "578": { name: "Norway", th: "eu", ...EU_ALLY }, "752": { name: "Sweden", th: "eu", ...EU_ALLY },
  "352": { name: "Iceland", th: "eu", ...EU_ALLY }, "372": { name: "Ireland", th: "eu", ...EU_ALLY },
  "040": { name: "Austria", th: "eu", ...EU_ALLY }, "196": { name: "Cyprus", th: "eu", ...EU_ALLY },
  "300": { name: "Greece", th: "eu", ...EU_ALLY }, "191": { name: "Croatia", th: "eu", ...EU_ALLY },
  "705": { name: "Slovenia", th: "eu", ...EU_ALLY }, "008": { name: "Albania", th: "eu", ...EU_ALLY },
  "499": { name: "Montenegro", th: "eu", ...EU_ALLY }, "807": { name: "North Macedonia", th: "eu", ...EU_ALLY },
  "203": { name: "Czechia", th: "eu", ...EU_ALLY }, "100": { name: "Bulgaria", th: "eu", ...EU_ALLY },
  "616": { name: "Poland", th: "eu", ...EU_FLANK }, "233": { name: "Estonia", th: "eu", ...EU_FLANK },
  "428": { name: "Latvia", th: "eu", ...EU_FLANK }, "440": { name: "Lithuania", th: "eu", ...EU_FLANK },
  "246": { name: "Finland", th: "eu", ...EU_FLANK }, "642": { name: "Romania", th: "eu", ...EU_FLANK },
  "348": { name: "Hungary", th: "eu",
    now: ["laggard", "Has repeatedly slowed or watered down EU sanctions on Russia. Grey policy: enforce them, or face U.S. tariffs and the withdrawal of U.S. forces."],
    future: ["ally", "Sanctions enforced in full after U.S. tariff and basing pressure."],
    tools: ["Tariff threat", "Troop withdrawal threat"] },
  "703": { name: "Slovakia", th: "eu",
    now: ["laggard", "Has resisted parts of the EU sanctions regime on Russia. Faces the same choice: comply, or lose U.S. forces and trade access."],
    future: ["ally", "Back in line with the full sanctions regime."],
    tools: ["Tariff threat", "Troop withdrawal threat"] },
  "792": { name: "Turkey", th: "me",
    now: ["ally", "NATO ally and key partner in Libya, where Turkish and U.S. support backs the Tripoli-based forces against the Russian-backed army in the east."],
    future: ["ally", "Co-guarantor of a unified Libya and a check on Russia in the Black Sea and Mediterranean."],
    tools: ["Libya coordination"] },
  "804": { name: "Ukraine", th: "eu",
    now: ["frontline", "Direct U.S. military aid restarts: Patriot batteries, near-retired U.S. fighter jets, and FPV drones and ground robots at scale. Americans may serve through the Volunteer Corps."],
    future: ["frontline", "Russia's offensive broken. Ukraine holds a defensible line backed by its own drone industry and Western air defense."],
    tools: ["Patriot missiles", "Retired fighter jets", "FPV drones", "UGVs", "Volunteer Corps"] },
  "643": { name: "Russia", th: "eu",
    now: ["adversary", "Direct pressure through sanctions that Europe must actually enforce. Indirect pressure by defeating Russia's proxies and Africa Corps deployments across Africa."],
    future: ["adversary", "Economy strained by fully enforced sanctions, African footholds lost, war aims in Ukraine abandoned."],
    tools: ["Sanctions", "Defeat proxies in Africa"] },
  "112": { name: "Belarus", th: "eu", now: ["adversary", "Russian client state. Covered by the same sanctions regime."], future: ["adversary", "Isolated alongside Russia."], tools: ["Sanctions"] },

  // Middle East
  "364": { name: "Iran", th: "me",
    now: ["adversary", "Cold War containment. Phase one: dismantle the proxy network (the Houthis, Hezbollah, and Iraqi militias). Phase two: turn maximum economic pressure on Tehran itself. No U.S. invasion."],
    future: ["adversary", "Proxy network gone, oil revenue squeezed, isolated in its own region. The nuclear option is off the table."],
    tools: ["Proxy strikes", "Economic pressure", "Sanctions", "Allied coordination"] },
  "887": { name: "Yemen", th: "me",
    now: ["proxy", "The Houthis: Iran's missile and drone arm on the Red Sea. Targeted by sustained U.S. and allied airstrikes."],
    future: ["cleared", "Houthi missile and drone capability destroyed. Red Sea shipping restored."],
    tools: ["Airstrikes", "Arms interdiction"] },
  "422": { name: "Lebanon", th: "me",
    now: ["proxy", "Hezbollah: Iran's most capable proxy. Hit by allied strikes, weapons interdiction, and financial sanctions."],
    future: ["cleared", "Hezbollah disarmed. The Lebanese state controls its own territory."],
    tools: ["Allied strikes", "Financial sanctions"] },
  "368": { name: "Iraq", th: "me",
    now: ["proxy", "Iran-aligned militias are targeted with precision strikes while Baghdad is pushed toward real anti-corruption reform."],
    future: ["cleared", "Militias demobilized. The government in Baghdad no longer answers to Tehran."],
    tools: ["Precision strikes", "Anti-corruption compact"] },
  "682": { name: "Saudi Arabia", th: "me",
    now: ["regional", "Key partner. Resources wasted on open-ended Middle East fighting are redirected to arm and support Saudi Arabia against Iranian aggression."],
    future: ["regional", "Anchors a regional coalition that contains Iran with no U.S. ground troops."],
    tools: ["Arms sales", "Air defense", "Intelligence sharing"] },
  "376": { name: "Israel", th: "me",
    now: ["regional", "Partner in the campaign against Iranian proxies: coordinated strikes and missile defense."],
    future: ["regional", "Northern and southern borders secured as Hezbollah and the Houthis fall."],
    tools: ["Coordinated strikes", "Missile defense"] },
  "784": { name: "United Arab Emirates", th: "me", ...GULF }, "634": { name: "Qatar", th: "me", ...GULF },
  "414": { name: "Kuwait", th: "me", ...GULF }, "512": { name: "Oman", th: "me", ...GULF },
  "400": { name: "Jordan", th: "me", ...GULF }, "818": { name: "Egypt", th: "me", ...GULF },

  // Africa
  "466": { name: "Mali", th: "af",
    now: ["influence", "The military government in Bamako depends on Russia's Africa Corps. In the north, Tuareg fighters of the FLA contest the junta's control. The U.S. backs the Tuareg movement to break the Russian foothold."],
    future: ["reform", "Mali splits in two. The south stays a separate state under a government that has expelled Russian forces and signed an anti-corruption compact. The north becomes the independent Tuareg state of Azawad."],
    tools: ["Support to Tuareg movement", "Volunteer Corps", "Anti-corruption compact"] },
  "562": { name: "Niger", th: "af",
    now: ["influence", "Expelled U.S. forces and turned to Moscow. Tuareg communities in the north are natural partners."],
    future: ["reform", "Reform partner. A Sahel Volunteer Corps presence helps counter jihadist groups."],
    tools: ["Support to Tuareg movement", "Volunteer Corps"] },
  "854": { name: "Burkina Faso", th: "af",
    now: ["influence", "Military government aligned with Moscow."],
    future: ["reform", "Breaks with Russia to gain a U.S. security and reform partnership."],
    tools: ["Anti-corruption compact"] },
  "140": { name: "Central African Republic", th: "af",
    now: ["influence", "Russian mercenaries guard the government and its mines. The U.S. supports the anti-Russian armed forces in the north and west that are fighting them."],
    future: ["reform", "Russian forces driven out with the help of U.S.-backed fighters. A new government audits mining revenues under the reform compact."],
    tools: ["Support to anti-Russian forces", "Volunteer Corps", "Anti-corruption compact"] },
  "434": { name: "Libya", th: "af",
    now: ["influence", "Split by civil war. The Russian-backed Libyan National Army holds the east and south. The U.S. backs the Turkish-supported government in Tripoli (the west) against it."],
    future: ["reform", "Reunified under the Tripoli-aligned government. Russian bases on the Mediterranean closed."],
    tools: ["Coordination with Turkey", "Arms", "Volunteer Corps"] },
  "729": { name: "Sudan", th: "af",
    now: ["reform", "Split by civil war. The official government (SAF) holds the north, east and Khartoum. The RSF militia holds Darfur and much of Kordofan. The U.S. backs the official government, tied to anti-corruption reform, and denies Russia its planned Red Sea base."],
    future: ["reform", "Reunified. The war ends with the recognized government in control of the whole country and no Russian base on the Red Sea."],
    tools: ["Arms", "Volunteer Corps", "Anti-corruption compact"] },
  "646": { name: "Rwanda", th: "af",
    now: ["reform", "Close partner. The U.S. supports the Greater Rwanda movement and Rwanda's role in eastern Congo as a counterweight to Chinese mining influence."],
    future: ["newstate", "Greater Rwanda: Rwanda united with North and South Kivu. The anchor of U.S. influence in the Great Lakes and a training hub for the Volunteer Corps."],
    tools: ["Security partnership", "Volunteer Corps", "Anti-corruption compact"] },
  "180": { name: "Congo (Kinshasa)", th: "af",
    now: ["none", "A corrupt central government in Kinshasa that has lost the east. Rwanda-backed forces hold Goma and Bukavu. The U.S. supports the Greater Rwanda movement and the autonomy movements in the south as leverage against Chinese control of cobalt."],
    future: ["none", "Fractured. Kinshasa keeps the west and center. The Kivus join Greater Rwanda, and Katanga becomes an independent state that ends China's mining monopoly."],
    tools: ["Support to movements", "Critical minerals"] },

  // Indo-Pacific
  "156": { name: "China", th: "ip",
    now: ["adversary", "An allied tariff coalition. Unlike past go-it-alone tariffs, the U.S. coordinates with Europe, Japan, Korea and others so China cannot route around them."],
    future: ["adversary", "Faces a unified tariff wall and is ringed by the " + IPTO + ", a Pacific NATO. Taiwan deterred. African mining leverage reduced."],
    tools: ["Coalition tariffs", "Pacific alliance", "Taiwan deterrence"] },
  "158": { name: "Taiwan (ROC)", th: "ip",
    now: ["frontline", "Top priority for advanced systems: Patriot batteries, near-retired U.S. fighter jets, and mass deliveries of drones and drone boats."],
    future: ["frontline", "A porcupine defense inside the " + IPTO + ". An amphibious invasion is no longer militarily credible."],
    tools: ["Patriot missiles", "Retired fighter jets", "Drone boats", "Pacific alliance"] },
  "410": { name: "South Korea", th: "ip",
    now: ["ally", "U.S. ally, but tied to Washington only through a separate bilateral treaty."],
    future: ["ally", "Founding member of the " + IPTO + ". Co-produces munitions and anchors deterrence against North Korea."],
    tools: ["Pacific alliance", "China tariff coalition"] },
  "392": { name: "Japan", th: "ip",
    now: ["ally", "Closest U.S. ally in Asia, but with no collective defense pact across the region."],
    future: ["ally", "Co-leads the " + IPTO + " and the tariff coalition. Co-produces drones and air defense."],
    tools: ["Pacific alliance", "China tariff coalition", "Co-production"] },
  "036": { name: "Australia", th: "ip", now: ["ally", "Treaty ally in the Pacific."], future: ["ally", "Founding member of the " + IPTO + " and drone-boat co-producer."], tools: ["Pacific alliance"] },
  "554": { name: "New Zealand", th: "ip", now: ["ally", "Pacific partner."], future: ["ally", "Member of the " + IPTO + "."], tools: ["Pacific alliance"] },
  "608": { name: "Philippines", th: "ip", now: ["ally", "South China Sea frontline and treaty ally."], future: ["ally", "Member of the " + IPTO + ". Coastal defense built on U.S. drone boats."], tools: ["Pacific alliance", "Drone boats"] },
  "360": { name: "Indonesia", th: "ip",
    now: ["none", "Southeast Asia's largest country. Officially non-aligned."],
    future: ["ally", "Brought into the " + IPTO + " to guard the straits between the Pacific and Indian Oceans."],
    tools: ["Pacific alliance"] },
  "764": { name: "Thailand", th: "ip",
    now: ["none", "An old U.S. treaty ally that has drifted toward Beijing."],
    future: ["ally", "Relationship rebuilt. Member of the " + IPTO + "."],
    tools: ["Pacific alliance"] },
  "704": { name: "Vietnam", th: "ip",
    now: ["none", "A former adversary, wary of China but outside any alliance."],
    future: ["ally", "A historic turn: Vietnam joins the " + IPTO + " and becomes a key alternative supply chain to China."],
    tools: ["Pacific alliance", "China tariff coalition"] },
  "408": { name: "North Korea", th: "ip", now: ["adversary", "Deterred through the alliance with South Korea."], future: ["adversary", "Contained by the " + IPTO + "."], tools: ["Deterrence"] },
  "356": { name: "India", th: "ip",
    now: ["none", "Not yet part of a coordinated effort on China."],
    future: ["ally", "Joins the allied tariff coalition as manufacturing moves out of China."],
    tools: ["China tariff coalition"] },
  "104": { name: "Myanmar", th: "ip",
    now: ["movement", "The U.S. arms the resistance against the military junta directly: drones, artillery, and supplies."],
    future: ["reform", "The junta collapses. A federal transitional government ends China's hold on Myanmar's routes to the Indian Ocean."],
    tools: ["FPV drones", "Artillery", "Direct support"] },
};

/* Sub-national areas, drawn on top of their country and clipped to its outline.
   Rings are rough [lon, lat] outlines; the clip trims anything past the border.
   `now` / `future`: status in that view, or null when the area is not drawn. */
const REGIONS = [
  { id: "fla", country: "466", name: "FLA-contested north", label: "FLA", labelAt: [1.2, 19.3],
    ring: [[-1, 21.5], [4.8, 21.5], [4.8, 16.8], [-1, 16.8]],
    now: "movement", future: null,
    textNow: "Tuareg fighters of the Azawad Liberation Front (FLA) contest the junta's control of the far north around Kidal." },
  { id: "azawad", country: "466", name: "Azawad", label: "AZAWAD", labelAt: [-1.2, 19.6],
    ring: [[-6.5, 25.5], [5.5, 25.5], [5.5, 14.9], [0.6, 14.9], [-2.2, 15.4], [-4.8, 15.7], [-6.5, 16.1]],
    now: null, future: "newstate",
    textFuture: "An independent Tuareg state covering the Kidal, Gao, Timbuktu and Ménaka regions of northern Mali. Russia's Africa Corps expelled." },
  { id: "m23", country: "180", name: "Rwanda-backed eastern Congo", label: "M23 / AFC", labelAt: [27.2, -2.4],
    ring: [[28.1, -0.5], [31, -0.5], [31, -3.1], [28.5, -3.1], [28.0, -2.0]],
    now: "movement", future: null,
    textNow: "Territory held by the Rwanda-backed M23 / AFC, including Goma and Bukavu. The seed of the Greater Rwanda movement." },
  { id: "kivu", country: "180", name: "Greater Rwanda (Kivu)", label: "GREATER RWANDA", labelAt: [27.6, -1.0],
    ring: [[27.2, 1.2], [31, 1.2], [31, -5.3], [27.1, -5.3], [26.4, -3.4], [26.7, -0.8]],
    now: null, future: "newstate",
    textFuture: "North and South Kivu join Rwanda to form Greater Rwanda, a U.S.-aligned state in the Great Lakes." },
  { id: "katanga", country: "180", name: "Katanga", label: "KATANGA", labelAt: [25.6, -8.6],
    ring: [[22.2, -5.3], [31, -5.3], [31, -14], [22.2, -14]],
    now: null, future: "newstate",
    textFuture: "An independent Katanga in Congo's copper and cobalt belt. Chinese mining monopolies broken and contracts opened to U.S. and allied firms." },
  { id: "gnu", country: "434", name: "Tripoli government (GNU)", label: "GNU", labelAt: [12.4, 31.2],
    ring: [[8, 34.5], [15.9, 34.5], [15.9, 29.6], [13.2, 29.3], [9.6, 29.3], [8, 30.2]],
    now: "reform", future: null,
    textNow: "The internationally recognized Government of National Unity in Tripoli, backed by Turkey and the U.S. The rest of Libya is held by the Russian-backed LNA." },
  { id: "rsf", country: "729", name: "RSF-held Darfur & Kordofan", label: "RSF", labelAt: [25.2, 13.8],
    ring: [[21, 24], [24.2, 20.1], [27.6, 16.2], [28.4, 14.2], [29.9, 13.3], [29.9, 10], [27, 8.8], [21, 8.8]],
    now: "rival", future: null,
    textNow: "The Rapid Support Forces militia holds all of Darfur and much of Kordofan, fighting the official government. Front line approximate." },
];
const REGION_LABELS_NOW = { "434": ["LNA", [20.5, 27.8]], "729": ["SAF", [32.8, 17.4]] };

/* Alliance outlines. */
const NATO_IDS = ["840", "124", "826", "250", "276", "380", "724", "620", "528", "056", "442", "208", "578", "752", "246", "233", "428", "440", "616", "203", "703", "348", "642", "100", "300", "191", "705", "008", "499", "807", "352", "792"];
const IPTO_IDS = ["158", "410", "392", "608", "360", "704", "764", "036", "554"];

const MARKERS = [
  // U.S.-backed movements
  { id: "car-rebels", kind: "movement", th: "af", name: "Anti-Russian forces · CAR", ll: [21.2, 8.2], country: "140",
    now: "Armed groups in the north and west fighting the Russian mercenaries who guard the government. Receive U.S. support.", future: "Russian forces driven out of the country." },
  { id: "myanmar", kind: "movement", th: "ip", name: "Myanmar resistance", ll: [95.9, 22.0], country: "104",
    now: "Resistance forces fighting the junta. Receive U.S. drones and artillery directly.", future: "Resistance coalition leads the federal transition." },
  // Iranian proxies
  { id: "houthis", kind: "proxy", th: "me", name: "Houthis", ll: [44.19, 15.37], country: "887", gone: true,
    now: "Iran-backed. Attacks Red Sea shipping. Primary strike target.", future: "Dismantled." },
  { id: "hezbollah", kind: "proxy", th: "me", name: "Hezbollah", ll: [35.5, 33.3], country: "422", gone: true,
    now: "Iran's most capable proxy. Targeted by allied strikes and sanctions.", future: "Disarmed." },
  { id: "militias", kind: "proxy", th: "me", name: "Iraqi militias", ll: [44.4, 33.3], country: "368", gone: true,
    now: "Iran-aligned militias. Precision strike targets.", future: "Demobilized." },
  // Russian presence
  { id: "bamako", kind: "russia", th: "af", name: "Africa Corps · Bamako", ll: [-8.0, 12.64], country: "466", gone: true,
    now: "Russian forces propping up Mali's junta.", future: "Withdrawn." },
  { id: "bangui", kind: "russia", th: "af", name: "Africa Corps · Bangui", ll: [18.56, 4.36], country: "140", gone: true,
    now: "Russian forces guarding the government and mines.", future: "Withdrawn." },
  { id: "benghazi", kind: "russia", th: "af", name: "Russian-backed LNA", ll: [20.07, 32.1], country: "434", gone: true,
    now: "Eastern Libyan army backed by Russia.", future: "Folded into a unified Libya." },
  { id: "portsudan", kind: "russia", th: "af", name: "Planned Russian base", ll: [37.2, 19.6], country: "729", gone: true,
    now: "Russia's planned Red Sea naval base.", future: "Plans cancelled." },
  // Chinese presence
  { id: "djibouti", kind: "china", th: "af", name: "Chinese base · Djibouti", ll: [43.15, 11.59],
    now: "China's first overseas military base.", future: "Still present, now surrounded by U.S. partners." },
  { id: "kolwezi", kind: "china", th: "af", name: "Chinese cobalt mines", ll: [25.47, -10.71], country: "180", gone: true,
    now: "Chinese firms control most Congolese cobalt.", future: "Monopoly broken." },
  // Volunteer Corps
  { id: "vc-ukraine", kind: "corps", th: "eu", name: "Volunteer Corps · Ukraine", ll: [37.0, 48.3], country: "804",
    now: "Volunteer Americans serving at premium pay.", future: "Volunteer Americans serving at premium pay." },
  { id: "vc-rwanda", kind: "corps", th: "af", name: "Volunteer Corps · Rwanda", ll: [30.06, -1.95], country: "646",
    now: "Training hub for the Great Lakes.", future: "Training hub for the Great Lakes." },
  { id: "vc-sahel", kind: "corps", th: "af", name: "Volunteer Corps · Sahel", ll: [2.11, 13.51], country: "562",
    now: "Counter-Russia and counter-jihadist mission.", future: "Counter-jihadist mission." },
  { id: "vc-sudan", kind: "corps", th: "af", name: "Volunteer Corps · Sudan", ll: [32.56, 15.5], country: "729",
    now: "Supports the recognized government.", future: "Stabilization mission." },
  { id: "vc-libya", kind: "corps", th: "af", name: "Volunteer Corps · Libya", ll: [13.19, 32.89], country: "434",
    now: "Works alongside Turkish-backed forces.", future: "Stabilization mission." },
];
const MARKER_KIND = {
  movement: { label: "U.S.-backed movement", color: "--m-movement" },
  proxy:    { label: "Iranian proxy", color: "--m-proxy" },
  russia:   { label: "Russian presence", color: "--m-influence" },
  china:    { label: "Chinese presence", color: "--m-adversary" },
  corps:    { label: "Volunteer Corps", color: "--m-frontline" },
};
const DC = [-77.03, 38.9];
const ARCS = [
  { to: [30.52, 50.45], label: "Ukraine: Patriots, fighter jets, drones, UGVs" },
  { to: [121.56, 25.03], label: "Taiwan: Patriots, fighter jets, drone boats" },
  { to: [96.1, 21.9], label: "Myanmar resistance: drones, artillery" },
  { to: [46.68, 24.71], label: "Saudi Arabia: air defense, arms" },
  { to: [30.06, -1.95], label: "Rwanda: security partnership" },
  { to: [32.56, 15.5], label: "Sudan: arms to the recognized government" },
  { to: [13.19, 32.89], label: "Libya: arms, with Turkey" },
];

/* ================================================================== LAYOUT */
const NAV = [
  ["home", "Home"],
  ["platform", "Platform"],
  ["foreign-policy", "Foreign Policy"],
  ["newsroom", "Newsroom"],
];

function header(route) {
  const base = route.split("-")[0] === "article" ? "newsroom" : route.startsWith("platform") ? "platform" : route.startsWith("foreign-policy") ? "foreign-policy" : route;
  return `
  <div class="tricolor" aria-hidden="true"></div>
  <header class="masthead">
    <div class="wrap">
      <a class="brand" href="#home" aria-label="${esc(C.first)} ${esc(C.last)} ${C.year} home">
        <span class="name">GREY</span><span class="star" aria-hidden="true">★</span><span class="year">${C.year}</span>
      </a>
      <button class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="nav">Menu</button>
      <nav class="nav" id="nav">
        ${NAV.map(([r, l]) => `<a href="#${r}" ${base === r ? 'aria-current="page"' : ""}>${l}</a>`).join("")}
        <a class="cta" href="#foreign-policy-map" ${route === "foreign-policy-map" ? 'aria-current="page"' : ""}>The Grey Doctrine</a>
      </nav>
    </div>
  </header>`;
}

function footer() {
  return `
  <footer class="footer">
    <div class="wrap">
      <div>
        <div class="big">${esc(C.first)} ${esc(C.last)}<br>for President</div>
        <div class="paid">Paid for by Grey ${C.year}</div>
        <small>Constitution · Character · Community. An AP Government &amp; Politics campaign project.</small>
      </div>
      <nav aria-label="Footer">
        ${NAV.map(([r, l]) => `<a href="#${r}">${l}</a>`).join("")}
      </nav>
    </div>
  </footer>`;
}

/* ================================================================== HOME */
function pageHome() {
  const latest = sortedArticles().slice(0, 3);
  const byC = issuesByC();
  const cLinks = (k) => `<div class="c-links"><span class="eyebrow">In the platform</span>${byC[k].map((i) => `<a href="#platform-${i.id}">${esc(i.title)}</a>`).join("")}</div>`;
  return `
  <section class="hero">
    <div class="wrap">
      <div>
        <div class="eyebrow">${esc(C.party)} candidate for President · ${esc(C.state)}</div>
        <h1>${esc(C.first)}<br><span class="last">${esc(C.last)}</span></h1>
        <p class="lede"><strong>Constitution. Character. Community.</strong> A worker-first America that keeps the founders' limits on Washington and puts the country's resources back into its people.</p>
        <div class="actions">
          <a class="btn btn-red" href="#platform">Read the platform</a>
          <a class="btn btn-ghost-light" href="#foreign-policy-map">Explore the world map</a>
        </div>
      </div>
      <aside class="hero-card" aria-label="Campaign commitments">
        <div class="label">Three commitments</div>
        <div class="row"><div class="big">0%</div><p>Federal income tax for the bottom 50% of earners, paid for by higher rates at the top.</p></div>
        <div class="row"><div class="big">3 C's</div><p>Constitution, Character and Community: the test every Grey policy has to pass.</p></div>
        <div class="row"><div class="big">0</div><p>New mass troop deployments. American strength through partners, production and pressure.</p></div>
      </aside>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">The foundation</div>
        <h2>The 3 C's of America</h2>
        <p>Every part of this campaign starts from three commitments that the founders would recognize and working families can feel. Every domestic policy is built to serve at least one of them.</p>
      </div>
      <div class="three-c">
        <article>
          <div class="c" aria-hidden="true">C</div>
          <h3>Constitution</h3>
          <p>Targeted amendments that modernize specific limits on government: curb the expansion of federal power and put term limits on Congress. Keep government out of the individual's own choices.</p>
          ${cLinks("constitution")}
        </article>
        <article>
          <div class="c" aria-hidden="true">C</div>
          <h3>Character</h3>
          <p>Public service stripped of self-interest. A return to civic virtue, carrying forward the legacy of the founding fathers. End corruption and favoritism wherever they hide.</p>
          ${cLinks("character")}
        </article>
        <article>
          <div class="c" aria-hidden="true">C</div>
          <h3>Community</h3>
          <p>The power of the people. Local governments, not distant federal agencies, should set local social and educational standards. Protect and rebuild the communities Americans share.</p>
          ${cLinks("community")}
        </article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap statement">
      <blockquote>A different kind of Republican: <em>constitutional</em> in principle, <em>worker-first</em> in practice.</blockquote>
      <div class="body">
        <p>Some in my own party call this platform un-Republican. I call it conservative in the oldest sense: a limited federal government, strong local communities, and an economy where the people who do the work share in what it builds.</p>
        <p>That means <strong>no federal income tax for the bottom half of earners</strong>, higher rates on the very wealthy, real investment in American energy and manufacturing, and <strong>a secure border enforced humanely</strong>. Abroad, it means <strong>ending wars that waste American lives</strong> and competing with China and Russia where the next decade will actually be decided.</p>
        <p>— ${esc(C.first)} ${esc(C.last)}</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">The platform</div>
        <h2>Priorities</h2>
      </div>
      <div class="priorities">
        ${[
          ["platform-taxes", "Economy · Community", "Zero income tax for the bottom 50%", "Tax the top 1% more and close their loopholes so working families can keep their whole paycheck."],
          ["platform-healthcare", "Healthcare · Constitution", "Break up the medical monopolies", "Cut the regulations that block competitors so medicine and insurance cost what they do in the rest of the world."],
          ["platform-border", "Border · Community", "A secure border, no wall", "Rapid-response teams and drones that catch more crossings and save lives. Deportations continue, humanely."],
          ["platform-trusted-worker", "Immigration · Character", "The Trusted Worker Program", "Five-year approved work terms for the workers our farms need, tracked so lawbreakers are removed."],
          ["platform-defense-spending", "Defense · Character", "Stop paying $1,000 for a $1 part", "Cut contractor waste, not troops, and put the savings into drones and new Rust Belt factories."],
          ["platform-second-chance", "Opportunity · Community", "Second Chance Communities", "Factories, jobs and better schools for cities like Detroit, rebuilt one community at a time."],
          ["platform-choice", "Liberty · Constitution", "Your body, your choice", "No government owns your body. Pro-choice within a reasonable time limit."],
          ["foreign-policy", "Security", "The Grey Doctrine", "Partners, production and pressure instead of mass deployments."],
        ].map(([href, tag, h, p]) => `
          <a class="priority" href="#${href}">
            <span class="tag">${tag}</span>
            <h3>${h}</h3>
            <p>${p}</p>
            <span class="more">Read more →</span>
          </a>`).join("")}
      </div>
    </div>
  </section>

  <section class="doctrine-band">
    <div class="wrap">
      <div>
        <div class="eyebrow">Foreign policy</div>
        <h2>See the world after four years of the Grey Doctrine</h2>
        <p>An interactive map of every theater: Iran's proxy network, the pivot to Africa, the Indo-Pacific, and Europe. Switch between today and the campaign's projection for 2032.</p>
      </div>
      <a class="btn btn-red" href="#foreign-policy-map">Open the map</a>
    </div>
  </section>

  ${latest.length ? `<section class="section">
    <div class="wrap">
      <div class="news-top">
        <div class="section-head" style="margin:0">
          <div class="eyebrow">In the press</div>
          <h2>Latest coverage</h2>
        </div>
        <a class="btn btn-line" href="#newsroom">All articles</a>
      </div>
      <div class="news-cards">${latest.map(cardHTML).join("")}</div>
    </div>
  </section>` : ""}`;
}

// Articles with no body text are links to coverage published on another site.
const isExternal = (a) => !String(a.body || "").trim() && /^https?:\/\//i.test(a.link || "");
const articleLinkAttrs = (a) => isExternal(a)
  ? `href="${esc(a.link)}" target="_blank" rel="noopener"`
  : `href="#article-${esc(a.id)}"`;

function cardHTML(a) {
  return `
  <a class="news-card" ${articleLinkAttrs(a)}>
    <div class="meta"><span class="outlet">${esc(a.outlet || "Press")}</span> · ${esc(fmtDate(a.date))}</div>
    <h3>${esc(a.title)}</h3>
    <p>${esc(a.summary || excerpt(a.body, 150))}</p>
  </a>`;
}

/* ================================================================== PLATFORM */
const THREE_CS = {
  constitution: { label: "Constitution", short: "Limits on government, rights of the individual" },
  character: { label: "Character", short: "Public service without self-interest" },
  community: { label: "Community", short: "The power of the people, close to home" },
};

function platformGroups() {
  return [
    { name: "The Foundation", issues: [
      { id: "constitution", eyebrow: "Constitution · Character · Community", title: "The 3 C's",
        intro: "Every domestic policy in this campaign is measured against three commitments. If a policy doesn't strengthen at least one of them, it doesn't belong in this platform. Look for the 3 C's box on every issue below.",
        custom: threeCsDetail() },
    ] },
    { name: "Economy", issues: [
      { id: "growth", eyebrow: "The big picture", title: "The Worker-First Growth Plan",
        intro: "Every economic policy in this campaign works toward the same goal: put money back in working families' pockets, clear the way for competition, and turn wasted federal dollars into American jobs.",
        custom: growthDiagram(),
        note: "The campaign expects the federal deficit to rise at first. Grey's position is that the faster growth and new jobs these policies create will far outweigh the revenue lost to tax cuts.",
        cs: [["community", "Wealth that stays in working families' hands gets spent in their own towns, on their own Main Streets."], ["constitution", "Growth comes from free people and free markets, not from Washington planning the economy."]] },
      { id: "taxes", eyebrow: "Taxes", title: "Zero Income Tax for Half the Country",
        intro: "The bottom half of American earners spend almost every dollar they make, in their own communities. Letting them keep it is the fastest way to grow the economy from the ground up.",
        plan: [
          ["Eliminate it for the bottom 50%", "No federal income tax for the bottom half of American earners."],
          ["Tax the top 1% more", "Raise income taxes on the wealthiest 1% of individuals."],
          ["Close their loopholes", "Shut the loopholes that let the very wealthy pay a lower effective rate than working families."],
          ["Why it works", "Families who keep more of their paycheck spend it, which grows the economy faster, creates jobs, and eases the cost-of-living burden."],
        ],
        note: "Some traditional Republicans have called this plan un-Republican. The campaign's answer: a fair tax code for working families and a limited government are part of the same fight.",
        cs: [["community", "A paycheck spent at the local hardware store or diner rebuilds the community around it."], ["character", "Loopholes written for the well-connected are self-interest dressed up as policy. Everyone pays their fair share."]] },
      { id: "healthcare", eyebrow: "Healthcare", title: "Break Up the Medical Monopolies",
        intro: "Americans pay far more for medicine and insurance than the rest of the world. Much of that comes from regulations that serve no purpose except keeping competitors out and protecting companies the government favors.",
        plan: [
          ["Cut the barriers to entry", "Remove unnecessary medical regulations whose only real effect is to block new competitors."],
          ["End government favoritism", "Stop protecting incumbent drug and insurance companies from competition."],
          ["Let competitors in", "More competition brings the price of medicine down toward what the rest of the world pays, and brings insurance costs down with it."],
          ["Break them up if needed", "If monopolies persist, the government will step in directly: first with the threat of breaking them up, and then by actually breaking them up. That is the last resort."],
        ],
        callout: ["Who benefits most", "Lower drug and insurance prices overwhelmingly help the poor and the working class, who spend the largest share of their income on healthcare."],
        cs: [["constitution", "Government's job is to protect fair competition, not to pick winners and shield them from it."], ["character", "Rules written to protect incumbents serve their self-interest, not the patient's."]] },
      { id: "business", eyebrow: "Business & regulation", title: "Free the Small Business",
        intro: "Many regulations were written by and for the largest companies, because they can afford to comply and their smaller competitors can't. Clearing them out brings competition back.",
        plan: [
          ["Cut corporate taxes", "Lower corporate tax rates to encourage investment and hiring here at home."],
          ["Deregulate", "Loosen regulation across the economy, starting with the rules that mainly benefit large companies."],
          ["Room to grow", "Give small and medium-sized businesses the opportunity to compete and grow."],
          ["Revive local economies", "New businesses help struggling local economies, like those in the Rust Belt, recover from decades of decline."],
        ],
        cs: [["constitution", "A smaller federal rulebook is a direct check on federal expansion."], ["community", "Locally owned businesses are the backbone of every American town."]] },
      { id: "defense-spending", eyebrow: "Defense spending", title: "Stop Paying $1,000 for a $1 Part",
        intro: "The military budget can shrink without shrinking the military. Not one service member is cut. The savings come from the contractors and outdated programs.",
        stat: ["10× to 1,000×+", "What the Pentagon has been overcharged for some goods compared to what they are actually worth."],
        plan: [
          ["Keep every service member", "Spending cuts come from procurement, not personnel."],
          ["Drop outdated programs", "Move money away from overpriced, outdated systems that mostly enrich government contractors."],
          ["Build what matters", "Put that money into the drones, ground robots and drone boats that are winning today's wars."],
          ["End contractor price-gouging", "Root out waste and corruption in military purchasing so the armed forces cost far less."],
          ["Modernize", "A leaner budget that still keeps the U.S. military the strongest in the world and ready for the future."],
        ],
        cs: [["character", "Overcharging the taxpayer for the nation's defense is the clearest case of self-interest in public service. It ends."]] },
      { id: "industry", eyebrow: "Jobs", title: "Rebuild the Rust Belt",
        intro: "The money saved from defense waste pays for new military factories in the Rust Belt. In the long run the factories more than pay for themselves.",
        plan: [
          ["New factories", "Open new drone and munitions plants in Rust Belt towns, including majority-Black cities like Detroit, with money saved from defense waste."],
          ["Guaranteed jobs", "These factories guarantee jobs to Americans in the regions that need them most."],
          ["Stable recovery", "Steady defense demand brings a lasting, stable economic recovery instead of a short boom."],
          ["Strength at home and abroad", "The same factories arm our allies, so American-made systems do the job that American troops used to do."],
        ],
        link: ["platform-second-chance", "See the Second Chance Communities plan →"],
        cs: [["community", "A factory job gives a whole neighborhood a reason to stay, build and raise families."]] },
      { id: "energy", eyebrow: "Energy", title: "American Energy, Lower Prices",
        intro: "Oil prices hit every family through the gas pump and the grocery bill. America has the resources to stabilize them.",
        plan: [
          ["Increase drilling", "Expand domestic oil production."],
          ["Invest in transport", "Build the pipelines, rail and terminals needed to move American oil and stabilize prices across the whole country."],
          ["Jobs at every step", "New jobs in production and in transport, helping families nationwide."],
        ],
        cs: [["community", "American resources should lower costs for American families and employ American towns."]] },
      { id: "ai", eyebrow: "Technology", title: "Workers First in the AI Revolution",
        intro: "AI is a new economic revolution, and like the industrial revolution it will be unpredictable. America should lead it without leaving its workers behind.",
        plan: [
          ["Required AI training", "Companies in America must offer AI training to their workers to prepare them for the new economy."],
          ["Subsidies and severance", "Increased subsidies and severance for workers who lose jobs to AI."],
          ["Private-sector led", "AI development stays in private hands so American companies remain the most competitive in the world."],
          ["Open to the world", "Support international use of American AI, which gives our companies more data and a lasting lead."],
        ],
        quote: ["Government intervention will just slow companies down and make companies less competitive.", "Tanner Grey on AI"],
        cs: [["constitution", "Innovation stays in private hands, not under federal control."], ["community", "No worker gets left behind by a machine."]] },
    ] },
    { name: "Border & Immigration", issues: [
      { id: "border", eyebrow: "Immigration", title: "A Secure Border, Enforced Humanely",
        intro: "Unlike the Democratic candidates, John Whitman and Ms. Ortiz, this campaign holds the only realistic position on immigration: the border must be secure, and deportations must continue. They must also be carried out humanely and effectively.",
        plan: [
          ["No wall", "Instead of a wall, secure the border with local rapid-response teams that can reach a crossing quickly."],
          ["Drones on the border", "Drone surveillance along the entire border catches illegal crossings at a far higher rate so they can be sent back."],
          ["Drones that save lives", "The same drones can deliver life-saving aid, such as water and medical supplies, to anyone found crossing in dangerous conditions."],
          ["Practice for the future", "Border drones give American operators real experience with the modern systems the Grey Doctrine is built on."],
          ["Deportations continue", "Removals continue, carried out humanely and effectively."],
        ],
        callout: ["What the Democrats won't acknowledge", "Open borders may sound moral, but they have serious consequences. Millions of new arrivals settle in communities that are already struggling. They put new pressure on public schools that are already failing, and when whole neighborhoods speak another language there is less need to learn English. When people watch their community change faster than anyone can control, resentment and bigotry grow. Unmanaged migration makes America more divided, not less."],
        cs: [["community", "Communities, not waves of arrivals no one planned for, should shape how a town changes. Protecting the schools and culture Americans already share keeps the country together."], ["constitution", "Securing the border is one of the oldest and most basic duties of the federal government."], ["character", "Enforcing the law humanely, and saving lives in the desert, is how a decent nation keeps its word."]] },
      { id: "trusted-worker", eyebrow: "Legal work", title: "The Trusted Worker Program",
        intro: "The economy has real needs. Farms in states like Texas depend on workers the country doesn't have enough of. The Trusted Worker Program lets them come legally, on terms America sets.",
        plan: [
          ["An approved list", "A national list of approved workers, similar to a work visa, who may enter the U.S. with special documentation."],
          ["Five-year terms", "Each trusted individual is approved for up to five years at a time."],
          ["Better tracking", "The program tracks participants and their activity, so anyone who commits a crime can be found and deported."],
          ["A real chance for Mexican workers", "Gives Mexican workers a lawful way to come work in the United States."],
          ["A path out for those already here", "People living here illegally can accept the program's conditions, work out their term, and then self-deport when it ends."],
        ],
        cs: [["character", "Trust is earned: workers who follow the rules can stay and work, and those who break them go home."], ["community", "Local employers get the workers they need without communities losing control of who settles there."]] },
    ] },
    { name: "Communities & Culture", issues: [
      { id: "second-chance", eyebrow: "Opportunity", title: "Second Chance Communities",
        intro: "America has a real racial divide, and the Democrats are right to say so. But they blame it on racists and set out to tear the system down further. The real causes are decades of failed government policy and broken local institutions. The answer is to rebuild, one community at a time.",
        plan: [
          ["Start where it's hardest", "The Rust Belt plan includes majority-Black cities like Detroit. New factories and guaranteed jobs give these neighborhoods a second chance to build real communities."],
          ["Close the education gap", "Direct resources to the schools falling furthest behind, so every American child gets the same shot at a good education."],
          ["Community by community", "Work with local leaders, churches and families neighborhood by neighborhood instead of imposing one-size-fits-all programs from Washington."],
          ["Personal responsibility", "Pair new opportunity with high expectations. Government can open doors, but communities and individuals walk through them."],
          ["Heal the wounds of segregation", "Bring Americans of every background together around work, schools and neighborhoods they share."],
        ],
        cs: [["community", "Community means bringing America back together. Healing the divide happens block by block, not from a federal office."], ["character", "Hold government accountable for its failures, and hold ourselves to the civic virtue of taking responsibility for our own neighborhoods."]] },
      { id: "one-america", eyebrow: "Culture", title: "One America, Not Identity Politics",
        intro: "Woke politics sorts Americans into groups and teaches them to see each other as enemies. This campaign rejects it.",
        plan: [
          ["Judge by character", "Treat Americans as individuals, judged by their character and not by the group they were born into."],
          ["Local standards", "Parents and local governments, not federal agencies, set social and educational standards for their own schools."],
          ["A shared culture", "A common language and a shared civic identity are what let a nation of many backgrounds work as one."],
        ],
        cs: [["character", "A citizen is measured by character, the civic virtue the founders expected of every American."], ["community", "Local control of schools and social standards is the power of the people in action."]] },
    ] },
    { name: "Individual Liberty", issues: [
      { id: "choice", eyebrow: "Abortion", title: "Your Body, Your Choice",
        intro: "Tanner Grey is pro-choice, for the most conservative reason there is: every person owns themselves.",
        custom: `
          <div class="argument">
            <p><strong>Self-ownership.</strong> If your body is not yours to decide about, then whose is it? The only answer left is the government. But no politician, agency or court can honestly claim to own another person's body. The moment anyone argues that they do, they have already assumed the right to control you.</p>
            <p><strong>Rights fall together.</strong> A government that can claim authority over your body can claim authority over almost anything else you do. Take this right away and you set the precedent that takes the next one, often in ways no one intended. Rights that depend on the government's permission are no longer rights.</p>
            <p><strong>A reasonable limit.</strong> Grey does not support abortion up to the day before birth. He supports the right to choose within a reasonable time frame set in law.</p>
          </div>`,
        cs: [["constitution", "The Constitution exists to limit government power over the individual. Your body is the first place that limit applies."], ["character", "A reasonable time limit reflects the moral seriousness of the decision."]] },
    ] },
    { name: "Security", issues: [
      { id: "security", eyebrow: "National security", title: "The Grey Doctrine",
        intro: "No more open-ended wars that spend American lives. The United States leads through partners, production and pressure.",
        plan: [
          ["Iran", "Dismantle the proxy network first, then turn maximum pressure on Tehran. No invasion."],
          ["Africa", "Counter Russian and Chinese influence by backing the movements and governments willing to reform."],
          ["Indo-Pacific", "Build a Pacific NATO with our allies, arm Myanmar's resistance, and tariff China together with our partners."],
          ["Europe", "Repair relations, strengthen NATO, unify the sanctions regime, and restart direct military aid to Ukraine."],
        ],
        quote: ["Make sure the Nuclear threat cannot even cross their mind.", "Tanner Grey on Iran"],
        link: ["foreign-policy", "Read the full foreign policy and explore the map →"] },
    ] },
  ];
}

function pagePlatform() {
  const groups = platformGroups();
  return `
  <section class="page-hero">
    <div class="wrap">
      <div class="eyebrow">The platform</div>
      <h1>A worker-first America</h1>
      <p>Constitution, Character and Community: every policy below is built on them. Take control of American resources and invest them in the American people.</p>
    </div>
  </section>
  <div class="wrap platform">
    <nav class="toc" aria-label="Platform sections">
      ${groups.map((g) => `<span class="toc-group">${esc(g.name)}</span>${g.issues.map((i) => `<a href="#platform-${i.id}" data-scroll="issue-${i.id}">${esc(i.title)}</a>`).join("")}`).join("")}
    </nav>
    <div>
      ${groups.map((g) => g.issues.map((i) => `
        <section class="issue" id="issue-${i.id}">
          <div class="eyebrow">${esc(g.name)} · ${esc(i.eyebrow)}</div>
          <h2>${esc(i.title)}</h2>
          <p class="intro">${esc(i.intro)}</p>
          ${i.stat ? `<div class="stat"><span class="num">${esc(i.stat[0])}</span><span>${esc(i.stat[1])}</span></div>` : ""}
          ${i.custom || ""}
          ${i.plan ? `<ul class="plan-list">${i.plan.map(([b, s]) => `<li><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join("")}</ul>` : ""}
          ${i.callout ? `<div class="callout"><b>${esc(i.callout[0])}</b><span>${esc(i.callout[1])}</span></div>` : ""}
          ${i.quote ? `<figure class="pull" style="margin:0"><q>${esc(i.quote[0])}</q><cite>${esc(i.quote[1])}</cite></figure>` : ""}
          ${i.cs ? csBox(i.cs) : ""}
          ${i.note ? `<p class="note">${esc(i.note)}</p>` : ""}
          ${i.link ? `<a class="btn btn-line" href="#${i.link[0]}" style="justify-self:start">${esc(i.link[1])}</a>` : ""}
        </section>`).join("")).join("")}
    </div>
  </div>`;
}

function csBox(cs) {
  return `
  <div class="cs-box">
    <div class="cs-head">The 3 C's</div>
    ${cs.map(([k, why]) => `<div class="cs-row"><span class="cs-tag cs-${k}">${esc(THREE_CS[k].label)}</span><span>${esc(why)}</span></div>`).join("")}
  </div>`;
}

// Which issues serve each C, for the foundation section and the home page.
function issuesByC() {
  const out = { constitution: [], character: [], community: [] };
  platformGroups().forEach((g) => g.issues.forEach((i) => (i.cs || []).forEach(([k]) => out[k].push(i))));
  return out;
}

function threeCsDetail() {
  const text = {
    constitution: "Targeted amendments that modernize specific limits on government: curb the expansion of federal power and put term limits on Congress. Protect the individual's rights from government overreach.",
    character: "Public service stripped of self-interest. A return to civic virtue, carrying forward the legacy of the founding fathers: end corruption, end favoritism, and hold both government and citizens to a higher standard.",
    community: "The power of the people. Local governments, not distant federal agencies, set local social and educational standards, and every policy is judged by what it does for real towns and neighborhoods.",
  };
  return `
  <div class="cs-grid">
    ${Object.entries(THREE_CS).map(([k, c]) => `
      <div class="cs-card">
        <span class="cs-tag cs-${k}">${esc(c.label)}</span>
        <p>${esc(text[k])}</p>
      </div>`).join("")}
  </div>
  <ul class="plan-list">
    <li><b>Congressional term limits</b><span>A constitutional amendment to end the career politician and return Congress to citizen legislators.</span></li>
    <li><b>Curb federal expansion</b><span>Targeted amendments that modernize specific limits on federal power so Washington cannot keep growing past its constitutional role.</span></li>
  </ul>`;
}

function growthDiagram() {
  const chains = [
    { name: "Families", link: "taxes", steps: ["Zero income tax for the bottom 50%", "Families keep and spend more", "Local businesses grow and hire", "More jobs, lower cost of living"] },
    { name: "Competition", link: "healthcare", steps: ["Cut favoritism and needless regulation", "New competitors enter", "Prices for medicine and insurance fall", "Small businesses and patients win"] },
    { name: "Industry", link: "defense-spending", steps: ["Cut defense contractor waste", "Savings fund new Rust Belt factories", "Guaranteed manufacturing jobs", "Stable regional recovery"] },
  ];
  return `
  <div class="growth" role="list" aria-label="How the plan fits together">
    ${chains.map((c) => `
      <div class="chain" role="listitem">
        <a class="chain-name" href="#platform-${c.link}" data-scroll="issue-${c.link}">${esc(c.name)}</a>
        <ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      </div>`).join("")}
  </div>`;
}

/* ================================================================== FOREIGN POLICY */
function pageForeign() {
  const pillars = [
    { id: "iran", th: "Middle East", map: ["me", "364"], title: "Contain Iran, Cold War style",
      body: `<p>The current fighting in the Middle East is a mistake that spends American lives and resources. The Grey Doctrine replaces it with patient, Cold War containment.</p>
        <ul>
          <li><strong>Phase one, the proxies.</strong> Destroy Iran's network first: the Houthis in Yemen, Hezbollah in Lebanon, and Iran-aligned militias in Iraq, using airstrikes, arms interdiction and allied forces.</li>
          <li><strong>Phase two, the pressure.</strong> Once the proxies fall, turn the full weight of economic pressure on Tehran: sanctions, oil-export enforcement and financial isolation.</li>
          <li><strong>No invasion.</strong> Direct U.S. action is limited to strikes on proxy forces in the region, coordinated with Saudi Arabia, Israel and Gulf partners.</li>
          <li><strong>Redirect resources</strong> from open-ended fighting to arming allies such as Saudi Arabia.</li>
        </ul>` },
    { id: "africa", th: "Africa", map: ["af", "180"], title: "Pivot to Africa",
      body: `<p>The contest with China and Russia over the next decade will be decided in Africa, where Russia's Africa Corps props up juntas and Chinese firms control critical minerals. America shifts its attention there, and accepts that some of the continent's colonial-era borders will change.</p>
        <ul>
          <li>Support the <strong>Tuareg movement</strong> in northern Mali. By 2032 the north becomes the independent Tuareg state of <strong>Azawad</strong>, and Russia's forces are gone from the Sahel.</li>
          <li>Back the <strong>Greater Rwanda movement</strong> and the autonomy movements inside the Congo. The Kivus join Rwanda, <strong>Katanga</strong> becomes independent, and China's hold on Congolese cobalt is broken.</li>
          <li>Support the <strong>anti-Russian forces in the Central African Republic</strong> fighting the Russian mercenaries who guard its government.</li>
          <li>Support the <strong>official government of Sudan</strong> until the country is reunified, and deny Russia a naval base on the Red Sea.</li>
          <li>Work with Turkey to back the <strong>Tripoli-based Libyan government</strong> until Libya is reunified and the Russian-backed army in the east is gone.</li>
        </ul>` },
    { id: "test", th: "Worldwide", map: null, title: "The partnership test",
      body: `<p>Countries in different parts of the world will not always adopt Western-style democracy, and the United States should stop trying to force it on nations that do not want it. The question that decides whether America works with a government is simpler.</p>
        <p><strong>Is it willing to pursue genuine anti-corruption reform and make its own government more efficient?</strong> If so, the United States will help it do that and help build it up. That is how we win partners China and Russia cannot buy.</p>` },
    { id: "indo", th: "Indo-Pacific", map: ["ip", "704"], title: "A Pacific NATO",
      body: `<p>China's neighbors are strongest together. The Grey administration pulls them into one collective-defense pact, the <strong>Indo-Pacific Treaty Organization</strong>, built to contain Chinese expansion the way NATO contained the Soviet Union.</p>
        <ul>
          <li><strong>Core allies:</strong> Taiwan (ROC), South Korea, Japan, the Philippines, Australia and New Zealand.</li>
          <li><strong>New partners:</strong> Indonesia, Thailand and Vietnam, including countries the U.S. has not always been on good terms with.</li>
          <li><strong>Myanmar:</strong> support the resistance against the military junta directly with drones, artillery and supplies.</li>
          <li><strong>China:</strong> unlike the previous administration's go-it-alone tariffs, build a tariff coalition with allies across the world so Beijing feels real economic pressure and cannot route around it.</li>
        </ul>` },
    { id: "europe", th: "Europe & Russia", map: ["eu", "804"], title: "One alliance again",
      body: `<p>The U.S. will keep a smaller direct presence in Europe, but NATO will be stronger for it. The goal is to repair relations with our European allies so the alliance acts as a whole again.</p>
        <ul>
          <li><strong>Repair and strengthen NATO:</strong> rebuild trust with European capitals and help Europe field stronger forces of its own.</li>
          <li><strong>One sanctions regime:</strong> unify Russia sanctions across the alliance. Governments that undercut them face U.S. tariffs and withdrawals of U.S. forces.</li>
          <li><strong>Ukraine:</strong> restart direct military support, including advanced systems.</li>
          <li><strong>Russia, indirectly:</strong> defeat its proxies in Africa.</li>
        </ul>` },
  ];
  const chips = Object.entries(THEATERS).map(([k, t]) => `<button class="chip" data-theater="${k}" aria-pressed="${state.map.theater === k}">${esc(t.label)}</button>`).join("");
  const legendStatuses = ["home", "ally", "frontline", "regional", "reform", "movement", "adversary", "proxy", "cleared", "influence", "rival", "newstate", "laggard"];
  return `
  <section class="page-hero">
    <div class="wrap">
      <div class="eyebrow">Foreign policy</div>
      <h1>The Grey Doctrine</h1>
      <p>American strength through partners, production and pressure, not mass deployments. Four theaters, one test for every partner, and an industrial base that turns American factories into American power.</p>
    </div>
  </section>

  <section class="section" id="map-section">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">Interactive map</div>
        <h2>The world, then and after</h2>
        <p>Click any country or marker for the plan. Switch to <strong>2032 projection</strong> to see what a successful first term of the Grey Doctrine looks like.</p>
      </div>
      <div class="map-shell">
        <div class="map-toolbar">
          <div class="seg" role="group" aria-label="Map timeframe">
            <button id="mode-now" data-mode="now" aria-pressed="${state.map.mode === "now"}">Today · 2026</button>
            <button id="mode-future" data-mode="future" aria-pressed="${state.map.mode === "future"}">2032 projection</button>
          </div>
          <div class="chips" role="group" aria-label="Zoom to theater">${chips}</div>
          <div class="toggles">
            <label><input type="checkbox" id="layer-arcs" ${state.map.layers.arcs ? "checked" : ""}> Arms flows</label>
            <label><input type="checkbox" id="layer-markers" ${state.map.layers.markers ? "checked" : ""}> Movements &amp; proxies</label>
            <label><input type="checkbox" id="layer-corps" ${state.map.layers.corps ? "checked" : ""}> Volunteer Corps</label>
            <label><input type="checkbox" id="layer-blocs" ${state.map.layers.blocs ? "checked" : ""}> Alliances</label>
          </div>
        </div>
        <div class="map-stage" id="map-stage">
          <div class="map-mode-tag" id="map-mode-tag"></div>
          <div class="zoom-ctl">
            <button id="zoom-in" aria-label="Zoom in">+</button>
            <button id="zoom-out" aria-label="Zoom out">−</button>
            <button id="zoom-reset" class="reset" aria-label="Reset view">ALL</button>
          </div>
          <svg id="map" viewBox="0 0 960 500" role="img" aria-label="World map of the Grey Doctrine"></svg>
          <div class="tooltip" id="tooltip" hidden></div>
        </div>
        <aside class="map-panel" id="map-panel" aria-live="polite"></aside>
        <div class="legend">
          ${legendStatuses.map((s) => `<span><i class="swatch" style="background:${s === "laggard" ? "repeating-linear-gradient(45deg,var(--m-laggard-a) 0 3px,var(--m-laggard-b) 3px 6px)" : `var(${STATUS[s].color})`}"></i>${esc(STATUS[s].label)}</span>`).join("")}
          ${Object.values(MARKER_KIND).map((k) => `<span><i class="mk" style="border-color:var(${k.color})"></i>${esc(k.label)}</span>`).join("")}
          <span><i class="swatch" style="background:none;border-top:2px dashed var(--red);height:0;width:16px;border-radius:0"></i>U.S. arms flows</span>
          <span><i class="swatch" style="background:none;border-top:2px dashed var(--ink);height:0;width:16px;border-radius:0"></i>Civil-war front line (today)</span>
          <span><i class="swatch" style="background:none;border-top:2px solid var(--ink);height:0;width:16px;border-radius:0"></i>New border (2032)</span>
          <span><i class="swatch" style="background:none;border:2px solid var(--bloc);height:10px;width:16px;border-radius:2px"></i>Alliance (NATO, Indo-Pacific Treaty Org.)</span>
        </div>
      </div>
      <p class="note" style="margin-top:12px">The 2032 view is the campaign's projection of a successful first term, not a forecast.</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">The doctrine</div>
        <h2>Five commitments</h2>
      </div>
      <div class="pillars">
        ${pillars.map((p) => `
          <article class="pillar" id="pillar-${p.id}">
            <div class="head">
              <span class="theater">${esc(p.th)}</span>
              <h3>${esc(p.title)}</h3>
              ${p.map ? `<button class="btn btn-line btn-sm show-map" data-show-theater="${p.map[0]}" data-show-country="${p.map[1]}">Show on map</button>` : ""}
            </div>
            <div class="body">${p.body}${p.id === "test" ? testGrid() : ""}</div>
          </article>`).join("")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">Industry</div>
        <h2>Arsenal of the drone age</h2>
        <p>Most of this strategy is hard to achieve with conventional forces. So American military production shifts to mass-produced, low-cost systems that have proven highly effective, while the partners who need them most receive advanced systems.</p>
      </div>
      <div class="table-wrap">
        <table class="arsenal">
          <thead><tr><th>System</th><th>Built where</th><th>Goes to</th><th>Why</th></tr></thead>
          <tbody>
            <tr><td>FPV drones</td><td>Rust Belt factories</td><td>Ukraine, Taiwan, Myanmar resistance, African partners</td><td>Cheap, mass-produced, and decisive on today's battlefields.</td></tr>
            <tr><td>Unmanned ground vehicles</td><td>Rust Belt factories</td><td>Ukraine and frontline partners</td><td>Moves supplies and fights without risking soldiers.</td></tr>
            <tr><td>Drone boats</td><td>U.S. shipyards</td><td>Taiwan, Philippines, Ukraine</td><td>Denies seas to larger navies at a fraction of the cost.</td></tr>
            <tr><td>Patriot missiles</td><td>Existing U.S. production</td><td>Ukraine, Taiwan</td><td>Protects cities and bases from missiles and aircraft.</td></tr>
            <tr><td>Near-retired fighter jets</td><td>U.S. Air Force inventory</td><td>Ukraine, Taiwan</td><td>Aircraft leaving U.S. service still outclass most threats.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="corps">
        <div>
          <div class="eyebrow">Boots on the ground, by choice</div>
          <h3>The American Volunteer Corps</h3>
          <p>American impact abroad will be large, but America's direct presence will stay limited. Where direct help is needed, American service members can choose to join a volunteer corps, modeled on France's volunteer legion, and serve for higher pay. No one is pressured to go.</p>
          <p>This gives the United States real influence on the ground without the trap of mass deployments and unpopular forced wars.</p>
        </div>
        <dl>
          <div><dt>Who</dt><dd>American service members who volunteer. No pressure, no orders to go.</dd></div>
          <div><dt>Pay</dt><dd>Higher pay for those who serve.</dd></div>
          <div><dt>Where</dt><dd>Ukraine, Rwanda, the Sahel, Sudan and Libya.</dd></div>
          <div><dt>Why</dt><dd>Influence on the ground without drafting a nation into another forever war.</dd></div>
        </dl>
      </div>
    </div>
  </section>`;
}

function testGrid() {
  return `
  <div class="test-grid">
    <div class="test-card">
      <h4>What we ask of partners</h4>
      <ul>
        <li><span class="yes">✓</span><span>Genuine anti-corruption reform</span></li>
        <li><span class="yes">✓</span><span>A more efficient, effective government</span></li>
        <li><span class="yes">✓</span><span>Willingness to work with the U.S. against Chinese and Russian influence</span></li>
      </ul>
    </div>
    <div class="test-card">
      <h4>What we don't require</h4>
      <ul>
        <li><span class="no">—</span><span>A Western-style democratic system</span></li>
        <li><span class="no">—</span><span>Adopting American social values</span></li>
        <li><span class="no">—</span><span>Regime change imposed from outside</span></li>
      </ul>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ map */
const W = 960, H = 500;
let mapCtx = null;

function initMap() {
  const svgEl = $("#map");
  if (!svgEl) return;
  if (!window.d3 || !window.topojson) {
    $("#map-panel").innerHTML = `<p>The map library did not load. Check your connection and reload the page.</p>`;
    return;
  }
  const d3 = window.d3;
  const svg = d3.select(svgEl);
  const tip = $("#tooltip");
  const stage = $("#map-stage");

  const draw = (world) => {
    const all = window.topojson.feature(world, world.objects.countries).features.filter((f) => f.id !== "010");
    const fc = { type: "FeatureCollection", features: all };
    const projection = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], fc);
    const path = d3.geoPath(projection);

    svg.selectAll("*").remove();
    const defs = svg.append("defs");
    const pat = defs.append("pattern").attr("id", "laggard").attr("patternUnits", "userSpaceOnUse").attr("width", 6).attr("height", 6).attr("patternTransform", "rotate(45)");
    pat.append("rect").attr("width", 6).attr("height", 6).attr("style", "fill:var(--m-laggard-a)");
    pat.append("rect").attr("width", 3).attr("height", 6).attr("style", "fill:var(--m-laggard-b)");

    svg.append("rect").attr("width", W).attr("height", H).attr("style", "fill:var(--sea)").on("click", () => select(null));
    const g = svg.append("g");
    g.append("path").attr("class", "graticule").attr("d", path(d3.geoGraticule10()));

    const countries = g.append("g").selectAll("path").data(all).join("path")
      .attr("class", "country")
      .attr("d", path)
      .attr("tabindex", (d) => (COUNTRIES[d.id] ? 0 : null))
      .attr("aria-label", (d) => (COUNTRIES[d.id]?.name || d.properties.name))
      .on("click", (e, d) => { e.stopPropagation(); select({ type: "country", id: d.id, name: d.properties.name }); })
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select({ type: "country", id: d.id, name: d.properties.name }); } })
      .on("mousemove", (e, d) => showTip(e, countryTip(d)))
      .on("mouseleave", hideTip);

    // Sub-national areas (civil-war zones today, new states in 2032), clipped to their country.
    const byId = new Map(all.map((f) => [f.id, f]));
    [...new Set(REGIONS.map((r) => r.country))].forEach((id) => {
      if (byId.has(id)) defs.append("clipPath").attr("id", "clip-" + id).append("path").attr("d", path(byId.get(id)));
    });
    const ringPath = (ring) => "M" + ring.map((p) => projection(p).map((n) => n.toFixed(1)).join(",")).join("L") + "Z";
    const regions = g.append("g").attr("class", "regions").selectAll("path").data(REGIONS.filter((r) => byId.has(r.country))).join("path")
      .attr("clip-path", (r) => `url(#clip-${r.country})`)
      .attr("d", (r) => ringPath(r.ring))
      .attr("tabindex", 0)
      .attr("aria-label", (r) => r.name)
      .on("click", (e, r) => { e.stopPropagation(); select({ type: "region", id: r.id }); })
      .on("keydown", (e, r) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select({ type: "region", id: r.id }); } })
      .on("mousemove", (e, r) => showTip(e, `<b>${esc(r.name)}</b><br>${esc(STATUS[r[phaseKey()]]?.label || "")}`))
      .on("mouseleave", hideTip);

    // Alliance outlines: NATO (strained today, reunited in 2032) and the Indo-Pacific Treaty Organization (2032 only).
    const geoms = world.objects.countries.geometries;
    const merged = (ids) => window.topojson.merge(world, geoms.filter((x) => ids.includes(x.id)));
    const blocs = g.append("g").attr("class", "blocs").selectAll("path").data([
      { id: "nato", name: "NATO", shape: merged(NATO_IDS) },
      { id: "ipto", name: IPTO, shape: merged(IPTO_IDS) },
    ]).join("path").attr("d", (b) => path(b.shape));

    // Text labels for regions, factions and alliances.
    const labelData = [
      ...REGIONS.map((r) => ({ id: r.id, text: r.label, ll: r.labelAt, show: (ph) => !!r[ph], cls: "region-label" })),
      ...Object.entries(REGION_LABELS_NOW).map(([cid, [text, ll]]) => ({ id: "base-" + cid, text, ll, show: (ph) => ph === "now", cls: "region-label" })),
      { id: "nato-l", text: "NATO", ll: [-28, 50], show: () => true, cls: "bloc-label", layer: "blocs" },
      { id: "ipto-l", text: "INDO-PACIFIC TREATY ORG.", ll: [150, 2], show: (ph) => ph === "future", cls: "bloc-label", layer: "blocs" },
    ];
    const labels = g.append("g").attr("class", "labels").selectAll("text").data(labelData).join("text")
      .attr("class", (d) => d.cls)
      .attr("text-anchor", "middle")
      .text((d) => d.text);

    const arcs = g.append("g").attr("class", "arcs");
    arcs.selectAll("path").data(ARCS).join("path")
      .attr("class", "arc")
      .attr("d", (a) => path({ type: "LineString", coordinates: d3.range(0, 1.0001, 0.02).map(d3.geoInterpolate(DC, a.to)) }))
      .on("mousemove", (e, a) => showTip(e, `<b>U.S. arms flow</b><br>${esc(a.label)}`))
      .on("mouseleave", hideTip);

    const markers = g.append("g").attr("class", "markers").selectAll("g").data(MARKERS).join("g")
      .attr("class", "marker")
      .attr("tabindex", 0)
      .attr("aria-label", (m) => m.name)
      .on("click", (e, m) => { e.stopPropagation(); select({ type: "marker", id: m.id }); })
      .on("keydown", (e, m) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select({ type: "marker", id: m.id }); } })
      .on("mousemove", (e, m) => showTip(e, `<b>${esc(m.name)}</b><br>${esc(MARKER_KIND[m.kind].label)}`))
      .on("mouseleave", hideTip);
    const inner = markers.append("g").attr("class", "mk-inner");
    inner.append("circle").attr("class", "ring").attr("r", 6).attr("style", (m) => `stroke:var(${MARKER_KIND[m.kind].color})`);
    inner.append("circle").attr("class", "dot").attr("r", 2.6).attr("style", (m) => `fill:var(${MARKER_KIND[m.kind].color})`);
    inner.append("text").attr("x", 10).attr("y", 4).attr("font-size", 11).text((m) => m.name);

    const placeMarkers = (k) => {
      markers.attr("transform", (m) => { const [x, y] = projection(m.ll); return `translate(${x},${y}) scale(${1 / k})`; });
      markers.selectAll("text").attr("display", k >= 2.4 ? null : "none");
      labels.attr("transform", (d) => { const [x, y] = projection(d.ll); return `translate(${x},${y}) scale(${1 / k})`; });
      mapCtx && (mapCtx.k = k);
      paintLabels();
    };

    const zoom = d3.zoom().scaleExtent([1, 9]).translateExtent([[0, 0], [W, H]])
      .on("zoom", (e) => { g.attr("transform", e.transform); placeMarkers(e.transform.k); hideTip(); });
    svg.call(zoom).on("dblclick.zoom", null);
    placeMarkers(1);

    const zoomToTheater = (key) => {
      const t = THEATERS[key];
      if (!t || !t.box) { svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity); return; }
      const [[x0, y1], [x1, y0]] = [projection(t.box[0]), projection(t.box[1])];
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      const k = Math.min(9, 0.92 / Math.max(dx / W, dy / H));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - k * cx, H / 2 - k * cy).scale(k));
    };

    function showTip(e, html) {
      const r = stage.getBoundingClientRect();
      tip.innerHTML = html;
      tip.style.left = (e.clientX - r.left) + "px";
      tip.style.top = (e.clientY - r.top) + "px";
      tip.hidden = false;
    }
    function hideTip() { tip.hidden = true; }

    function countryTip(d) {
      const c = COUNTRIES[d.id];
      const st = c ? c[phaseKey()][0] : "none";
      return `<b>${esc(c?.name || d.properties.name)}</b><br>${esc(STATUS[st].label)}`;
    }

    mapCtx = { countries, markers, arcs, regions, blocs, labels, zoom, svg, zoomToTheater, projection, k: 1 };
    paint();
    $("#map-section").addEventListener("keydown", (e) => { if (e.key === "Escape") select(null); });
    $("#zoom-in").onclick = () => svg.transition().duration(300).call(zoom.scaleBy, 1.6);
    $("#zoom-out").onclick = () => svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.6);
    $("#zoom-reset").onclick = () => setTheater("all");
    if (state.map.theater !== "all") zoomToTheater(state.map.theater);
  };

  if (initMap.world) draw(initMap.world);
  else {
    $("#map-panel").innerHTML = `<p class="eyebrow">Loading map…</p>`;
    fetch(ASSET_BASE + "world-110m.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((w) => { initMap.world = w; if ($("#map") === svgEl) draw(w); })
      .catch(() => { $("#map-panel").innerHTML = `<p>The map data could not be loaded. Reload the page to try again.</p>`; });
  }

  $$("[data-mode]").forEach((b) => b.addEventListener("click", () => { state.map.mode = b.dataset.mode; paint(); }));
  $$("[data-theater]").forEach((b) => b.addEventListener("click", () => setTheater(b.dataset.theater)));
  ["arcs", "markers", "corps", "blocs"].forEach((k) => { const el = $("#layer-" + k); if (el) el.addEventListener("change", () => { state.map.layers[k] = el.checked; paint(); }); });
  $$("[data-show-theater]").forEach((b) => b.addEventListener("click", () => {
    $("#map-section").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setTheater(b.dataset.showTheater);
    const id = b.dataset.showCountry;
    select({ type: "country", id, name: COUNTRIES[id]?.name });
  }));
}

const phaseKey = () => (state.map.mode === "future" ? "future" : "now");

function setTheater(key) {
  state.map.theater = key;
  $$("[data-theater]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.theater === key)));
  if (mapCtx) mapCtx.zoomToTheater(key);
  paint();
}

function select(sel) {
  state.map.selected = sel;
  paint();
}

function paint() {
  $$("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.map.mode)));
  const tag = $("#map-mode-tag");
  if (tag) tag.textContent = state.map.mode === "future" ? "Projection · January 2033" : "Situation · 2026";
  const panel = $("#map-panel");
  if (!mapCtx) return;
  const ph = phaseKey();
  const th = state.map.theater;
  const sel = state.map.selected;
  const L = state.map.layers;

  mapCtx.countries
    .attr("class", (d) => {
      const c = COUNTRIES[d.id];
      const st = c ? c[ph][0] : "none";
      const dim = th !== "all" && (!c || c.th !== th);
      const isSel = sel && sel.type === "country" && sel.id === d.id;
      return `country${st !== "none" ? " s-" + st : ""}${dim ? " dim" : ""}${isSel ? " sel" : ""}`;
    });
  mapCtx.regions
    .attr("display", (r) => (r[ph] ? null : "none"))
    .attr("class", (r) => {
      const dim = th !== "all" && COUNTRIES[r.country]?.th !== th;
      const isSel = sel && sel.type === "region" && sel.id === r.id;
      return `region ${ph === "future" ? "border-new" : "border-front"} s-${r[ph] || "none"}${dim ? " dim" : ""}${isSel ? " sel" : ""}`;
    });
  mapCtx.blocs
    .attr("display", (b) => (L.blocs && (b.id === "nato" || ph === "future") ? null : "none"))
    .attr("class", (b) => `bloc bloc-${b.id}${b.id === "nato" && ph === "now" ? " strained" : ""}`);
  paintLabels();
  mapCtx.arcs.attr("display", L.arcs ? null : "none");
  mapCtx.markers
    .attr("display", (m) => (m.kind === "corps" ? L.corps : L.markers) ? null : "none")
    .attr("class", (m) => `marker${ph === "future" && m.gone ? " gone" : ""}${sel && sel.type === "marker" && sel.id === m.id ? " sel" : ""}`);

  if (panel) panel.innerHTML = panelHTML();
  $$("#map-panel [data-select-country]").forEach((b) => b.addEventListener("click", () => select({ type: "country", id: b.dataset.selectCountry })));
  $$("#map-panel [data-panel-theater]").forEach((b) => b.addEventListener("click", () => setTheater(b.dataset.panelTheater)));
  $$("#map-panel [data-panel-mode]").forEach((b) => b.addEventListener("click", () => { state.map.mode = b.dataset.panelMode; paint(); }));
}

function paintLabels() {
  if (!mapCtx || !mapCtx.labels) return;
  const ph = phaseKey(), k = mapCtx.k || 1, L = state.map.layers;
  mapCtx.labels.attr("display", (d) => {
    if (!d.show(ph)) return "none";
    if (d.layer === "blocs") return L.blocs ? null : "none";
    return k >= 1.8 ? null : "none";
  });
}

function statusPill(st) {
  const s = STATUS[st];
  const bg = st === "laggard" ? "repeating-linear-gradient(45deg,var(--m-laggard-a) 0 3px,var(--m-laggard-b) 3px 6px)" : `var(${s.color})`;
  return `<span class="pill"><i class="swatch" style="background:${bg}"></i>${esc(s.label)}</span>`;
}

function panelHTML() {
  const sel = state.map.selected;
  const ph = phaseKey();
  if (!sel) {
    const th = state.map.theater;
    const counts = {};
    Object.values(COUNTRIES).forEach((c) => { if (th === "all" || c.th === th) counts[c[ph][0]] = (counts[c[ph][0]] || 0) + 1; });
    const order = ["ally", "frontline", "regional", "reform", "newstate", "movement", "cleared", "laggard", "proxy", "influence", "adversary"];
    return `
      <div class="eyebrow">${state.map.mode === "future" ? "2032 projection" : "Today"} · ${esc(THEATERS[th].label)}</div>
      <h3>${state.map.mode === "future" ? "After one term" : "Where we start"}</h3>
      <p>${state.map.mode === "future"
        ? "Iran's proxies are gone and Tehran is isolated. Russia has lost its African footholds and its war in Ukraine. China faces a united tariff coalition. All of it achieved without a single mass deployment."
        : "Iran fights through proxies across the region. Russia's Africa Corps and Chinese mining firms are spreading across Africa. Ukraine and Taiwan need advanced systems, and Europe is not fully enforcing its own sanctions."}</p>
      <div class="phase">
        ${order.filter((k) => counts[k]).map((k) => `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">${statusPill(k)}<span style="font-family:var(--font-mono);font-variant-numeric:tabular-nums">${counts[k]}</span></div>`).join("")}
      </div>
      <div class="phase">
        <div class="eyebrow">Jump to a theater</div>
        <div class="chips">${Object.entries(THEATERS).filter(([k]) => k !== "all").map(([k, t]) => `<button class="chip" data-panel-theater="${k}">${esc(t.label)}</button>`).join("")}</div>
      </div>
      <p class="note">Tip: drag to pan, use + and − to zoom, and click any shaded country or marker.</p>`;
  }
  if (sel.type === "region") {
    const r = REGIONS.find((x) => x.id === sel.id);
    if (!r) return "";
    const c = COUNTRIES[r.country];
    return `
      <div class="kicker">${statusPill(r[ph] || "none")}</div>
      <h3>${esc(r.name)}</h3>
      ${r.textNow ? `<div class="phase ${ph === "future" ? "dim" : ""}"><div class="eyebrow">Today · 2026</div><p>${esc(r.textNow)}</p></div>` : ""}
      ${r.textFuture ? `<div class="phase ${ph === "now" ? "dim" : ""}"><div class="eyebrow">2032 projection</div><p>${esc(r.textFuture)}</p></div>` : ""}
      ${!r.future && ph === "now" ? `<div class="phase"><div class="eyebrow">2032 projection</div><p>${esc(c.future[1])}</p></div>` : ""}
      <button class="btn btn-line btn-sm" style="justify-self:start" data-select-country="${r.country}">View ${esc(c.name)} →</button>`;
  }
  if (sel.type === "marker") {
    const m = MARKERS.find((x) => x.id === sel.id);
    if (!m) return "";
    const k = MARKER_KIND[m.kind];
    const c = m.country && COUNTRIES[m.country];
    return `
      <div class="kicker"><span class="pill"><i class="mk" style="width:10px;height:10px;border-radius:50%;border:2px solid var(${k.color});display:inline-block"></i>${esc(k.label)}</span></div>
      <h3>${esc(m.name)}</h3>
      <div class="phase ${ph === "future" ? "dim" : ""}"><div class="eyebrow">Today</div><p>${esc(m.now)}</p></div>
      <div class="phase ${ph === "now" ? "dim" : ""}"><div class="eyebrow">2032 projection</div><p>${esc(m.future)}</p></div>
      ${c ? `<button class="btn btn-line btn-sm" style="justify-self:start" data-select-country="${m.country}">View ${esc(c.name)} →</button>` : ""}`;
  }
  const c = COUNTRIES[sel.id];
  if (!c) {
    return `
      <div class="kicker">${statusPill("none")}</div>
      <h3>${esc(sel.name || "Country")}</h3>
      <p>No active Grey Doctrine program. Normal diplomatic and trade relations continue.</p>`;
  }
  const [stN, txtN] = c.now, [stF, txtF] = c.future;
  return `
    <div class="kicker">${statusPill(c[ph][0])}</div>
    <h3>${esc(c.name)}</h3>
    <div class="phase ${ph === "future" ? "dim" : ""}">
      <div class="eyebrow">Today · 2026</div>
      ${ph === "future" ? statusPill(stN) : ""}
      <p>${esc(txtN)}</p>
    </div>
    <div class="phase ${ph === "now" ? "dim" : ""}">
      <div class="eyebrow">2032 projection</div>
      ${ph === "now" ? statusPill(stF) : ""}
      <p>${esc(txtF)}</p>
    </div>
    ${c.tools && c.tools.length ? `<div class="phase"><div class="eyebrow">Tools</div><div class="tools">${c.tools.map((t) => `<span>${esc(t)}</span>`).join("")}</div></div>` : ""}
    <button class="btn btn-line btn-sm" style="justify-self:start" data-panel-mode="${ph === "now" ? "future" : "now"}">${ph === "now" ? "See 2032 projection →" : "← Back to today"}</button>`;
}

/* ================================================================== NEWSROOM */
function sortedArticles() {
  return [...state.articles].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function pageNewsroom() {
  const list = sortedArticles();
  return `
  <section class="page-hero">
    <div class="wrap">
      <div class="eyebrow">Newsroom</div>
      <h1>In the press</h1>
      <p>What the media is writing about the ${esc(C.last)} campaign.</p>
    </div>
  </section>
  <section class="section">
    <div class="wrap">
      ${state.canEdit ? deskHTML() : ""}
      <div class="news-top">
        <div class="eyebrow">${list.length} ${list.length === 1 ? "article" : "articles"}</div>
        ${state.canEdit ? `<button class="btn btn-red btn-sm" id="desk-open" ${state.deskOpen ? "hidden" : ""}>+ Add article</button>` : ""}
      </div>
      ${list.length ? `<div class="news-list">${list.map(newsItemHTML).join("")}</div>`
        : `<div class="empty">No articles yet.${state.canEdit ? " Use <b>Add article</b> to upload the first one." : ""}</div>`}
    </div>
  </section>`;
}

function newsItemHTML(a) {
  return `
  <article class="news-item">
    <div class="meta"><span class="outlet">${esc(a.outlet || "Press")}</span><span>${esc(fmtDate(a.date))}</span>${a.author ? `<span>${esc(a.author)}</span>` : ""}</div>
    <div>
      <h3><a ${articleLinkAttrs(a)}>${esc(a.title)}</a>${isExternal(a) ? ' <span class="ext">↗</span>' : ""}</h3>
      <p class="excerpt">${esc(a.summary || excerpt(a.body))}</p>
      ${state.canEdit ? `<div class="owner-actions" data-owner="${esc(a.id)}">
        <button class="btn btn-line btn-sm" data-edit="${esc(a.id)}">Edit</button>
        <button class="btn btn-line btn-sm" data-delete="${esc(a.id)}">Delete</button>
      </div>` : ""}
    </div>
    <div>${a.image ? `<img class="thumb" src="${esc(a.image)}" alt="">` : ""}</div>
  </article>`;
}

function deskHTML() {
  const a = state.editingId ? state.articles.find((x) => x.id === state.editingId) || {} : {};
  return `
  <div class="desk" id="desk" ${state.deskOpen ? "" : "hidden"}>
    <div>
      <h3>${state.editingId ? "Edit article" : "Add an article"}</h3>
      <p class="sub">Drop in a Word document, a text file, or paste the article. Only campaign editors see this panel.</p>
    </div>
    <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Import an article file">
      <b>Drop a .docx, .txt, .md or .html file here</b> or click to choose one. The text fills in below.
      <input type="file" id="file-input" accept=".docx,.txt,.md,.html,.htm,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
    </div>
    <form id="article-form" class="form-grid" novalidate>
      <div class="field full"><label for="f-title">Headline</label><input id="f-title" required value="${esc(a.title || "")}" placeholder="Grey unveils plan for…"></div>
      <div class="field"><label for="f-outlet">Outlet <span class="hint">(newspaper, site, or class paper)</span></label><input id="f-outlet" value="${esc(a.outlet || "")}" placeholder="Press coverage"></div>
      <div class="field"><label for="f-author">Reporter <span class="hint">(optional)</span></label><input id="f-author" value="${esc(a.author || "")}"></div>
      <div class="field"><label for="f-date">Date</label><input id="f-date" type="date" value="${esc(a.date || new Date().toISOString().slice(0, 10))}"></div>
      <div class="field"><label for="f-link">Link to original <span class="hint">(optional)</span></label><input id="f-link" type="url" value="${esc(a.link || "")}" placeholder="https://"></div>
      <div class="field full"><label for="f-image">Photo <span class="hint">(optional)</span></label>
        <input id="f-image" type="file" accept="image/*">
        <div class="img-preview" id="img-preview" ${a.image ? "" : "hidden"}>${a.image ? `<img src="${esc(a.image)}" alt="">` : ""}<button type="button" class="btn btn-line btn-sm" id="img-remove">Remove photo</button></div>
      </div>
      <div class="field full"><label for="f-body">Article text <span class="hint">(or leave empty and fill in the link to send readers to the original)</span></label><textarea id="f-body">${esc(a.body || "")}</textarea></div>
      <div class="full row-actions">
        <button class="btn btn-red" type="submit" id="desk-save">${state.editingId ? "Save changes" : "Publish article"}</button>
        <button class="btn btn-line" type="button" id="desk-cancel">Cancel</button>
        <span class="status" id="desk-status" role="status"></span>
      </div>
    </form>
  </div>`;
}

function bindNewsroom() {
  if (!state.canEdit) return;
  let imageData = state.editingId ? (state.articles.find((x) => x.id === state.editingId)?.image || "") : "";
  const open = $("#desk-open");
  if (open) open.onclick = () => { state.deskOpen = true; state.editingId = null; render(); $("#desk")?.scrollIntoView({ block: "start" }); $("#f-title")?.focus(); };
  const cancel = $("#desk-cancel");
  if (cancel) cancel.onclick = () => { state.deskOpen = false; state.editingId = null; render(); };

  $$("[data-edit]").forEach((b) => b.onclick = () => { state.editingId = b.dataset.edit; state.deskOpen = true; render(); $("#desk")?.scrollIntoView({ block: "start" }); });
  $$("[data-delete]").forEach((b) => b.onclick = () => {
    const box = b.parentElement;
    const id = b.dataset.delete;
    box.innerHTML = `<span class="confirm">Delete this article for everyone?
      <button class="btn btn-red btn-sm" data-confirm>Delete</button>
      <button class="btn btn-line btn-sm" data-keep>Keep</button></span>`;
    $("[data-keep]", box).onclick = () => render();
    $("[data-confirm]", box).onclick = async (e) => {
      e.target.disabled = true;
      try { await saveArticles(state.articles.filter((x) => x.id !== id)); toast("Article deleted"); render(); }
      catch (err) { box.innerHTML = `<span class="status err">${esc(saveErrorText(err))}</span>`; }
    };
  });

  const dz = $("#dropzone"), fi = $("#file-input");
  if (dz && fi) {
    dz.onclick = () => fi.click();
    dz.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fi.click(); } };
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add("over"); };
    dz.ondragleave = () => dz.classList.remove("over");
    dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) importFile(f); };
    fi.onchange = () => { if (fi.files[0]) importFile(fi.files[0]); fi.value = ""; };
  }

  const imgIn = $("#f-image"), prev = $("#img-preview");
  const showPrev = () => {
    if (!prev) return;
    prev.hidden = !imageData;
    prev.innerHTML = imageData ? `<img src="${imageData}" alt=""><button type="button" class="btn btn-line btn-sm" id="img-remove">Remove photo</button>` : "";
    const rm = $("#img-remove"); if (rm) rm.onclick = () => { imageData = ""; if (imgIn) imgIn.value = ""; showPrev(); };
  };
  showPrev();
  if (imgIn) imgIn.onchange = async () => {
    const f = imgIn.files[0]; if (!f) return;
    try { imageData = await shrinkImage(f); showPrev(); }
    catch { setStatus("That image could not be read. Try a JPG or PNG.", true); }
  };

  const form = $("#article-form");
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const title = $("#f-title").value.trim();
    const body = $("#f-body").value.trim();
    const linkVal = $("#f-link").value.trim();
    if (!title || (!body && !/^https?:\/\//i.test(linkVal))) { setStatus("Add a headline, plus the article text or a link to where it was published.", true); return; }
    const item = {
      id: state.editingId || slug(title),
      title, body,
      outlet: $("#f-outlet").value.trim(),
      author: $("#f-author").value.trim(),
      date: $("#f-date").value || new Date().toISOString().slice(0, 10),
      link: $("#f-link").value.trim(),
      image: imageData,
    };
    const next = state.editingId ? state.articles.map((x) => (x.id === item.id ? item : x)) : [item, ...state.articles];
    $("#desk-save").disabled = true;
    setStatus("Publishing…");
    try {
      const wasEdit = !!state.editingId;
      await saveArticles(next);
      state.deskOpen = false; state.editingId = null;
      render();
      toast(wasEdit ? "Changes saved" : "Article published");
    } catch (err) {
      $("#desk-save").disabled = false;
      setStatus(saveErrorText(err), true);
    }
  };

  async function importFile(f) {
    const name = f.name.toLowerCase();
    setStatus("Reading " + f.name + "…");
    try {
      let text = "";
      if (name.endsWith(".docx")) {
        if (!window.mammoth) throw new Error("docx");
        const res = await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
        text = res.value;
      } else if (name.endsWith(".html") || name.endsWith(".htm")) {
        const doc = new DOMParser().parseFromString(await f.text(), "text/html");
        const blocks = $$("h1,h2,h3,p,li", doc).map((el) => el.textContent.trim()).filter(Boolean);
        text = blocks.length ? blocks.join("\n\n") : doc.body.textContent;
      } else {
        text = await f.text();
      }
      text = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
      if (!text) { setStatus("That file has no text in it.", true); return; }
      const lines = text.split("\n");
      const titleEl = $("#f-title");
      if (!titleEl.value.trim() && lines[0].length < 160) {
        titleEl.value = lines[0].replace(/^#+\s*/, "");
        text = lines.slice(1).join("\n").trim();
      }
      $("#f-body").value = text;
      setStatus("Imported " + f.name + ". Check the fields, then publish.");
    } catch {
      setStatus("That file could not be read. Try saving it as .docx or .txt, or paste the text instead.", true);
    }
  }
}

function setStatus(msg, err = false) {
  const s = $("#desk-status");
  if (s) { s.textContent = msg; s.classList.toggle("err", err); }
}
function saveErrorText(err) {
  const c = err && err.code;
  if (c === "not_writer" || c === "not_granted" || c === "consent_required") return "This view is read-only, so articles can't be saved here. Open the page from your own Claude account.";
  if (c === "conflict") return "Someone saved a newer version at the same time. The page is reloading with it; add your article again after it loads.";
  if (c === "too_large") return "That's too large to save. Try a smaller photo.";
  if (c === "rate_limited") return "Too many saves in a row. Wait a minute and try again.";
  return "The article couldn't be saved. Try again in a moment.";
}

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1100;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}

function toast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.setAttribute("role", "status");
  t.style.cssText = "position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink);color:var(--paper);padding:10px 16px;border-radius:4px;font-weight:600;font-size:14px;z-index:100";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ------------------------------------------------------------------ article page */
function pageArticle(id) {
  const a = state.articles.find((x) => x.id === id);
  if (!a) {
    return `<div class="wrap"><div class="article"><a class="back" href="#newsroom">← Newsroom</a><h1>Article not found</h1><p>It may have been removed. Head back to the newsroom for the latest coverage.</p></div></div>`;
  }
  const safeLink = /^https?:\/\//i.test(a.link || "") ? a.link : "";
  return `
  <div class="wrap">
    <article class="article">
      <a class="back" href="#newsroom">← Newsroom</a>
      <div class="meta"><span class="outlet">${esc(a.outlet || "Press")}</span><span>${esc(fmtDate(a.date))}</span>${a.author ? `<span>By ${esc(a.author)}</span>` : ""}</div>
      <h1>${esc(a.title)}</h1>
      ${a.image ? `<img class="lead" src="${esc(a.image)}" alt="">` : ""}
      <div class="text">${paras(a.body).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      ${safeLink ? `<p class="source">Originally published at <a href="${esc(safeLink)}" target="_blank" rel="noopener">${esc(safeLink)}</a></p>` : ""}
    </article>
  </div>`;
}

/* ================================================================== ARTICLES STORE */
function readInline() {
  try { const d = JSON.parse($("#articles-inline")?.textContent || "{}"); return d && Array.isArray(d.items) ? d : null; } catch { return null; }
}
async function loadArticles() {
  const inline = readInline();
  let file = null;
  try { const r = await fetch(ASSET_BASE + "articles.json", { cache: "no-store" }); if (r.ok) file = await r.json(); } catch {}
  const pick = [inline, file].filter((d) => d && Array.isArray(d.items)).sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
  if (pick) { state.articles = pick.items; state.updated = pick.updated || 0; }
}

async function saveArticles(items) {
  if (!state.artifact) throw { code: "not_granted" };
  const payload = { updated: Date.now(), items };
  try {
    await state.artifact.publish({ "articles.json": { content: JSON.stringify(payload, null, 2), contentType: "application/json" } });
  } catch (err) {
    const code = err && err.code;
    if (code === "capability_disabled" || code === "capability_removed") {
      // Files-only saves are unavailable here (e.g. the page is shared publicly): republish the page itself with the articles inline.
      try { sessionStorage.setItem("tg-route", location.hash); } catch {}
      await state.artifact.publish(buildShell(payload));
    } else throw err;
  }
  state.articles = items;
  state.updated = payload.updated;
}

// Mirrors index.html exactly, with the article data inlined.
const SKELETON_HEAD = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n';
function buildShell(payload) {
  const data = JSON.stringify(payload).replace(/</g, "\\u003c");
  const body = `<title>Tanner Grey for President</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap">
<link rel="stylesheet" href="site.css">
<div id="app"></div>
<script type="application/json" id="articles-inline">${data}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
<script src="app.js"></script>
`;
  return SKELETON_HEAD + body + "\n</body></html>";
}

async function initCapabilities() {
  const cl = window.claude;
  if (!cl || typeof cl.use !== "function") return;
  try {
    const user = await cl.use("user");
    if (!user) return;
    const [owner, editor] = await Promise.all([user.isOwner().catch(() => false), user.canEdit().catch(() => false)]);
    if (!owner && !editor) return;
    const art = await cl.use("artifact");
    if (!art) return;
    state.artifact = art;
    state.canEdit = true;
    if (currentRoute() === "newsroom") render();
  } catch {}
}

/* ================================================================== ROUTER */
function currentRoute() {
  const h = (location.hash || "#home").slice(1);
  return h || "home";
}

let lastBase = null;
function render() {
  const route = currentRoute();
  let base = route, scrollTo = null;
  let main;
  if (route.startsWith("article-")) { base = "article"; main = pageArticle(route.slice(8)); }
  else if (route.startsWith("platform")) { base = "platform"; main = pagePlatform(); if (route !== "platform") scrollTo = "issue-" + route.slice(9); }
  else if (route.startsWith("foreign-policy")) { base = "foreign-policy"; main = pageForeign(); if (route === "foreign-policy-map") scrollTo = "map-section"; }
  else if (route === "newsroom") main = pageNewsroom();
  else { base = "home"; main = pageHome(); }

  const app = $("#app");
  const keepScroll = base === lastBase && route === lastRouteRendered;
  const y = window.scrollY;
  mapCtx = null;
  app.innerHTML = header(route) + `<main id="main">${main}</main>` + footer();

  const btn = $("#menu-btn"), nav = $("#nav");
  if (btn && nav) btn.onclick = () => { const o = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", String(o)); };
  $$("[data-scroll]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const el = document.getElementById(a.dataset.scroll);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  if (base === "foreign-policy") initMap();
  if (base === "newsroom") bindNewsroom();

  const titles = { home: "", platform: "Platform · ", "foreign-policy": "Foreign Policy · ", newsroom: "Newsroom · ", article: "" };
  document.title = (titles[base] ?? "") + "Tanner Grey for President";

  if (keepScroll) window.scrollTo(0, y);
  else if (scrollTo) requestAnimationFrame(() => document.getElementById(scrollTo)?.scrollIntoView({ block: "start" }));
  else window.scrollTo(0, 0);
  lastBase = base;
  lastRouteRendered = route;
}
let lastRouteRendered = null;

window.addEventListener("hashchange", render);

(async function boot() {
  try { const r = sessionStorage.getItem("tg-route"); if (r) { sessionStorage.removeItem("tg-route"); if (!location.hash) history.replaceState(null, "", r); } } catch {}
  const inline = readInline();
  if (inline) { state.articles = inline.items; state.updated = inline.updated || 0; }
  render();
  await loadArticles();
  const r = currentRoute();
  if (r === "home" || r === "newsroom" || r.startsWith("article-")) render();
  initCapabilities();
})();
})();
