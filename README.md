# Fair Care

Fair Care is a responsive community health intelligence app built with React, TypeScript, Vite, Tailwind CSS, Recharts, Leaflet, and a small Node/Express data proxy. It combines public CDC PLACES population estimates with official HRSA health center site locations.

Fair Care is informational and educational. It does not diagnose individuals or provide personalized treatment advice.

## Run locally

Requirements: Node.js 18.18+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The development server proxies the HRSA CSV through `/api/hrsa-sites` because the official HRSA download does not return browser CORS headers. CDC's Socrata API allows cross-origin requests and is queried directly.

For a production-style local run:

```bash
npm run build
npm start
```

The Express server serves `dist/` and proxies HRSA requests. Set `PORT` to change the default port (`4173`).

## Share with someone

The shareable ZIP includes the built app and source code. Each person can run their own copy:

1. Install Node.js 18.18 or newer.
2. Extract the ZIP and open a terminal in the extracted folder.
3. Run `npm install`, then `npm start`.
4. Open `http://localhost:4173` in a browser.

The app needs an internet connection for current HRSA and CDC data and OpenStreetMap tiles. This package runs locally; it does not create a public website link.

## Publish a public website

This project includes a Render Blueprint in `render.yaml`. To create a public HTTPS link:

1. Create a GitHub repository for the project. A private repository is suitable.
2. Push the project source, including `package-lock.json` and `render.yaml`; do not upload `node_modules` or commit secrets.
3. In Render, choose **New → Blueprint**, connect the repository, and deploy the `fair-care-app` web service.
4. After the deployment succeeds, copy the HTTPS URL shown by Render and share it. The site can then be opened from phones, tablets, and computers.

Render builds the app and runs its Express server, which is needed to retrieve HRSA data. The free service may go idle and take longer to respond on its first visit after inactivity. Hosting providers receive the source code needed to build and run the site. No public deployment has been created by this project checkout.

## Features

- Optional, plain-language welcome setup for age range, sex, per-visit budget, one of 35 CDC health measures, state, and location. The intake stays in React memory for the open tab only; there is no account or browser storage.
- Device-location search is opt-in. Coordinates are used in-browser to center the map and find HRSA sites within a selected straight-line radius; they are not sent to CDC or HRSA. Typed city searches are not geocoded, and typed searches are not limited by the device-location radius. ZIP searches support five-digit and ZIP+4 values with or without separators and search across states.
- The overview starts with a clinic finder that shows up to five location/search matches, addresses, HRSA-listed services, and the relevant county health estimate. County figures describe residents, not a clinic or its patients.
- The selected health topic sets the community indicator. Age and sex are not used in CDC PLACES charts or clinic ranking because this integration only loads overall county estimates.
- Larger default text, an optional larger-text control, keyboard focus outlines, reduced-motion support, print styles, and an urgent-support banner with U.S. 911 and 988 links.
- Overview with live loading, source attribution, and county estimate highlights.
- Interactive U.S. health center map with search-ranked matches, state-synced filters, a selected CDC indicator overlay, and site details.
- County health estimates and disparities in the dashboard and disparity explorer.
- Clinic comparison for up to three HRSA health center sites, including available HRSA service details and CDC county estimates. Results are ordered by distance or search relevance only; they are not quality-based recommendations.
- County marker map and high/low summaries for exploring indicator variation.
- Source descriptions, update context, and limitations.
- Responsive navigation and layouts for small screens.
- A transparent reference list of additional public datasets, clearly marked as not integrated.

## Data sources and integration

| Source | Integration | Measures and geography |
| --- | --- | --- |
| [CDC PLACES](https://www.cdc.gov/places/) / [CDC Open Data API](https://data.cdc.gov/resource/swc5-untb.json) | Socrata dataset `swc5-untb`; requests filter year `2023`, indicator, and crude prevalence. Dashboard and disparity views filter by state; map overlay queries are nationwide. County FIPS records are retained. Results are cached in memory per state/indicator for the current page session. | County-level estimates for 35 measures, including chronic conditions, health status, disability, care access, health behaviors, and community needs. Year and estimate type are shown in the UI. |
| [HRSA Health Center Service Delivery Sites](https://data.hrsa.gov/topics/health-centers) | Current official [CSV download](https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv), retrieved through the local/server-side proxy and parsed in the browser. Active sites with valid coordinates are shown. | Individual service delivery site locations, center/site types, contact fields and county fields where provided. |
| [OpenStreetMap](https://www.openstreetmap.org/) | OpenStreetMap tile layer with attribution. | Basemap only; facility markers come from HRSA. |

No sample health data or fabricated site locations are presented. If a data source is unavailable, the relevant view shows an error/empty state and retains a direct source link.

The welcome screen collects age range, sex, and an optional per-visit budget only in current-tab React state. These fields do not change estimates or facility rankings. Verified clinic prices are not available, so budget is shown for reference only. A typed location is used as a text query; browser location is requested only after the user presses the location button and is used only for in-browser distance calculations. Neither kind of location is written to browser storage. Clearing choices resets the in-memory selections.

The Data & Sources page links to additional official datasets (including BRFSS, CDC WONDER, SVI, ACS, food access, environmental justice, shortage areas, and Care Compare). They are reference links only—not live integrations. Clinic comparison shows HRSA location/type/service fields and a CDC estimate for the surrounding county. It does not show clinic outcomes or specialties, and sorting by location or text match cannot identify a “best” provider. These are HRSA health center sites, not a complete hospital directory. Fair Care does not currently have stratified age/sex estimates, clinic quality scoring, insurance matching, access/wait-time data, routing, multilingual translations, symptom tracking, or appointment features. The app does not infer a personal risk score from demographics.

## Limitations

- CDC PLACES measures are modeled population-level estimates, not individual records. They should not be used for diagnosis or treatment.
- The integrated CDC dataset currently exposes 2023 county crude prevalence for the selected indicator. Missing measures/geographies are not filled or estimated by Fair Care.
- Confidence intervals are displayed when the source provides them. Small displayed differences may not be statistically meaningful.
- Do not compare different data years as trends without considering methodology and population changes.
- HRSA site counts do not measure clinical capacity, hours, available services, patient eligibility, quality, travel time, or appointment availability. The downloadable site file may not include service details for every site.
- A CDC estimate displayed beside a site describes adults in its county, not the hospital/health center, its patients, or an individual's risk. Nearby clinics cannot be ranked by condition expertise with the connected HRSA data.
- At national zoom the facility map plots a per-state subset to keep rendering responsive. Searching or filtering by state shows all matching geocoded sites; the plotted-versus-matching counts are shown.
- The disparity map uses published county coordinates and proportional colored markers; it does not draw county boundaries or imply values for missing areas.
- External APIs and map tiles require an internet connection and can change independently of this app.

