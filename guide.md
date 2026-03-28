You are a senior full-stack developer. Build a "Stereogram Studio" web 
application — Phase 1 only. This phase is ONLY about generating stereogram 
images from a content calendar. No blog posts, no WordPress, no Facebook, 
no publishing of any kind.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT THIS APP DOES (Phase 1 scope only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Show a content calendar queue (pre-seeded with 10 items)
2. Let the user click any item to open a generator panel
3. Let the user adjust stereogram settings via form inputs
4. Click "Generate" → run the SIRDS algorithm → show the image
5. Save the generated image to disk (local folder)
6. Show the image in the UI with a download button
7. Update the row status from "Not started" → "Generated"

That is ALL. Nothing else in Phase 1.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECH STACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backend:
  - Python 3.11+
  - FastAPI
  - Pillow + NumPy (stereogram engine)
  - SQLite + SQLAlchemy ORM
  - python-dotenv
  - uvicorn
  - aiofiles

Frontend:
  - Next.js 14 (App Router)
  - TypeScript
  - Tailwind CSS
  - shadcn/ui
  - axios
  - react-query (@tanstack/react-query)

Infrastructure:
  - Docker + Docker Compose
  - .env.example

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

stereogram-studio/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── generated_images/         ← saved PNGs go here (git-ignored)
│   └── services/
│       └── sirds.py              ← ONLY external service needed
│   └── routers/
│       └── stereograms.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   └── page.tsx           ← single page app
        ├── components/
        │   ├── QueueTable.tsx
        │   ├── QueueRow.tsx
        │   ├── StatusBadge.tsx
        │   ├── GeneratorPanel.tsx  ← slides in from right
        │   ├── StatsCards.tsx
        │   └── ImagePreview.tsx
        └── lib/
            ├── api.ts
            └── types.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATABASE SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Table: stereograms
  - id: Integer, PK, autoincrement
  - background_pattern: String  (e.g. "Jester Hat Pattern")
  - hidden_object: String       (e.g. "GOTCHA! text")
  - theme: String               (e.g. "April Fools")
  - post_number: Integer        (1–5)
  - scheduled_date: Date        (2026-04-01 or 2026-04-02)
  - status: String, default "not_started"
            allowed: "not_started" | "generating" | "generated"
  - image_filename: String, nullable   (e.g. "stereogram_1.png")
  - image_url: String, nullable        (e.g. "/static/stereogram_1.png")
  - depth_intensity: Float, default 0.35
  - color_mode: String, default "random"
  - dot_density: Integer, default 5
  - created_at: DateTime, default now
  - updated_at: DateTime, auto-update on change

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEED DATA — pre-populate on first startup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Insert these 10 rows if the table is empty:

  1. Jester Hat Pattern      | GOTCHA! text       | 1 | 2026-04-01 | April Fools
  2. Confetti Explosion      | Mischievous imp     | 2 | 2026-04-01 | April Fools
  3. Checkerboard Warp       | Question mark       | 3 | 2026-04-01 | April Fools
  4. Swirling Hypnosis       | Smiling emoji       | 4 | 2026-04-01 | April Fools
  5. Broken Mirror Shards    | Cracked egg         | 5 | 2026-04-01 | April Fools
  6. Rubber Chicken Texture  | Rubber duck         | 1 | 2026-04-02 | April Fools
  7. Whoopee Cushion Pattern | Fart cloud symbol   | 2 | 2026-04-02 | April Fools
  8. Googly Eyes             | Oversized glasses   | 3 | 2026-04-02 | April Fools
  9. Fake Spiderweb          | Cartoon spider      | 4 | 2026-04-02 | April Fools
 10. Water Droplet Splash    | Tiny fish           | 5 | 2026-04-02 | April Fools

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BACKEND: SIRDS ENGINE (services/sirds.py)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implement a function:
  generate_stereogram(params: dict) -> PIL.Image

Parameters accepted:
  - hidden_object: str       — the text/label to hide in the stereogram
  - background_pattern: str  — name used to pick color palette
  - width: int = 1200
  - height: int = 800
  - depth_intensity: float   — controls how "deep" the hidden object appears
                               range 0.1 to 0.6, default 0.35
  - dot_density: int         — controls noise grain size, range 1–10
  - color_mode: str          — "random" | "warm" | "cool" | "festive"

Step 1 — Generate depth map:
  - Create a black (H x W) grayscale image using PIL
  - Use ImageDraw to write hidden_object text in WHITE, centered
  - Use a large bold font (size proportional to image height / 6)
  - If the font file is not available, use PIL default font at large size
  - Apply GaussianBlur (radius=8) to soften edges
  - Convert to numpy float array, normalize 0.0–1.0

Step 2 — Build color noise strip:
  - Strip width = width // 10
  - Height = full image height
  - Generate random RGB values for each pixel
  - Apply color_mode tint:
    * "warm":    bias R channel high (180–255), G medium, B low
    * "cool":    bias B channel high, G medium, R low
    * "festive": cycle through red/green/yellow/blue rows
    * "random":  pure random, no tint
  - Apply dot_density as a block size — instead of per-pixel noise,
    generate noise at (width//dot_density) resolution then scale up
    using NEAREST resampling (creates visible dot clusters)

Step 3 — SIRDS algorithm:
  - Initialize result array (H x W x 3)
  - Copy noise strip into result[:, 0:strip_width, :]
  - For each column x from strip_width to width:
    For each row y from 0 to height:
      depth_val = depth_map[y, int(x * width_ratio)]  
                  where width_ratio = depth_map.shape[1] / width
      shift = int(depth_val * strip_width * depth_intensity)
      src_x = x - strip_width + shift
      src_x = max(0, min(src_x, x - 1))
      result[y, x] = result[y, src_x]

Step 4 — Post-process and return:
  - Convert numpy array to PIL Image (mode "RGB")
  - Return the PIL Image

Color mode auto-detection from background_pattern:
  "Jester Hat Pattern"        → "festive"
  "Confetti Explosion"        → "festive"
  "Checkerboard Warp"         → "cool"
  "Swirling Hypnosis"         → "warm"
  "Broken Mirror Shards"      → "cool"
  "Rubber Chicken Texture"    → "warm"
  "Whoopee Cushion Pattern"   → "festive"
  "Googly Eyes"               → "random"
  "Fake Spiderweb"            → "cool"
  "Water Droplet Splash"      → "cool"
  anything else               → "random"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BACKEND: API ROUTES (routers/stereograms.py)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GET  /api/stereograms
  - Return all stereograms
  - Support query params: ?date=2026-04-01  ?status=not_started

GET  /api/stereograms/{id}
  - Return single stereogram by ID

PUT  /api/stereograms/{id}
  - Update any field (background_pattern, hidden_object, depth_intensity,
    color_mode, dot_density)
  - Used when user edits inputs in the generator panel before generating

POST /api/stereograms/{id}/generate
  - This is the main action endpoint
  - Step 1: Set status = "generating", save to DB, return immediately
            so frontend can show spinner (use BackgroundTasks for the 
            actual generation work)
  - Step 2 (background): Run sirds.generate_stereogram() with current 
            DB values for this record
  - Step 3: Save image as PNG to ./generated_images/stereogram_{id}.png
  - Step 4: Update DB record:
            image_filename = "stereogram_{id}.png"
            image_url = "/static/stereogram_{id}.png"
            status = "generated"
  - Frontend polls GET /api/stereograms/{id} every 2 seconds to detect
    when status changes from "generating" to "generated"

POST /api/stereograms/{id}/regenerate
  - Same as /generate but always overwrites existing image
  - Resets status to "generating" first

GET  /api/stereograms/{id}/download
  - Stream the PNG file as a file download response
  - Content-Disposition: attachment; filename="magic-eye-{pattern}-{id}.png"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BACKEND: main.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Mount StaticFiles at /static serving ./generated_images/
- Enable CORS for http://localhost:3000
- On startup: create DB tables + run seed if table is empty
- Include stereograms router with prefix /api
- Health check: GET /health → {"status": "ok"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRONTEND: SINGLE PAGE UI (app/page.tsx)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The entire app lives on one page split into two panels:

LEFT PANEL (60% width) — Queue
  ┌─────────────────────────────────────┐
  │ Stereogram Studio                   │
  │ The Magic Eye 3D — Content Calendar │
  │                                     │
  │ [Total: 10] [Not started: 10]       │
  │ [Generated: 0] [Apr 1: 5] [Apr 2:5] │
  │                                     │
  │ Filter: [All dates ▼] [All status▼] │
  │                                     │
  │ ┌──────────────────────────────┐    │
  │ │ # │ Pattern │ Object │Status │    │
  │ ├──────────────────────────────┤    │
  │ │ 1 │ Jester  │ GOTCHA │ ●    │    │  ← clickable row
  │ │ 2 │ Confett │ Imp    │ ●    │    │
  │ │ ...                          │    │
  │ └──────────────────────────────┘    │
  └─────────────────────────────────────┘

RIGHT PANEL (40% width) — Generator
  Shows when a queue row is clicked.
  Shows placeholder "Select an item from the queue" when nothing selected.

  ┌─────────────────────────────────────┐
  │ Jester Hat Pattern  #1  Apr 1       │
  │ ─────────────────────────────────── │
  │                                     │
  │ GENERATOR SETTINGS                  │
  │                                     │
  │ Background pattern                  │
  │ [Jester Hat Pattern          ]      │  ← text input, pre-filled
  │                                     │
  │ Hidden object                       │
  │ [GOTCHA! text                ]      │  ← text input, pre-filled
  │                                     │
  │ Theme                               │
  │ [April Fools                 ]      │  ← text input, pre-filled
  │                                     │
  │ Color mode                          │
  │ [Festive ▼]                         │  ← select, auto-detected
  │                                     │
  │ Depth intensity      [━━●━━━] 0.35  │  ← range slider
  │                                     │
  │ Dot density          [━●━━━━] 3     │  ← range slider
  │                                     │
  │ Output size                         │
  │ [1200 x 800 ▼]                      │  ← select: 800x600/1200x800/1920x1080
  │                                     │
  │ [  Generate stereogram  ]           │  ← primary button
  │                                     │
  │ ─────────────────────────────────── │
  │                                     │
  │ PREVIEW                             │
  │                                     │
  │ ┌─────────────────────────────┐     │
  │ │                             │     │
  │ │   [image shows here]        │     │  ← img tag, src=image_url
  │ │                             │     │
  │ └─────────────────────────────┘     │
  │                                     │
  │ [Download PNG]  [Regenerate]        │
  │                                     │
  └─────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRONTEND: COMPONENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QueueTable.tsx:
  - Use react-query to fetch GET /api/stereograms
  - Auto-refetch every 2000ms if ANY row has status "generating"
    (stop polling when all rows are "not_started" or "generated")
  - Clicking a row: set selectedId state, panel opens
  - Highlight the selected row with a left border accent
  - Columns: Post# | Background Pattern | Hidden Object | Date | Status
  - Each row shows status badge (see StatusBadge below)

StatusBadge.tsx:
  - "not_started" → gray pill "Not started"
  - "generating"  → amber pill "Generating..." with animated pulse dot
  - "generated"   → green pill "Generated"

GeneratorPanel.tsx:
  - Receives selectedStereogram as prop
  - All inputs are controlled components
  - On input change: call PUT /api/stereograms/{id} to persist immediately
    (debounce 500ms so it doesn't spam on every keystroke)
  - "Generate stereogram" button:
    1. Call POST /api/stereograms/{id}/generate
    2. Button shows loading spinner, disabled
    3. Poll GET /api/stereograms/{id} every 2s
    4. When status = "generated", show image in preview
    5. Re-enable button (now shows as "Regenerate")
  - Image preview:
    * Show skeleton loader while status = "generating"
    * Show <img> with src={NEXT_PUBLIC_API_URL + stereogram.image_url}
      when image_url is not null
    * Image must be clickable to open full size in new tab
  - Download button: calls GET /api/stereograms/{id}/download
    and triggers browser file download
  - Show image metadata below preview:
    "1200 × 800px  •  PNG  •  Generated just now"

StatsCards.tsx:
  - 4 metric cards in a row:
    Total | Not Started | Generated | Theme (April Fools)
  - Numbers derived from the same react-query data (no extra API call)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRONTEND: lib/types.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type StereogramStatus = "not_started" | "generating" | "generated"

export interface Stereogram {
  id: number
  background_pattern: string
  hidden_object: string
  theme: string
  post_number: number
  scheduled_date: string       // "2026-04-01"
  status: StereogramStatus
  image_filename: string | null
  image_url: string | null     // "/static/stereogram_1.png"
  depth_intensity: number      // 0.1 – 0.6
  color_mode: string           // "random"|"warm"|"cool"|"festive"
  dot_density: number          // 1 – 10
  created_at: string
  updated_at: string
}

export interface UpdateStereogramPayload {
  background_pattern?: string
  hidden_object?: string
  theme?: string
  depth_intensity?: number
  color_mode?: string
  dot_density?: number
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRONTEND: lib/api.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export const api = {
  listStereograms: (params?) => axios.get(`${BASE}/api/stereograms`, {params}),
  getStereogram: (id) => axios.get(`${BASE}/api/stereograms/${id}`),
  updateStereogram: (id, data) => axios.put(`${BASE}/api/stereograms/${id}`, data),
  generateStereogram: (id) => axios.post(`${BASE}/api/stereograms/${id}/generate`),
  regenerateStereogram: (id) => axios.post(`${BASE}/api/stereograms/${id}/regenerate`),
  downloadUrl: (id) => `${BASE}/api/stereograms/${id}/download`,
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENVIRONMENT VARIABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

.env.example:
  DATABASE_URL=sqlite:///./stereogram_studio.db
  NEXT_PUBLIC_API_URL=http://localhost:8000

That's it. No other env vars needed for Phase 1.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCKER COMPOSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes:
      - ./backend:/app
      - ./backend/generated_images:/app/generated_images
    environment:
      - DATABASE_URL=sqlite:///./stereogram_studio.db
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. The app must work with zero external API keys.
   Just clone → docker-compose up → open localhost:3000 → generate.

2. Image generation happens in a FastAPI BackgroundTask so the HTTP
   response returns immediately (don't make the user wait 5+ seconds
   for the POST to respond).

3. The PUT /api/stereograms/{id} (save inputs) must be called on every
   input change (debounced). This means if the user edits "hidden object"
   from "GOTCHA! text" to "Dancing banana" and clicks Generate, the
   generation uses "Dancing banana" — not the original seeded value.

4. The frontend must show a proper loading state during generation:
   - Button: disabled + spinner icon + "Generating..."
   - Preview area: skeleton/shimmer placeholder
   - Queue row badge: animated amber "Generating..."

5. After generation completes, the queue row badge must update to green
   "Generated" automatically without page refresh (react-query refetch).

6. generated_images/ folder must be in .gitignore.

7. Add a .gitignore to the root covering: __pycache__, *.pyc,
   generated_images/, .env, node_modules/, .next/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUILD ORDER (follow exactly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.  Root: docker-compose.yml, .env.example, .gitignore, README.md
2.  Backend: requirements.txt, Dockerfile
3.  Backend: database.py → models.py → schemas.py
4.  Backend: services/sirds.py
    → After writing it, test it standalone:
      python -c "
      from services.sirds import generate_stereogram
      img = generate_stereogram({
        'hidden_object': 'TEST',
        'background_pattern': 'Jester Hat Pattern',
        'width': 400, 'height': 300,
        'depth_intensity': 0.35,
        'dot_density': 5,
        'color_mode': 'festive'
      })
      img.save('test_output.png')
      print('OK — saved test_output.png')
      "
      Fix any errors before continuing.
5.  Backend: routers/stereograms.py (all routes)
6.  Backend: main.py (app, CORS, static files, startup seed)
    → Test: curl http://localhost:8000/api/stereograms
    → Should return 10 seeded items
    → Test: curl -X POST http://localhost:8000/api/stereograms/1/generate
    → Should create generated_images/stereogram_1.png
7.  Frontend: Dockerfile, package.json, next.config.ts, tailwind.config.ts
8.  Frontend: lib/types.ts + lib/api.ts
9.  Frontend: components/StatusBadge.tsx
10. Frontend: components/StatsCards.tsx
11. Frontend: components/QueueTable.tsx + QueueRow.tsx
12. Frontend: components/ImagePreview.tsx
13. Frontend: components/GeneratorPanel.tsx
14. Frontend: app/layout.tsx + app/page.tsx
15. Final: docker-compose up --build
    → Open http://localhost:3000
    → Click row 1 → verify inputs pre-filled
    → Click Generate → verify spinner + polling + image appears
    → Verify queue row badge turns green
    → Click Download → verify PNG downloads

Do not proceed to a next step until the current step works correctly.