# The Daily Voice — Sample Newspaper Test Datasets

This directory contains six realistic, multi-page newspaper PDF publications created specifically for development, automated testing, and end-to-end evaluation of **The Daily Voice** newspaper-to-audiobook platform.

All six publications feature **balanced national (Indian) and international news coverage**, written in **simple, natural, and professional newspaper English with technical terms explained in plain language**. Every page is designed with **approximately 3–4 actual articles**, a custom vector illustration or infographic with detailed caption, and a bottom news briefs panel, utilizing **85–90% of the usable page area** to completely eliminate lower-half blank spaces.

---

## 1. Newspaper Editions Catalog

| No. | Newspaper Name | Edition ID | Date | QR Code | Subdirectory | Filename | Pages | File Size | Price | News Coverage Balance |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **The Times** | `ED001` | Saturday, Nov 7, 2026 | **YES** | `QR/` | `ED001_The_Times.pdf` | 5 | ~403 KB | ₹6.00 | Indian & Global (UK, US, Canada, Japan, EU, Singapore) |
| 2 | **The Tribune** | `ED002` | Sunday, Nov 8, 2026 | **YES** | `QR/` | `ED002_The_Tribune.pdf` | 5 | ~388 KB | ₹5.50 | Indian & Global (Geneva, Germany, Brazil, South Korea, US) |
| 3 | **The Herald** | `ED003` | Monday, Nov 9, 2026 | **YES** | `QR/` | `ED003_The_Herald.pdf` | 5 | ~394 KB | ₹6.00 | Indian & Global (Dubai, UK, Kenya, Canada, Germany) |
| 4 | **The Gazette** | `ED001` | Saturday, Nov 7, 2026 | **NO** | `NoQR/` | `ED001_The_Gazette.pdf` | 5 | ~384 KB | ₹5.00 | Indian & Global (US, Japan, France, Indonesia, Norway) |
| 5 | **The Daily Post** | `ED002` | Sunday, Nov 8, 2026 | **NO** | `NoQR/` | `ED002_The_Daily_Post.pdf` | 5 | ~404 KB | ₹5.00 | Indian & Global (ESA/Solar, Chicago, South Africa, Japan, UK) |
| 6 | **The National Standard** | `ED003` | Monday, Nov 9, 2026 | **NO** | `NoQR/` | `ED003_The_National_Standard.pdf` | 5 | ~439 KB | ₹5.50 | Indian & Global (Global Energy, Tokyo, Canada, Denmark, US) |

---

## 2. Directory Structure

```text
sample_newspapers/
├── QR/
│   ├── ED001_The_Times.pdf
│   ├── ED002_The_Tribune.pdf
│   └── ED003_The_Herald.pdf
├── NoQR/
│   ├── ED001_The_Gazette.pdf
│   ├── ED002_The_Daily_Post.pdf
│   └── ED003_The_National_Standard.pdf
└── README.md
```

---

## 3. QR Code Specifications (QR Publications Only)

The 3 publications in the `QR/` directory feature scannable, high-contrast QR codes positioned in the top-right corner of Page 1 (the Front Page masthead / ears section).

### Payload Scheme & Base URL Assumption
The QR codes encode absolute frontend routing URLs pointing to the local development environment:
- **Base URL Assumption**: `http://localhost:5173`
- **Route**: `/edition`
- **Query Parameters**:
  - `paper`: URL-encoded newspaper publication name (e.g. `The_Times`)
  - `edition`: Edition identifier string (`ED001`, `ED002`, `ED003`)
  - `date`: ISO 8601 date format (`YYYY-MM-DD`)

### Exact Payloads
1. **The Times (ED001)**:
   ```text
   http://localhost:5173/edition?paper=The_Times&edition=ED001&date=2026-11-07
   ```
2. **The Tribune (ED002)**:
   ```text
   http://localhost:5173/edition?paper=The_Tribune&edition=ED002&date=2026-11-08
   ```
3. **The Herald (ED003)**:
   ```text
   http://localhost:5173/edition?paper=The_Herald&edition=ED003&date=2026-11-09
   ```

