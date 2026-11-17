/**
 * The Daily Voice - Sample Newspaper & Article Data (Phase 2 UI Reference)
 * Labelled as curated sample data for UI demonstration purposes.
 */

export const CATEGORIES = [
  { id: 'current-affairs', name: 'Current Affairs', iconName: 'Newspaper', description: 'Headlines, civic updates, and developing stories.' },
  { id: 'sports', name: 'Sports', iconName: 'Trophy', description: 'Championships, match reports, and athlete profiles.' },
  { id: 'world', name: 'World', iconName: 'Globe', description: 'International diplomacy, treaties, and global affairs.' },
  { id: 'finance', name: 'Finance', iconName: 'TrendingUp', description: 'Markets, economic policy, industry, and trade.' },
  { id: 'science-tech', name: 'Science & Technology', iconName: 'Cpu', description: 'AI breakthroughs, space exploration, and discoveries.' },
  { id: 'politics', name: 'Politics', iconName: 'Landmark', description: 'Legislation, elections, governance, and policy debates.' },
];

export const SAMPLE_EDITIONS = [
  {
    id: 'chronicle-2026-11-14',
    name: 'The Daily Chronicle',
    date: 'Saturday, November 14, 2026',
    shortDate: 'November 14, 2026',
    editionCode: 'ED001',
    editionFormatted: 'ED001 — November 14, 2026',
    editionId: 'Vol. 142, No. 89',
    articleCount: 28,
    location: 'National Edition',
    weather: '18°C Mild & Breezy',
    tagline: 'The Independent Journal of Record Since 1884',
    coverTag: 'Today’s Lead Edition',
    headlinesCount: 6,
    headlineAudioDuration: '4m 20s',
  },
  {
    id: 'herald-2026-11-14',
    name: 'The Morning Herald',
    date: 'Saturday, November 14, 2026',
    shortDate: 'November 14, 2026',
    editionCode: 'ED002',
    editionFormatted: 'ED002 — November 14, 2026',
    editionId: 'Vol. 98, No. 312',
    articleCount: 22,
    location: 'Metropolitan Area',
    weather: '16°C Clear',
    tagline: 'Morning Perspective on City and Global Affairs',
    coverTag: 'Weekend Edition',
    headlinesCount: 5,
    headlineAudioDuration: '3m 50s',
  },
  {
    id: 'gazette-2026-11-07',
    name: 'The Financial Gazette',
    date: 'Saturday, November 7, 2026',
    shortDate: 'November 7, 2026',
    editionCode: 'ED003',
    editionFormatted: 'ED003 — November 7, 2026',
    editionId: 'Vol. 76, No. 45',
    articleCount: 18,
    location: 'Weekend Broadsheet',
    weather: '15°C Overcast',
    tagline: 'Market Intelligence and Global Commerce Analysis',
    coverTag: 'Archived Edition',
    headlinesCount: 4,
    headlineAudioDuration: '3m 15s',
  },
];

