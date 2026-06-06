

## Landing Page
regular landing page with some cool sections,

Simple. Two cards or two big CTAs side by side. in hero and the text

Left side — **"I'm an Investor / Planner"** — leads to the dashboard
Right side — **"I'm a Driver"** — leads to the driver map

Maybe a headline above both: *"Nigeria's EV Intelligence Layer"* and a one-liner subtext. Dark background, green accents. The two CTAs should feel like two doors — you pick your door and go.

---

## Investor Dashboard

Your instinct is right — **unified dashboard, sidebar left, map right.**

### The Left Sidebar
Fixed. Always visible. This is the command center. Here's everything that can live there:

**Top section — identity**
- EV Hacks logo
- "Investor Dashboard" label

**Navigation links**
- Overview (default view — just the map with zones)
- My Stations (list of stations they've planted)
- Zone Rankings (ranked list of all zones by demand score — tabular view, no map)
- ROI History (past ROI calculations they've run — saved results)
- Reports (their generated AI briefs, downloadable)

**Middle section — live stats (small cards)**
This is what makes it feel like a real dashboard. Four small stat cards stacked in the sidebar:
- Total stations planted
- Highest demand zone
- Best ROI projection (from their calculations)
- Average payback period

**Bottom section**
- A small "Data last updated" timestamp
- Toggle: Switch to Driver View (link back)

---

### The Map (Right side, full height)

The map takes everything to the right of the sidebar. Full height.

**The Dock (floating, bottom center of the map)**
This is your Google Maps-style dock. Dark pill shape. Contains:

- **Plant Station** button — click this, then click anywhere on the map to drop a pin and create a station
- **Heatmap toggle** — switches between demand zone view and mobility ping view
- **Zoom in / Zoom out** buttons
- **My Location** (optional)
- **Legend toggle** — shows/hides the zone colour legend

Keep it minimal — 4 to 5 icons max with small labels beneath each.

---

### Planting a Station — the Flow

This is your most interactive feature. Here's how the flow works:

1. User clicks **Plant Station** in the dock
2. Cursor changes — maybe a crosshair or a pin icon follows the cursor
3. User clicks a location on the map
4. A pin drops with a small animation
5. **Immediately** — the right sidebar slides in

---

### The Right Sidebar (Station Detail — slides in from right)

This is what slides in when they click a planted station or drop a new pin. Here's everything it can contain:

**Header**
- Station name (editable — they can name it)
- Coordinates or nearest address
- Close button (X)

**Station Config (if newly planted)**
- Station type selector — AC Level 2 / DC Fast / Swap
- Number of ports
- Capex input
- Monthly OPEX input
- Target segment

**Zone Intelligence (pulled automatically from the zone they clicked)**
- Demand score ring
- Zone name and tier badge
- Population density, POI count, EV traffic, existing stations — the 4 stat cards

**ROI Results**
- Runs automatically once they fill the config and hit calculate
- The three-scenario table — Conservative / Base / Optimistic
- Payback period highlighted

**AI Brief section**
- "Generate Investor Brief" button
- Once generated — a preview of the headline and recommendation right inside the sidebar
- "View Full Brief" opens the full modal
- "Export PDF" button

**What else can go here?**
- **Competitor analysis** — "X existing stations within 1km" with a small list
- **Risk flags** — amber callout if the zone is cold, or if there are too many competitors
- **Historical demand trend** — a tiny sparkline showing if demand in this zone is growing or declining (Fluxx can fake this with the synthetic data)
- **Recommended station type** — a one-line AI suggestion: *"DC Fast recommended for this zone based on commercial traffic density"*

---

## Driver View — Mobile First

Google Maps energy. Exactly right.

### The Map
Full screen. Dark. Shows:
- All existing charging stations as pins (colour coded by status)
- User's current location — blue dot with accuracy ring
- No zone colours — drivers don't care about demand zones
- Subtle road network visible

### The Dock (bottom, floating above the bottom sheet)
Small pill dock. Contains:
- **Filter** — filter stations by type (AC / DC Fast / Swap) or status (Available only)
- **My Location** — re-centre map on user
- **List View** — switches the bottom sheet to a scrollable list instead of map-first

### Bottom Sheet — Default State
Peeks up from the bottom — shows maybe 30% of the screen. Shows:

- "X stations near you" as the header
- Horizontally scrollable station cards — each card has station name, distance, type badge, status dot
- Pull up gesture expands to full list

### Bottom Sheet — Station Detail State
When they tap a station pin or a card, the bottom sheet slides up to about 60-70% of the screen. Contains:

- **Station image** — a photo or a generated placeholder illustration of the station type
- **Station name** — large
- **Status badge** — big and obvious. Available (green) / Busy (amber) / Offline (red)
- **Details row** — type, number of ports, operator name
- **Distance + estimated walk/drive time**
- **Last confirmed working** — "Confirmed working 2 hours ago" or "Last report: 3 days ago" (amber if stale)
- **Directions button** — opens Google Maps or Apple Maps with the station as destination
- **Report Status button** — lets them flag if the station is down or busy
- **User reports** — a tiny feed of recent reports from other drivers. "Offline since 6pm" type of thing.

---

## Summary — Pages and States

**Landing** — 1 page, 2 CTAs

**Investor Dashboard**
- Map + sidebar (default)
- Map + sidebar + right panel (station detail / ROI / brief)
- Zone Rankings page (list view, no map)
- ROI History page
- Reports page

**Driver View**
- Map + bottom sheet collapsed (default)
- Map + bottom sheet expanded (station detail)
- Map + filter active



## Color Theme — Light

The dark theme we talked about earlier is out. Here's the light system:

**Backgrounds**
- Page background: `#F8FAFC` — off-white, not harsh pure white
- Surface / cards: `#FFFFFF`
- Sidebar background: `#FFFFFF` with a subtle right border

**Brand / Primary**
- Primary green: `#16A34A`
- Primary green hover: `#15803D`
- Light green tint (for callouts, badges): `#DCFCE7`

**Accents**
- Amber (warm zones, warnings): `#D97706`
- Amber light: `#FEF3C7`
- Red (offline, danger): `#DC2626`
- Red light: `#FEF2F2`

**Text**
- Headings: `#0F172A` — almost black, very dark navy
- Body: `#475569`
- Muted / labels: `#94A3B8`

**Borders**
- Default: `#E2E8F0`
- Stronger: `#CBD5E1`

**Map base style**
- Switch to Mapbox's `mapbox://styles/mapbox/light-v11` — clean, minimal, roads visible but not dominant. Zones will pop clearly on it.

---

## Typography

**Font: Inter**
One font, different weights. Clean, modern, readable at every size. Import from Google Fonts.

- Display / Hero: Inter 700 (bold), 48–64px
- Page headings: Inter 700, 28–36px
- Section headings: Inter 600 (semibold), 20–24px
- Body: Inter 400, 15–16px
- Labels / captions: Inter 500, 12–13px
- Numbers / stats: Inter 700, varies — numbers should always be bold

---

## Page by Page — Content & Font Specs

---

### Landing Page

**Layout:** Centered, full viewport height hero. Minimal nav at top.

**Nav (top)**
- Left: "EV Hacks" wordmark — Inter 700, 18px, `#0F172A`
- Right: nothing — no links needed

**Hero Section**
- Eyebrow label: "One With AI Hackathon" — Inter 500, 12px, `#16A34A`, uppercase, letter-spaced
- Headline: "Nigeria's EV Intelligence Layer" — Inter 700, 56px, `#0F172A`
- Problem statement paragraph — Inter 400, 17px, `#475569`, max-width 620px, centered. This is where your three-paragraph copy goes.
- CTA buttons below the paragraph — two buttons side by side:
  - "Investor Dashboard" — solid green `#16A34A`, white text, Inter 600, 15px
  - "Driver View" — outlined, green border, green text

**Below hero — three stat pills**
Small horizontal row of three numbers to ground the platform in reality:
- "20,000+ EVs on Nigerian roads"
- "< 50 mapped charging stations"
- "₦13M government EV target by 2050"

Each pill: white card, subtle border, Inter 700 for the number, Inter 400 muted for the label beneath.

---

### Investor Dashboard

**Left Sidebar**
- Width: 240px, fixed
- Background: `#FFFFFF`, right border `#E2E8F0`
- Logo top: "EV Hacks" Inter 700 16px `#0F172A` + small green dot
- Nav links: Inter 500, 14px, `#475569`. Active state: green left border + `#16A34A` text + `#DCFCE7` background
- Link labels: Overview, My Stations, Zone Rankings, ROI History, Reports
- Stat cards (middle): four small cards stacked
  - Label: Inter 500, 11px, `#94A3B8` uppercase
  - Value: Inter 700, 22px, `#0F172A`
  - Labels: "Stations Planted", "Top Zone", "Best ROI", "Avg Payback"
- Bottom: "Switch to Driver View" — Inter 500, 13px, muted green link

**Map area**
- Takes everything right of the sidebar
- Light Mapbox base
- Zones coloured by tier on top

**Map Dock (floating bottom center)**
- White pill card, shadow
- Icons with labels beneath: Inter 500, 11px, `#475569`
- Labels: "Plant Station", "Heatmap", "Zoom In", "Zoom Out", "Legend"

**Right Panel (station detail)**
- Width: 380px, slides in from right
- Background: `#FFFFFF`, left border `#E2E8F0`, shadow on left edge
- Station name: Inter 700, 20px, `#0F172A`
- Zone badge: Inter 600, 11px, uppercase, green/amber/grey pill
- Demand score ring: large, centered, Inter 700 48px for the number inside
- Stat grid labels: Inter 500, 11px, `#94A3B8`
- Stat grid values: Inter 700, 18px, `#0F172A`
- Form labels: Inter 500, 13px, `#475569`
- Form inputs: standard, border `#E2E8F0`, focus border `#16A34A`
- ROI table headers: Inter 600, 12px, uppercase, `#94A3B8`
- ROI table values: Inter 700, 15px, `#0F172A`
- Base case column: light green header `#DCFCE7`, green text

**AI Brief Modal**
- Overlay: `#0F172A` at 60% opacity
- Modal card: `#FFFFFF`, rounded 16px, max-width 720px, centered
- "AI Generated" badge: green pill, Inter 600, 11px uppercase, small spark icon
- Headline: Inter 700, 28px, `#0F172A`
- Summary: Inter 400, 16px, `#475569`, line-height 1.7
- Key metrics row: white cards with green top border, Inter 700 for value, Inter 500 muted for label
- Risk callout: amber background `#FEF3C7`, amber left border, Inter 400 15px
- Recommendation callout: green background `#DCFCE7`, green left border, Inter 600 15px `#15803D`
- Export button: solid green, Inter 600, 15px

---

### Driver View

**Map**
- Full screen, light Mapbox base
- Station pins only — no zone colours
- Blue dot for user location

**Map Dock (floating, bottom center above sheet)**
- Same white pill style as investor dock
- Labels: "Filter", "My Location", "List View"

**Bottom Sheet — Collapsed**
- Background: `#FFFFFF`, top rounded corners 20px, shadow upward
- Drag handle: small grey pill at top center
- Header: "Stations near you" — Inter 600, 16px, `#0F172A`
- Station cards: horizontal scroll
  - Name: Inter 600, 14px, `#0F172A`
  - Distance: Inter 500, 12px, `#94A3B8`
  - Type badge: small pill
  - Status dot: green/amber/red circle

**Bottom Sheet — Station Detail**
- Expands to 65% screen height
- Station image: rounded 12px, full width, 180px tall — placeholder illustration if no real photo
- Station name: Inter 700, 22px, `#0F172A`
- Status badge: large pill — "Available" green / "Busy" amber / "Offline" red — Inter 600, 14px
- Detail row: Inter 500, 14px, `#475569` — type · ports · operator
- "Last confirmed" label: Inter 400, 13px, `#94A3B8`
- Directions button: solid green, full width, Inter 600, 15px
- Report Status button: outlined, full width, Inter 500, 15px, `#475569`
- User reports feed: Inter 400, 13px, `#94A3B8`, small timestamps

---

That's every page, every font size, every colour. Want me to now write the actual copy — every label, button text, placeholder, empty state message — for each page?