### QR Visual Design & Error Correction
- Generated with `qrcode` (Python) using `ERROR_CORRECT_M` error correction.
- Embedded as lossless high-resolution PNG Image XObjects directly into the vector PDF page.
- Verified programmatically via OpenCV's `QRCodeDetector` (`detectAndDecode`).
- Verified for mobile and browser camera scanning using `html5-qrcode`.

### NoQR Publications
The publications in `NoQR/` (`The Gazette`, `The Daily Post`, and `The National Standard`) contain **zero QR codes or QR placeholder boxes**. The top-right masthead ear section instead contains live market index summaries (BSE Sensex, NSE Nifty 50, Rupee/USD exchange, and 24K Gold prices).

---

## 4. Editorial Content, Balance & Layout Composition

### A. 4 Articles Per Page (20 Articles Per Newspaper, 120 Total Across Collection)
Every page is organized according to professional broadsheet editorial guidelines:
- **Page 1 (Front Page)**: 4 major stories — Prominent national lead story (e.g. marine conservation, solar gigawatt parks, AI research corridors), a major secondary story, and 2 regional/national dispatches + 3 bottom news briefs.
- **Page 2 (World & International Affairs)**: 4 distinct international stories — Major diplomatic/clean transit lead, international research partnership, regional environmental/energy initiatives, and cross-border infrastructure + rich vector illustration + 3 global briefs.
- **Page 3 (Business & Global Finance)**: 4 business stories — National banking/digital payments expansion, major overseas financial centers, regional commodity/export exchanges, and international trade accords + financial data chart/diagram + 3 market briefs.
- **Page 4 (Science, Technology & Environment)**: 4 scientific stories — Major research breakthrough, international clean tech/space mission, agricultural biotechnology, and green materials + technical vector diagram + 3 science briefs.
- **Page 5 (Sports & Athletics)**: 4 sports reports — Domestic championship finals (cricket, kabaddi, football, hockey, athletics), international tournament features (regattas, tennis, marathons), and regional athletic news + stadium/tactical radar diagram + 3 sports briefs.

### B. Balanced Indian & International Coverage
- **Indian Regional News**: Realistic coverage across Karnataka (Bengaluru, Mysuru, Hubballi), Maharashtra (Mumbai, Pune, Nagpur, Nashik), Telangana (Hyderabad), Tamil Nadu (Chennai, Coimbatore, Madurai), Rajasthan (Jaipur, Jodhpur), Madhya Pradesh (Bhopal, Indore, Sehore), Kerala (Kochi, Thiruvananthapuram), Gujarat (Ahmedabad, Surat), West Bengal (Kolkata, Darjeeling), Odisha (Paradip, Cuttack), Punjab (Chandigarh, Ludhiana), Assam (Kaziranga), and New Delhi.
- **Global Breadth**: Meaningful international news spanning the United States, United Kingdom, Japan, Germany, France, Switzerland, Canada, Australia, South Korea, Singapore, UAE, Kenya, South Africa, and Brazil.

### C. Plain-English Explanations of Technical Terms
Every technical concept is accompanied by immediate plain-English explanations:
- **Maglev**: *"a high-speed train system that uses powerful magnets to glide smoothly above tracks without touching them, eliminating mechanical friction"*
- **Reverse Osmosis**: *"filtering salty ocean water through ultra-fine synthetic membranes under pressure to remove salt and minerals, yielding pure drinking water"*
- **Quantum Encryption**: *"an ultra-secure communication method that encodes data into microscopic particles of light; any eavesdropper attempting to intercept the signal instantly alters the light and alerts the sender"*
- **Green Hydrogen**: *"clean fuel produced by splitting water molecules using solar electricity, leaving zero carbon emissions"*
- **Sodium-Ion Battery**: *"rechargeable battery cells manufactured using abundant common table salt minerals rather than scarce lithium and cobalt"*
- **SUB1 Gene**: *"a natural plant survival gene that signals submerged rice stalks to enter an energy-saving dormant state while underwater, preventing rotting until floodwaters recede"*