export const SAMPLE_ARTICLES = [
  {
    id: 'art-001',
    editionId: 'chronicle-2026-11-14',
    newspaperName: 'The Daily Chronicle',
    category: 'Current Affairs',
    categoryId: 'current-affairs',
    title: 'Global Renewable Infrastructure Reaches Historic Grid Milestone',
    publisher: 'Chronicle Bureau • Elena Rostova',
    publishDate: 'Nov 14, 2026',
    durationSeconds: 275,
    durationFormatted: '4:35',
    isHeadline: true,
    summary: 'Cross-continental transmission grids have officially sustained more than sixty percent baseline generation from solar, offshore wind, and battery reserves for three consecutive quarters.',
    content: `Energy authorities confirmed this morning that regional transmission networks spanning multiple jurisdictions achieved an unprecedented sixty-two percent renewable baseline over the past three quarters. The shift follows five years of accelerated capital deployment in ultra-high-voltage direct-current transmission interconnectors and decentralized battery storage installations.

Industrial consumers and municipal utilities reported record-low wholesale prices throughout the peak morning demand window, dampening inflationary pressures on consumer goods manufacturing. Grid operators noted that dynamic frequency regulation systems maintained network stability without relying on reserve fossil peaker plants during unseasonal weather anomalies last month.

International energy monitors described the achievement as a watershed moment for infrastructure modernization, demonstrating that modern synchronized converter architecture can reliably stabilize continental-scale power grids under variable climatic regimes.`,
  },
  {
    id: 'art-002',
    editionId: 'chronicle-2026-11-14',
    newspaperName: 'The Daily Chronicle',
    category: 'Science & Technology',
    categoryId: 'science-tech',
    title: 'Autonomous Ocean Sentinels Map Uncharted Deep-Sea Coral Basins',
    publisher: 'Science Desk • Dr. Marcus Vance',
    publishDate: 'Nov 14, 2026',
    durationSeconds: 310,
    durationFormatted: '5:10',
    isHeadline: true,
    summary: 'A fleet of solar-gliding autonomous underwater submersibles has completed a high-resolution acoustic survey of a thousand-mile subsea ridge previously unmapped by oceanographers.',
    content: `Oceanographic research teams have revealed high-resolution bathymetric models and environmental DNA sequencing from deep-water abyssal plains along the Mariana Ridge. The findings indicate thriving cold-water biospheres situated three thousand meters below sea level, sustained by hydrothermal venting and mineral-rich benthic currents.

The autonomous gliders operated without human intervention for ninety-four continuous days, surfacing periodically to transmit acoustic tomography datasets back to marine laboratory clusters via low-orbit satellite constellations.

Biologists emphasized that these newly cataloged benthic communities hold unique biochemical enzymes with promising applications in pharmaceutical biotechnology and enzyme-catalyzed carbon mineralization.`,
  },
  {
    id: 'art-003',
    editionId: 'chronicle-2026-11-14',
    newspaperName: 'The Daily Chronicle',
    category: 'Finance',
    categoryId: 'finance',
    title: 'Central Banks Harmonize Digital Settlement Standards for Cross-Border Trade',
    publisher: 'Financial Markets • Sarah Lin',
    publishDate: 'Nov 14, 2026',
    durationSeconds: 240,
    durationFormatted: '4:00',
    isHeadline: true,
    summary: 'Multilateral banking delegates have finalized a unified settlement protocol aimed at cutting cross-border transaction latency from three business days to under six seconds.',
    content: `Financial ministers and monetary authorities concluded a four-day multilateral summit today, establishing standardized cryptographic messaging protocols for wholesale currency settlement. The framework removes intermediary correspondent banking friction for non-domestic commercial transactions.

Export-oriented manufacturing firms praised the development, citing estimated operational savings of billions annually in foreign exchange hedging costs and settlement reconciliation reserves.

Commercial lenders are slated to begin bilateral pilot migrations during the first quarter of next year, supported by synchronized liquidity guarantees from participating central banks.`,
  },
  {
    id: 'art-004',
    editionId: 'chronicle-2026-11-14',
    newspaperName: 'The Daily Chronicle',
    category: 'Sports',
    categoryId: 'sports',
    title: 'Century-Old Rowing Regatta Sees Historic Record Smashed on River Thames',
    publisher: 'Sports Correspondents • Julian Thorne',
    publishDate: 'Nov 14, 2026',
    durationSeconds: 195,
    durationFormatted: '3:15',
    isHeadline: false,
    summary: 'A lightweight mixed crew recorded the fastest upstream river time in regatta history, slicing eight seconds off a benchmark that stood untouched for three decades.',
    content: `Spectators along the riverbanks witnessed an extraordinary tactical display during the final leg of the autumn classic. Entering the final bend trailing by a canvas length, the collegiate boat executed a daring split-second cadence surge that dismantled their opponents' rhythm.

The official timing committee confirmed a new course record of fourteen minutes and thirty-two seconds. The winning stroke oarswoman attributed their tactical precision to telemetry-guided pacing monitors that helped conserve stamina for the final five hundred meters against an unusually heavy downstream current.`,
  },
  {
    id: 'art-005',
    editionId: 'chronicle-2026-11-14',
    newspaperName: 'The Daily Chronicle',
    category: 'World',
    categoryId: 'world',
    title: 'Bilateral Conservation Accord Secures Trans-Himalayan Wildlife Corridor',
    publisher: 'Diplomatic Desk • Anya Sharma',
    publishDate: 'Nov 14, 2026',
    durationSeconds: 260,
    durationFormatted: '4:20',
    isHeadline: false,
    summary: 'Neighboring nations sign a landmark treaty safeguarding critical migratory routes for snow leopards and alpine ecosystems across shared border ridges.',
    content: `Ministers of environment from both sides of the Himalayan divide signed a binding treaty in Geneva today, establishing a contiguous six-thousand-square-kilometer sanctuary. The initiative coordinates joint ranger patrols, real-time satellite anti-poaching surveillance, and community grazing compacts.

Ecologists highlighted that high-altitude species face shifting snowlines due to seasonal temperature shifts, requiring unrestricted movement across contiguous mountainous terrain to maintain genetic viability.

The accord also provisions permanent funding for indigenous highland communities who serve as primary conservators and field monitors along the remote passes.`,
  },
  {
    id: 'art-006',
    editionId: 'chronicle-2026-11-14',
    newspaperName: 'The Daily Chronicle',
    category: 'Politics',
    categoryId: 'politics',
    title: 'Bipartisan Senate Panel Introduces Universal Digital Privacy Bill',
    publisher: 'Capitol Bureau • David Ross',
    publishDate: 'Nov 14, 2026',
    durationSeconds: 285,
    durationFormatted: '4:45',
    isHeadline: false,
    summary: 'Proposed legislation establishes federal limits on biometric profiling, third-party data aggregation, and dark patterns in automated decision engines.',
    content: `Congressional committee leaders unveiled a comprehensive legislative package today aimed at codifying citizens' rights over personal data profiles. The bill establishes strict transparency mandates for algorithmic recommendation platforms and prohibits covert audio and behavioral tracking across consumer devices.

Hearings will commence next Tuesday, with civil liberties advocates and software industry representatives scheduled to provide testimony before the full judiciary chamber.

The bill's sponsors expressed confidence in floor passage before the winter recess, pointing to widespread public demand for clear, enforceable baseline protections.`,
  },
  {
    id: 'art-007',
    editionId: 'chronicle-2026-11-14',
    newspaperName: 'The Daily Chronicle',
    category: 'Current Affairs',
    categoryId: 'current-affairs',
    title: 'Urban Forestry Initiative Lowers City Core Temperatures by Three Degrees',
    publisher: 'Urban Affairs • Miriam Cole',
    publishDate: 'Nov 14, 2026',
    durationSeconds: 210,
    durationFormatted: '3:30',
    isHeadline: false,
    summary: 'A municipal green corridor network completed last spring has significantly reduced the urban heat island effect across eight densely populated boroughs.',
    content: `Sensor telemetry from over twelve hundred municipal microclimate weather stations demonstrates a steady three-degree Celsius ambient temperature reduction in the commercial core. The city's continuous pedestrian canopy, permeable pavements, and vertical vine trellises absorbed substantial solar radiation during the recent late-summer heatwave.

Public health officials also reported an eight percent decrease in heat-related respiratory admissions, reinforcing the direct societal return of ecological urban design.`,
  },
  {
    id: 'art-008',
    editionId: 'herald-2026-11-14',
    newspaperName: 'The Morning Herald',
    category: 'Current Affairs',
    categoryId: 'current-affairs',
    title: 'Metro High-Speed Transit Expansion Opens Three New Regional Hubs',
    publisher: 'City Desk • Clara Morales',
    publishDate: 'Nov 14, 2026',
    durationSeconds: 230,
    durationFormatted: '3:50',
    isHeadline: true,
    summary: 'Commuters cut peak travel times by forty percent as the metropolitan electrified rail corridor enters commercial operations this weekend.',
    content: `The metropolitan transportation commission inaugurated three multi-modal transport stations today, linking the outer industrial belt directly to the central financial quarter. Automated rolling stock will operate on five-minute headways during peak morning commutes.`,
  },
  {
    id: 'art-009',
    editionId: 'gazette-2026-11-07',
    newspaperName: 'The Financial Gazette',
    category: 'Finance',
    categoryId: 'finance',
    title: 'Sovereign Wealth Funds Reallocate Capital Toward Sovereign Clean Tech',
    publisher: 'Markets Bureau • Arthur Sterling',
    publishDate: 'Nov 7, 2026',
    durationSeconds: 260,
    durationFormatted: '4:20',
    isHeadline: true,
    summary: 'Institutional asset managers deploy multi-billion strategic tranches into next-generation grid storage and geothermal venture consortiums.',
    content: `The global asset management summit in Zurich highlighted a structural pivot among sovereign balance sheets, as state funds reallocated strategic allocations toward deep-geothermal drilling and regional water reclamation projects.`,
  },
];

export const INITIAL_SAVED_ARTICLES = [
  'art-001',
  'art-003',
];

export const INITIAL_LISTENING_HISTORY = [
  {
    articleId: 'art-001',
    progressSeconds: 165,
    durationSeconds: 275,
    lastPlayedAt: 'Today at 09:15 AM',
    isCompleted: false,
  },
  {
    articleId: 'art-002',
    progressSeconds: 310,
    durationSeconds: 310,
    lastPlayedAt: 'Yesterday at 06:40 PM',
    isCompleted: true,
  },
  {
    articleId: 'art-003',
    progressSeconds: 90,
    durationSeconds: 240,
    lastPlayedAt: 'Yesterday at 01:20 PM',
    isCompleted: false,
  },
];