### D. 24 Rich Vector Illustrations (Zero Empty Wireframes)
Every visual is a custom, detailed vector drawing directly connected to its article:
1. *Westminster Palace & Big Ben Silhouette with River Thames and Parliamentary Division Overlay*
2. *Real-Time Asian Currency & UPI Cross-Border Network Telemetry Map*
3. *Airborne Quantum Gravity Gradiometer Subterranean Aquifer Mapping Diagram*
4. *Hubballi Cricket Stadium Field Placement Radar & Scoreboard*
5. *High-Speed Maglev Train on Elevated Concrete Guideway with Magnetic Flux Lines*
6. *BSE SENSEX & NIFTY Candlestick Financial Chart with 50-Day Moving Average*
7. *IIT Madras Nano-Ceramic Water Desalination Filter Flow Diagram*
8. *National Senior Kabaddi Championship Mat Layout & Super-Raid Path*
9. *Dubai Offshore Floating Solar Reverse Osmosis Desalination Facility*
10. *APMC Hubballi Real-Time Electronic Commodity Exchange Bidding Terminal*
11. *Tata Steel Clean Green Hydrogen Blast Furnace Chemical Reduction Schematic*
12. *Kolkata Salt Lake Stadium Derby Winning Goal Tactical Passing Vector*
13. *Two-Nanometer Semiconductor Wafer Die Matrix & GAA-FET Nanosheet Architecture*
14. *National Highway Freight Logistics Route Map & Automated Transit Time Index*
15. *AIIMS New Delhi 4-Arm Articulated Robotic Surgery Suite & 3D Console*
16. *Tokyo International Marathon Elevation Profile & 2:02:28 Split Curve*
17. *Surya-Sentinel Deep-Space Solar Flare Warning Satellite Observatory (L1 Orbit)*
18. *Indore MSME Automated Trade Credit Clearing & GST E-Invoice Flowchart*
19. *Flood-Resilient SUB1 Deepwater Rice Submergence Anatomy & Root Aeration*
20. *Hyderabad Open Badminton Court Smash Speed Telemetry (408 km/h)*
21. *Tokyo Subterranean 50-Meter Giant Floodwater Cistern & Turbine Pump Cavern*
22. *Certified Green Home Front Elevation & Concessional Mortgage Comparison Chart*
23. *Arabian Sea Carlsberg Ridge Subsea Clean Natural Hydrogen Hydrothermal Vent*
24. *Tatya Tope Stadium 400m 8-Lane Track & Record-Breaking 44.82s Split Telemetry*

### E. High Page Area Utilization (85–90% Coverage)
- **Elimination of Blank Spaces**: Packing 4 articles + 1 visual illustration + 3 news briefs per page elevates page character count from ~2,200 to ~3,800–4,200 characters per page.
- **Strict 5-Page Bound**: All pages are strictly bounded at 272mm, ensuring zero overflow to a 6th page across all six newspapers.

---

## 5. Testing & Verification Guidelines

### A. QR Code Scanning Workflow (Phase 4 / 5)
1. **Direct Camera / Screen Scanning**: Open `sample_newspapers/QR/ED001_The_Times.pdf` on screen. Use the app's QR scanner (`/scan`) to scan the QR code located in the top-right corner of page 1.
2. **Payload Parsing**: Confirm that the scanner parses the query parameters `paper=The_Times`, `edition=ED001`, `date=2026-11-07` and navigates smoothly to the edition detail screen (`/edition`).
3. **Uniqueness**: Verify that scanning `The Tribune` and `The Herald` correctly switches editions to `ED002` and `ED003` respectively.

### B. PDF Upload & Layout Extraction Workflow (Phase 4)
1. **Upload Testing**: Test the Drag-and-Drop / File Picker in `/upload` with both QR and NoQR PDFs.
2. **OCR / Layout Analysis (PyMuPDF & Tesseract)**:
   - Confirm article title extraction, kicker extraction, author attribution, and body paragraph segmentation.
   - Confirm exclusion of QR codes, datelines, and running headers from spoken audio script generation.
   - Confirm processing of both 3-column and 2-column editorial grids.

### C. Automated Validation Suite
To execute the comprehensive validation suite locally:
```bash
backend\.venv\Scripts\python.exe scratch/validate_all.py
```
Expected output: **11/11 checks PASS with 100% success rate**.
