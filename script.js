/* trent-buckley.com - terminal portfolio */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const output = $("#output");
  const input = $("#cmd");
  const form = $("#prompt-form");
  const caret = $(".caret");
  const promptPrefix = $("#prompt-prefix");
  const terminal = $("#terminal");

  const PROMPT_TEXT = "guest@trent-buckley:~$ ";
  promptPrefix.textContent = PROMPT_TEXT;

  const state = {
    history: [],
    historyIndex: -1,
    typing: null,           // active typing controller
    skipRequested: false,
    booted: false,
    theme: localStorage.getItem("tb.theme") || "green",
  };

  applyTheme(state.theme);

  const LOG_ENDPOINT = "https://trent-term-log.bordertechsolutions.workers.dev/";
  let visitorId = localStorage.getItem("tb.visitorId");
  if (!visitorId) {
    visitorId = (crypto.randomUUID && crypto.randomUUID()) ||
      (Date.now().toString(36) + Math.random().toString(36).slice(2));
    localStorage.setItem("tb.visitorId", visitorId);
  }
  function logToWorker(type, cmd) {
    try {
      fetch(LOG_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, cmd, visitorId, referrer: document.referrer || "" }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  // ---------- ASCII banner ----------
  const BANNER_FULL = String.raw`
████████╗██████╗ ███████╗███╗   ██╗████████╗
╚══██╔══╝██╔══██╗██╔════╝████╗  ██║╚══██╔══╝
   ██║   ██████╔╝█████╗  ██╔██╗ ██║   ██║
   ██║   ██╔══██╗██╔══╝  ██║╚██╗██║   ██║
   ██║   ██║  ██║███████╗██║ ╚████║   ██║
   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝
██████╗ ██╗   ██╗ ██████╗██╗  ██╗██╗     ███████╗██╗   ██╗
██╔══██╗██║   ██║██╔════╝██║ ██╔╝██║     ██╔════╝╚██╗ ██╔╝
██████╔╝██║   ██║██║     █████╔╝ ██║     █████╗   ╚████╔╝
██╔══██╗██║   ██║██║     ██╔═██╗ ██║     ██╔══╝    ╚██╔╝
██████╔╝╚██████╔╝╚██████╗██║  ██╗███████╗███████╗   ██║
╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝
`;

  const BANNER_COMPACT = "[ trent-buckley ]";

  // ---------- Content ----------
  const ABOUT = {
    trent: [
      "Hi! My name is Trent, and I'm someone who's always been driven by curiosity and creativity. I have a wide range of hobbies, from programming and gaming to reading, experimenting, and constantly learning new things.",
      "I'm entirely self-taught and confident in my ability to work across several programming languages, including Python, HTML, CSS, JavaScript, Java, C, C++, and VB. Over the years, I've built up a toolkit that lets me explore everything from web development and automation to software design and creative coding projects.",
      "Try `about skills`, `about service`, `about philosophy`, or `about roots` for more.",
    ],
    skills: [
      "{section}Programming languages",
      "  Python  ·  JavaScript  ·  TypeScript  ·  HTML  ·  CSS  ·  Java  ·  C  ·  C++  ·  VB",
      "",
      "{section}Frontends",
      "  React (TypeScript) + Vite + Tailwind, vanilla JS/CSS, accessible UI patterns.",
      "",
      "{section}Backends",
      "  Python (FastAPI) services, Java (custom Minecraft plugins), Node, REST API design.",
      "",
      "{section}Data & integrations",
      "  MySQL, SQLite, Discord API, payment gateways, webhooks, automation pipelines.",
      "",
      "{section}Tooling & ops",
      "  Electron desktop apps, Vite, Caddy, Git, CI workflows, hardware/repair work.",
      "",
      "{section}Interests",
      "  Web · Automation · Creative coding · Hardware · Games · Emergency-services tech",
    ],
    roots: [
      "{section}Roots",
      "I grew up in the south-eastern suburbs of Melbourne before moving to country New South Wales, and now I call country Victoria home.",
      "Growing up in different parts of Australia has given me a deep appreciation for how diverse and interconnected people and communities can be. It has also shaped how I approach my work: practical, adaptable, and always focused on learning from my environment and the people around me.",
    ],
    service: [
      "{section}Service",
      "For the past ten years, I've dedicated a significant part of my life to working in emergency services, both in volunteer and paid roles.",
      "During that time, I've served with Fire and Rescue NSW, the NSW Rural Fire Service, NSW Ambulance, and now my latest venture, the Country Fire Authority in Victoria.",
      "These experiences have taught me the value of teamwork, resilience, leadership, and staying calm under pressure. They've also given me a strong sense of purpose and community, qualities I bring into every aspect of my professional and personal life.",
    ],
    philosophy: [
      "{section}Philosophy",
      "I was raised in the care of the state, and that experience taught me a powerful lesson early on: if you want something out of life, you have to build it yourself. That philosophy has stuck with me and continues to guide everything I do.",
      "I take pride in being driven, resourceful, and determined to keep improving. Whether I'm developing a new program, debugging a tricky problem, or experimenting with an idea that's a little outside the box, I approach it all with enthusiasm and persistence.",
      "As a ward of the state, money was scarce, but from as young as 9 I was deeply invested in technology. I would ride my bicycle around the suburbs during hard-waste collections, pick up discarded computers from nature strips, bring them home to diagnose and repair, reformat drives and re-install Windows, and then resell the working machines through my local op shop. It taught me resourcefulness, customer empathy, and the value of making old hardware useful again.",
    ],
    beyond: [
      "{section}Beyond the screen",
      "I've only recently started sharing some of my past work, so when you visit my portfolio, it might seem a bit bare at first glance, but that's only the beginning. I have a backlog of projects, concepts, and experiments that I plan to refine and publish over time.",
      "My goal is to create not just for the sake of it, but to build things that make a difference, solve problems, and hopefully inspire others to learn and explore as well.",
      "When I'm not coding, you'll usually find me gaming, reading, tinkering with hardware, or diving into something completely new just to see how it works. I believe that staying curious is one of the best ways to keep growing, both personally and professionally.",
    ],
    quickfacts: [
      "{section}Quick facts",
      "  location     Country Victoria, Australia (AEST/AEDT)",
      "  experience   20+ years working with IT",
      "               10+ years in emergency services",
      "  business     owner/operator - Border Tech Solutions (bordertechsolutions.com.au)",
      "  comfortable  Python · JavaScript · TypeScript · HTML · CSS · Java · C/C++ · VB",
      "  interests    Web · Automation · Creative Coding · Hardware · Games",
    ],
  };

  const PORTFOLIO_INDEX = [
    { id: "bordertech", title: "Border Tech Solutions", blurb: "My IT & web services business in Albury-Wodonga. Live at bordertechsolutions.com.au." },
    { id: "ferrule", title: "Ferrule (ITFlow mobile)", blurb: "Cross-platform Flutter client for the ITFlow MSP backend. Live in Play Store closed testing." },
    { id: "prism", title: "Prism SMP Platform", blurb: "Retired Minecraft network. Custom Java plugins, FastAPI backend, React frontend." },
    { id: "payments", title: "Payments Platform", blurb: "Web checkout, automated reminders, Electron POS, accounting sync, secure API." },
  ];

  const PORTFOLIO = {
    bordertech: [
      "{section}Border Tech Solutions",
      "Live:    https://bordertechsolutions.com.au",
      "Status:  https://bordertechsolutions.com.au/status",
      "Email:   support@bordertechsolutions.com.au",
      "Based:   West Wodonga - serving NSW & VIC, both sides of the Murray.",
      "Hours:   Mon-Fri, 8am-5:30pm (24/7 emergency for managed-IT clients).",
      "",
      "I own and operate Border Tech Solutions - a solo IT and web services business looking after small businesses across the Albury-Wodonga border region. One inbox, one person, every time. Tagline: \"We take the hassle out of your IT.\"",
      "",
      "{section}Websites for small business",
      "Three fixed packages with copywriting, hosting, and ongoing care included:",
      "  - The Shopfront    from $995   single sharp page, contact form, Google Business setup, first year hosting.",
      "  - The Local        from $2,800 4-6 pages, copywriting help, booking forms, SEO foundations, hosting & care.",
      "  - The Workhorse    from $5,400 The Local + ecommerce / bookings / members, payments wired up, team training.",
      "Every site: real Australian copy, sub-second load on a country mobile signal, Australian-hosted, looked after by me.",
      "",
      "{section}IT services",
      "  - Managed IT       monitoring, patching, backups, security. Suits 5+ machines that can't afford downtime.",
      "  - Break-fix        on-site or remote, no contract required. The \"it was working yesterday\" calls.",
      "  - Hosting/domains  Australian-hosted, properly backed up, no creative renewal pricing.",
      "  - Business email   Microsoft 365 or Google Workspace on a domain that's actually yours.",
      "",
      "{section}Notable build - caravan park access control (Tocumwal)",
      "Sourced the hardware, wrote the management software, and wired in number-plate recognition for an automated boom-gate system that locks out guests with overdue fees. Phone-friendly dashboard, real-time alerts on overstays and unpaid drive-ins, end-to-end install and training.",
      "",
      "{section}Stack used across BTS work",
      "  - Frontend       hand-written HTML/CSS/JS, vanilla and React/TypeScript when scale calls for it.",
      "  - Backend        Python (FastAPI), Node, custom services per job.",
      "  - Infra          Cloudflare Workers, Australian hosting, status page, monitoring.",
      "  - Hardware       PC/laptop repair, networking, POS, peripherals, occasional bespoke kit (cameras, gates, sensors).",
      "",
      "{section}How I work",
      "  Big Ears.  Listen first. Most of the time you already know what's wrong.",
      "  No Bull.   No acronym soup, no upsell, no invoicing for the chat about your kid's footy.",
      "",
      "{muted}25+ websites and projects shipped. 20+ years in IT. One person you'll ever speak to.",
    ],
    ferrule: [
      "{section}Ferrule - ITFlow mobile client",
      "App:     Ferrule (au.com.bordertechsolutions.ferrule)",
      "Repo:    github.com/BoredManCodes/ferrule (Flutter app)",
      "Fork:    github.com/BoredManCodes/itflow (PHP backend additions)",
      "Status:  Play Store closed testing - alpha",
      "Stack:   Flutter, Dart, Riverpod, GoRouter, Dio, html parser, PHP 8 / MySQL",
      "",
      "Ferrule is a cross-platform mobile client for ITFlow, the open-source MSP/PSA system I use to run my own IT business. The web app is a working tool but it's not a phone-friendly tool, so I built one. The app talks to a user-hosted ITFlow instance over its REST API where one exists and politely scrapes the agent web UI everywhere else - all paths, both REST and scraped, are pinned behind a single Dio client with cookie + CSRF handling.",
      "",
      "{section}Why \"Ferrule\"?",
      "A ferrule is the metal sleeve crimped onto the end of a cable, pencil, or umbrella to keep the strands bound and stop them fraying. The app is a thin metal cap over an ITFlow backend - it binds the loose ends (REST endpoints, agent CSRF flows, PDF exports, guest links) into one client surface without changing what's inside.",
      "",
      "{section}Architecture",
      "  - Flutter app for Android, iOS, and Windows from a single Dart codebase.",
      "  - Riverpod 3 for state and async caching; GoRouter for type-safe deep links.",
      "  - Dio + html parser to talk to two surfaces of the same backend:",
      "      REST   /api/v1/*  for module reads (clients, contacts, assets, tickets, invoices, quotes, expenses, credentials, products, vendors, ...).",
      "      Agent  /agent/*   for things the REST API doesn't cover - scraped with proper CSRF token handling and session retry on lapse.",
      "  - Local secure storage for API keys and agent credentials, optional biometric unlock at launch.",
      "  - Sentry for opt-in crash reporting; all network egress goes to the user's own ITFlow instance.",
      "",
      "{section}Features shipped",
      "  - Read all the things: clients, contacts, assets, credentials, tickets, invoices, quotes, expenses, products, vendors, locations, networks, certificates, software, documents, domains.",
      "  - Detail screens cross-link related records - tap a client on an invoice, a contact on an asset, a credential on a ticket, and so on. Linked IDs render as names, not numbers.",
      "  - Invoice screen with Bill-To, line items, amounts, notes, guest-view shareable link, and an in-app Make Payment form that scrapes the agent payment modal for CSRF, balance, accounts, and methods.",
      "  - Quote screen mirroring invoices: line items, guest link, and PDF download. Required a new /api/v1/quote_items/read.php endpoint on the PHP fork.",
      "  - PDF exports for both invoices and quotes, fetched through the same authenticated session and shared via the OS share sheet.",
      "  - Expense creation with receipt upload from camera or files (jpg, png, gif, webp, pdf) - multipart POST to add_expense.",
      "  - In-app privacy policy rendered from PRIVACY.md so the page works offline and survives a GitHub outage.",
      "",
      "{section}Backend contributions (PHP fork)",
      "I maintain a small fork of ITFlow for API additions the app needs:",
      "  - /api/v1/quote_items/read.php - line items for a quote, JOINed to quotes for client scope.",
      "  - /api/v1/ticket_replies/* - read and create endpoints for ticket conversations.",
      "  - All upstreamable; pinned to the same fork so the app can pull the changes cleanly.",
      "",
      "{section}Release pipeline",
      "Closed-testing releases ship through a self-contained PowerShell + Node pipeline:",
      "  - release-internal.ps1 - builds the AAB, uploads to Play Console via the Android Publisher API, manages version codes, attaches release notes.",
      "  - promote-closed-testing.mjs - Playwright-driven Chromium that clicks Edit Release -> Next -> Save on the review page, then Send for Review on Publishing overview (the part Google's API doesn't expose for the closed-testing track).",
      "  - One command from `git push` to \"in front of Google reviewers\". Took an afternoon to write, saves twenty minutes per release.",
      "",
      "{section}Numbers",
      "  - ~25k lines of Dart across the Flutter app.",
      "  - 10 modules with full read/list/detail coverage.",
      "  - Three release tracks wired up: internal, alpha (closed testing), production-ready.",
      "  - Zero dependencies on third-party backend services - your ITFlow, your data, your phone.",
    ],
    prism: [
      "{section}Prism SMP Platform",
      "{muted}Retired - the network and site are no longer online. Kept here as a write-up of the work.",
      "",
      "Prism SMP was a Minecraft community I built end-to-end: the server-side plugins that ran the gameplay, the FastAPI backend that aggregated data, and the React site that fronted it all. Most of the interesting code lived in the custom Java plugins running inside the Minecraft server itself.",
      "",
      "{section}Custom API plugin (Java)",
      "A bespoke server-side plugin that exposed a controlled HTTP interface from inside the Minecraft JVM. It let the FastAPI backend pull live gameplay data (online players, world state, moderation events, economy figures) without scraping logs or touching the world files directly.",
      "  - Embedded HTTP listener with auth-scoped endpoints.",
      "  - Event hooks for joins/leaves, deaths, chat, and moderation actions.",
      "  - Async-safe so server tick performance stayed clean.",
      "",
      "{section}Custom NPC system (Java)",
      "A from-scratch NPC framework for quest givers, shopkeepers, and ambient characters - no off-the-shelf NPC plugin. Each NPC was data-defined: appearance, dialogue trees, interaction handlers, and per-player state were all configurable without recompiling.",
      "  - Packet-level entity spawning so NPCs were lightweight and didn't count as real mobs.",
      "  - Click and proximity triggers wired into a dialogue/quest engine.",
      "  - Per-player visibility and state tracking (who's seen what, who's completed which step).",
      "",
      "{section}Voting & rewards integration",
      "Tied the community's vote sites into in-game rewards and leaderboards. Built around the VotingPlugin schema in MySQL, with a custom layer on top for streaks, monthly resets, and the Rankings page on the website.",
      "  - MySQL-backed vote history and leaderboards.",
      "  - Reward delivery on next login with offline-safe queueing.",
      "  - Public Rankings page on the site fed by the same data.",
      "",
      "{section}Other server-side plugins",
      "  - Moderation/audit plugin - structured logs of bans, mutes, and staff actions, surfaced through the API.",
      "  - Economy hooks - tied shop and quest payouts into a shared balance source.",
      "  - Scheduled tasks - daily resets, vote streak checks, world maintenance jobs.",
      "  - Account linking - mapped Discord IDs to Minecraft usernames via a /link flow + SQLite store.",
      "",
      "{section}Prism API backend (Python / FastAPI)",
      "A Python FastAPI service sat between the Minecraft server and the website. It normalised data from several sources, did light caching, and served JSON to the React frontend and the Discord bot.",
      "  - Pulled from the custom API plugin (live server data) and MySQL (VotingPlugin).",
      "  - discord.py integration for guild stats, message metrics, and moderation data.",
      "  - SQLite for account linking and lightweight persistence.",
      "  - External HTTP checks for server status and uptime.",
      "",
      "{section}Frontend - TypeScript + React (Vite)",
      "A React app in TypeScript with Tailwind, client-side routing, dark/light theme, and pages like Rankings, FAQ, and Map fetching live data from the API. Built with Vite, TanStack Query for caching, and a small custom component library.",
      "",
      "{section}Custom Space Invaders (404 easter egg)",
      "The 404 page was a lightweight Space Invaders clone in TypeScript on a canvas - keyboard + touch controls, AABB collision, SFX, music loop that stops on unmount. No game engine, just requestAnimationFrame.",
    ],
    payments: [
      "{section}Payments Platform - David Walsh Gas",
      "",
      "{section}Online payment processing",
      "Secure web-based checkout supporting card payments and immediate reconciliation.",
      "  - PCI-aware design with tokenized payments through a gateway provider.",
      "  - Webhook-driven status updates for success, failure, and refunds.",
      "  - Signed requests and idempotent operations to prevent double-charging.",
      "",
      "{section}Automated \"debt collecting\" reminders",
      "A scheduler monitors overdue accounts and automatically sends reminders via SMS and email.",
      "  - Configurable templates for different overdue times and outstanding amounts.",
      "  - SMS delivery respects upstream gateway API rate limits and handles throttling gracefully.",
      "  - Delivery providers abstracted for SMS and SMTP; failures auto-retry with exponential backoff.",
      "  - All contact attempts are audit-logged and linked to the account record.",
      "",
      "{section}Virtual EFTPOS terminal (Electron)",
      "A desktop app built with Electron provides a cashier-friendly EFTPOS interface for office staff.",
      "  - Electron front end for over-the-phone payment workflows without dedicated hardware.",
      "  - Secure IPC bridging to a local service that talks to the payment gateway.",
      "  - Printable receipts and automatic email copies to customers.",
      "  - Payment processing and reconciliation with existing accounting software.",
      "  - Click any transaction row for full details, refunds, or receipt re-prints.",
      "",
      "{section}Backend integration with accounting software",
      "Payment events synchronize with the accounting system to keep invoices and balances accurate.",
      "  - Two-way sync for invoices, payments, and customer records.",
      "  - Background workers process webhooks and update ledgers in near real time.",
      "  - Graceful handling of partial payments, reversals, and chargebacks.",
      "",
      "{section}Secure payments API",
      "An internal API mediates all payment operations and account updates.",
      "  - JWT-based auth, scoped API keys, and request signing for internal services.",
      "  - Role-based access controls and audit trails for administrative actions.",
      "  - Rate limiting and input validation to protect endpoints.",
    ],
  };

  const CONTACT = [
    "{section}Contact",
    "I'd love to hear from you - opportunities, collaboration, or just a hello.",
    "",
    "  email   email [at] trent-buckley [dot] com",
    "          (run `contact reveal` to copy a clickable address to your clipboard)",
    "  based   Australia (AEST/AEDT)",
    "  reply   usually within 1-2 business days",
    "",
    "Use email for:",
    "  - freelance or collaboration inquiries",
    "  - interesting problems, tools, or projects to discuss",
    "  - job offers, support requests, or general inquiries",
  ];

  const FORTUNES = [
    "There are 2 hard problems in computer science: cache invalidation, naming things, and off-by-one errors.",
    "It works on my machine. Ship the machine.",
    "99 little bugs in the code, 99 little bugs. Take one down, patch it around. 127 little bugs in the code.",
    "The best thing about a boolean is even if you are wrong, you are only off by a bit.",
    "A user interface is like a joke. If you have to explain it, it's not that good.",
    "Programming is 10% writing code and 90% figuring out why it doesn't work.",
    "Have you tried turning it off and on again?",
    "The most disruptive technology of the 21st century is a deadline.",
    "// TODO: write better fortunes",
  ];

  const HELP = [
    "{section}Available commands",
    "  about <topic>     learn about Trent",
    "                    topics: trent · skills · service · philosophy · roots · beyond · all",
    "  portfolio         list portfolio projects",
    "  portfolio <id>    show project details (bordertech, ferrule, prism, payments)",
    "  contact           how to get in touch",
    "  contact reveal    copy email address to clipboard",
    "  games             list playable games",
    "  play <game>       launch a game (asteroids, invaders, snake, tetris, 2048, pong, chess, mines)",
    "  whoami            who's there?",
    "  ls                list browseable topics",
    "  cat <topic>       alias for about/portfolio",
    "  banner            reprint the ascii banner",
    "  theme <name>      green | amber | mono",
    "  history           show command history",
    "  date              current date and time",
    "  echo <text>       echo text back",
    "  clear             clear the screen (alias: cls, Ctrl+L)",
    "  help              show this menu (aliases: /help, ?)",
    "  exit              ...are you sure?",
    "",
    "{muted}Tip: use Tab to autocomplete, Up/Down for history, Esc to skip typing.",
  ];

  // ---------- Output helpers ----------
  function el(tag, opts = {}) {
    const e = document.createElement(tag);
    if (opts.cls) e.className = opts.cls;
    if (opts.text != null) e.textContent = opts.text;
    if (opts.html != null) e.innerHTML = opts.html;
    return e;
  }

  function scrollToBottom() {
    terminal.scrollTop = terminal.scrollHeight;
  }

  function appendNode(node) {
    output.appendChild(node);
    scrollToBottom();
  }

  function printRaw(html, cls = "line") {
    const div = el("div", { cls, html });
    appendNode(div);
    return div;
  }

  function printText(text, cls = "line") {
    const div = el("div", { cls, text });
    appendNode(div);
    return div;
  }

  function printEcho(commandText) {
    const div = el("div", { cls: "echo" });
    const p = el("span", { cls: "prompt", text: PROMPT_TEXT });
    const c = el("span", { text: commandText });
    div.appendChild(p);
    div.appendChild(c);
    appendNode(div);
  }

  function printBlankLine() {
    appendNode(el("div", { cls: "line", html: "&nbsp;" }));
  }

  // Marker-aware line: supports {section}, {muted}, {warn}, {err}, {accent}
  function decorateLine(line) {
    const map = {
      "{section}": "section-title",
      "{muted}":   "muted",
      "{warn}":    "warn",
      "{err}":     "err",
      "{accent}":  "accent",
    };
    for (const tag in map) {
      if (line.startsWith(tag)) {
        return { cls: `line ${map[tag]}`, text: line.slice(tag.length) };
      }
    }
    return { cls: "line", text: line };
  }

  // ---------- Fallout-style typing audio ----------
  let _audioCtx = null;
  function getAudioCtx() {
    if (!_audioCtx) {
      try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    if (_audioCtx && _audioCtx.state === "suspended") {
      _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
  }

  // Unlock AudioContext on first user gesture
  ["keydown", "pointerdown", "touchstart"].forEach(evt => {
    document.addEventListener(evt, () => getAudioCtx(), { once: true, passive: true });
  });

  // Pre-bake a noise buffer once rather than allocating on every keypress
  let _noiseBuffer = null;
  function getNoiseBuffer(ctx) {
    if (_noiseBuffer) return _noiseBuffer;
    const len = Math.ceil(ctx.sampleRate * 0.06);
    _noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = _noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return _noiseBuffer;
  }

  function playKeyClick() {
    const ctx = getAudioCtx();
    if (!ctx || ctx.state !== "running") return;
    try {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1100 + Math.random() * 300;
      hp.Q.value = 0.6;

      const gain = ctx.createGain();
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      noise.connect(hp);
      hp.connect(gain);
      gain.connect(ctx.destination);
      noise.start(t);
      noise.stop(t + 0.06);
    } catch {}
  }

  function playTypingBeep() {
    const ctx = getAudioCtx();
    if (!ctx || ctx.state !== "running") return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = 700 + Math.random() * 120;
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.035, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
      osc.start(t);
      osc.stop(t + 0.038);
    } catch {}
  }

  // ---------- Typewriter ----------
  function typeLines(lines, opts = {}) {
    const speed = opts.speed ?? 8;       // ms per char
    const linePause = opts.linePause ?? 25;
    const cancellable = opts.cancellable ?? true;

    return new Promise((resolve) => {
      let i = 0;
      let cancelled = false;
      state.skipRequested = false;

      const controller = {
        cancel() { cancelled = true; },
        finishImmediately() { state.skipRequested = true; },
      };
      state.typing = controller;

      const writeNext = () => {
        if (cancelled) { state.typing = null; resolve(); return; }
        if (i >= lines.length) { state.typing = null; resolve(); return; }
        const raw = lines[i++];
        if (raw === "" || raw == null) {
          printBlankLine();
          setTimeout(writeNext, linePause);
          return;
        }
        const { cls, text } = decorateLine(raw);
        const lineEl = el("div", { cls });
        appendNode(lineEl);

        if (state.skipRequested || speed <= 0 || opts.instant) {
          lineEl.textContent = text;
          scrollToBottom();
          setTimeout(writeNext, 0);
          return;
        }

        let pos = 0;
        const tick = () => {
          if (cancelled) { state.typing = null; resolve(); return; }
          if (state.skipRequested) {
            lineEl.textContent = text;
            scrollToBottom();
            setTimeout(writeNext, 0);
            return;
          }
          pos = Math.min(text.length, pos + 1);
          lineEl.textContent = text.slice(0, pos);
          scrollToBottom();

          const ch = text[pos - 1];
          if (ch && ch.trim()) playTypingBeep();

          if (pos < text.length) {
            // jitter + punctuation pauses for that Fallout terminal feel
            const jitter = speed * 0.45 * (Math.random() - 0.5);
            let delay = Math.max(1, speed + jitter);
            if (".!?".includes(ch)) delay += 80 + Math.random() * 60;
            else if (",;:".includes(ch)) delay += 30 + Math.random() * 25;
            setTimeout(tick, delay);
          } else {
            setTimeout(writeNext, linePause);
          }
        };
        tick();
      };
      writeNext();
    });
  }

  // ---------- Caret positioning ----------
  function updateCaret() {
    // Position caret at the end of the input's text using a measuring span.
    const measure = document.createElement("span");
    measure.style.cssText = `
      position:absolute;visibility:hidden;white-space:pre;
      font:${getComputedStyle(input).font};letter-spacing:${getComputedStyle(input).letterSpacing};
    `;
    measure.textContent = input.value;
    document.body.appendChild(measure);
    const w = measure.getBoundingClientRect().width;
    document.body.removeChild(measure);
    caret.style.transform = `translateX(${w}px)`;
  }

  input.addEventListener("input", updateCaret);
  input.addEventListener("focus", () => caret.classList.remove("hidden"));
  input.addEventListener("blur", () => caret.classList.add("hidden"));

  const SILENT_KEYS = new Set([
    "Shift","Control","Alt","Meta","CapsLock","NumLock","ScrollLock",
    "Dead","Unidentified","AudioVolumeMute","AudioVolumeDown","AudioVolumeUp",
    "MediaTrackNext","MediaTrackPrevious","MediaPlayPause","MediaStop",
  ]);
  input.addEventListener("keydown", (e) => {
    if (SILENT_KEYS.has(e.key)) return;
    if (document.querySelector(".game-overlay")) return;
    playKeyClick();
  });
  window.addEventListener("resize", updateCaret);

  // Refocus input whenever the user clicks anywhere (unless they're selecting text)
  document.addEventListener("mousedown", (e) => {
    if (window.getSelection().toString()) return;
    if (e.target.closest("a")) return;
    setTimeout(() => input.focus(), 0);
  });

  // ---------- Commands ----------
  const COMMANDS = {
    help: { run: () => typeLines(HELP) },
    "/help": { run: () => typeLines(HELP) },
    "?": { run: () => typeLines(HELP) },

    about: {
      run: (args) => {
        const topic = (args[0] || "trent").toLowerCase();
        if (topic === "all") {
          return typeLines([
            ...ABOUT.trent, "",
            ...ABOUT.roots, "",
            ...ABOUT.service, "",
            ...ABOUT.philosophy, "",
            ...ABOUT.skills, "",
            ...ABOUT.beyond, "",
            ...ABOUT.quickfacts,
          ]);
        }
        if (topic === "me" || topic === "trent" || topic === "background") return typeLines(ABOUT.trent);
        if (topic === "skills" || topic === "tech" || topic === "stack") return typeLines(ABOUT.skills);
        if (topic === "service" || topic === "emergency") return typeLines(ABOUT.service);
        if (topic === "philosophy" || topic === "story") return typeLines(ABOUT.philosophy);
        if (topic === "roots" || topic === "location") return typeLines(ABOUT.roots);
        if (topic === "beyond" || topic === "hobbies") return typeLines(ABOUT.beyond);
        if (topic === "quickfacts" || topic === "facts") return typeLines(ABOUT.quickfacts);
        return typeLines([
          `{err}unknown topic: ${topic}`,
          "topics: trent, skills, service, philosophy, roots, beyond, quickfacts, all",
        ]);
      },
    },

    portfolio: {
      run: (args) => {
        const id = (args[0] || "").toLowerCase();
        if (!id || id === "list") {
          const lines = ["{section}Portfolio", ""];
          PORTFOLIO_INDEX.forEach((p) => {
            lines.push(`  {accent}${p.id.padEnd(10)}{/accent}${p.title}`);
            lines.push(`             ${p.blurb}`);
          });
          // Strip the inline {accent}{/accent} markers because decorateLine only handles whole-line tags
          return typeLines(lines.map(l => l.replace("{accent}", "").replace("{/accent}", "")));
        }
        if (PORTFOLIO[id]) return typeLines(PORTFOLIO[id]);
        return typeLines([`{err}no project: ${id}`, "try `portfolio` for the list"]);
      },
    },

    contact: {
      run: async (args) => {
        if ((args[0] || "").toLowerCase() === "reveal") {
          const addr = String.fromCharCode(101,109,97,105,108,64,116,114,101,110,116,45,98,117,99,107,108,101,121,46,99,111,109);
          try {
            await navigator.clipboard.writeText(addr);
            return typeLines([
              `{accent}${addr}`,
              `{muted}copied to clipboard. opening mail client...`,
            ]).then(() => {
              window.location.href = `mailto:${addr}`;
            });
          } catch {
            return typeLines([`{accent}${addr}`, "{warn}clipboard blocked - select and copy the line above."]);
          }
        }
        return typeLines(CONTACT);
      },
    },

    ls: {
      run: () => typeLines([
        "about/      portfolio/    contact",
        "{muted}use `about <topic>` or `portfolio <project>` to read more.",
      ]),
    },

    cat: {
      run: (args) => {
        const t = (args[0] || "").toLowerCase();
        if (!t) return typeLines(["usage: cat <topic>"]);
        if (PORTFOLIO[t]) return typeLines(PORTFOLIO[t]);
        if (ABOUT[t]) return typeLines(ABOUT[t]);
        return typeLines([`{err}cat: ${t}: No such file or topic`]);
      },
    },

    whoami: { run: () => typeLines(["guest"]) },

    date: {
      run: () => typeLines([new Date().toString()]),
    },

    echo: {
      run: (args) => typeLines([args.join(" ")]),
    },

    clear: { run: () => { output.innerHTML = ""; return Promise.resolve(); } },
    cls:   { run: () => { output.innerHTML = ""; return Promise.resolve(); } },

    history: {
      run: () => {
        if (!state.history.length) return typeLines(["{muted}(no history yet)"]);
        return typeLines(state.history.map((h, i) => `  ${String(i + 1).padStart(3)}  ${h}`));
      },
    },

    banner: { run: () => printBanner() },

    theme: {
      run: (args) => {
        const next = (args[0] || "").toLowerCase();
        if (!next) return typeLines([`current theme: ${state.theme}`, "options: green, amber, mono"]);
        if (!["green", "amber", "mono"].includes(next)) {
          return typeLines([`{err}unknown theme: ${next}`, "options: green, amber, mono"]);
        }
        applyTheme(next);
        state.theme = next;
        localStorage.setItem("tb.theme", next);
        return typeLines([`theme set to ${next}.`]);
      },
    },

    exit: {
      run: () => typeLines([
        "{warn}you can't exit. you live here now.",
        "{muted}(try `about trent` instead)",
      ], { speed: 14 }),
    },

    sudo: {
      run: (args) => {
        if (args.join(" ").toLowerCase() === "make me a sandwich") {
          return typeLines(["{accent}okay."]);
        }
        const attempted = ["sudo", ...args].join(" ").trim();
        logToWorker("sudo", attempted);
        return typeLines([
          "{err}guest is not in the sudoers file. This incident will be reported.",
        ]);
      },
    },

    // ---------- Easter eggs (not in help) ----------
    xyzzy: { run: () => typeLines(["{muted}A hollow voice says 'fool.'"]) },

    hack: {
      run: async () => {
        await typeLines([
          "{accent}INITIATING HACK SEQUENCE...",
          "{muted}pinging 93.184.216.34................. ok",
          "{muted}scanning open ports: 22, 80, 443..... ok",
          "{muted}loading wordlist: rockyou.txt........ ok",
          "",
          "{warn}attempting login...",
          "{warn}  admin:admin            FAIL",
          "{warn}  root:toor              FAIL",
          "{warn}  trent:password123      FAIL",
          "",
          "{muted}wordlist exhausted. deploying zero-day...",
          "{err}FileNotFoundError: /usr/share/zero-days: No such file or directory",
          "",
          "{muted}hack failed. maybe try `help` instead.",
        ], { speed: 8, linePause: 55 });
      },
    },

    vim: {
      run: () => typeLines([
        "",
        "{muted}~",
        "{muted}~",
        "{muted}~",
        "{muted}~",
        "{accent}-- INSERT --",
        "",
        "{warn}E37: No write since last change (add ! to override)",
        "{muted}hint: :q is unavailable here. type `clear` to escape.",
      ], { speed: 6 }),
    },

    matrix: {
      run: () => typeLines([
        "{muted}Wake up, Neo...",
        "{muted}The Matrix has you.",
        "{muted}Follow the white rabbit.",
        "",
        "{accent}knock knock",
      ], { speed: 18, linePause: 220 }),
    },

    coffee: {
      run: () => typeLines([
        "    ( (",
        "     ) )",
        "  ........",
        "  |      |]",
        "  \\      /",
        "   `----'",
        "",
        "{muted}HTCPCP/1.0 418 I'm a Teapot",
        "{muted}Content-Type: message/coffeepot",
        "",
        "{err}error: brew failed. this is a terminal, not a coffee pot.",
        "{muted}(RFC 2324)",
      ], { speed: 12 }),
    },

    fortune: {
      run: () => {
        const f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
        return typeLines([`{muted}${f}`]);
      },
    },

    reboot: {
      run: async () => {
        await typeLines([
          "{warn}Broadcast message from root@trent-buckley (pts/0):",
          "{warn}The system is going down for reboot NOW!",
          "",
          "{muted}Syncing filesystems...",
          "{muted}Unmounting filesystems...",
          "{muted}Sending SIGTERM to all processes...",
        ], { speed: 10, linePause: 120 });
        await new Promise(r => setTimeout(r, 700));
        return typeLines([
          "",
          "{muted}just kidding. you can't leave.",
          "{muted}(try `about trent` instead)",
        ], { speed: 14 });
      },
    },

    nmap: {
      run: (args) => {
        const target = args[0] || "trent-buckley.com";
        return typeLines([
          "{accent}Starting Nmap 7.94",
          `{muted}Nmap scan report for ${target}`,
          "{muted}Host is up (0.011s latency).",
          "",
          "{muted}PORT      STATE   SERVICE",
          "{muted}22/tcp    closed  ssh",
          "{muted}80/tcp    open    http  (-> 301 https)",
          "{muted}443/tcp   open    https",
          "{muted}1337/tcp  open    curiosity",
          "",
          "{muted}1 host scanned in 0.38 seconds",
        ], { speed: 8 });
      },
    },

    "rm": {
      run: (args) => {
        if (args.includes("-rf") && args.includes("/")) {
          return typeLines([
            "{warn}nice try.",
            "{muted}simulation aborted - filesystem write-protected.",
          ]);
        }
        return typeLines(["rm: missing operand"]);
      },
    },

    open: {
      run: (args) => {
        const target = (args[0] || "").toLowerCase();
        const map = {
          bordertech: "https://bordertechsolutions.com.au",
          "border-tech": "https://bordertechsolutions.com.au",
          bordertechsolutions: "https://bordertechsolutions.com.au",
          ferrule: "https://github.com/BoredManCodes/ferrule",
          itflow: "https://github.com/BoredManCodes/itflow",
        };
        const url = map[target];
        if (!url) return typeLines([`{err}open: nothing to open for "${target}"`]);
        window.open(url, "_blank", "noopener");
        return typeLines([`opening ${url} ...`]);
      },
    },

    games: {
      run: () => {
        if (!window.Games) return typeLines(["{err}games module failed to load"]);
        const lines = ["{section}Arcade", ""];
        window.Games.list.forEach((g) => {
          const id = g.id.padEnd(10);
          lines.push(`  ${id}${g.title}`);
          if (g.subtitle) lines.push(`            {muted}${g.subtitle}`);
        });
        // {muted} marker only takes effect at the start of a line, so map muted second-lines now
        lines.push("");
        lines.push("{muted}run `play <id>` to launch. Esc closes any game.");
        return typeLines(lines.map(l => l.startsWith("            {muted}") ? l.replace("            {muted}", "            ") : l));
      },
    },

    play: {
      run: (args) => {
        if (!window.Games) return typeLines(["{err}games module failed to load"]);
        const id = (args[0] || "").toLowerCase();
        if (!id) {
          return typeLines([
            "usage: play <game>",
            `available: ${window.Games.list.map(g => g.id).join(", ")}`,
          ]);
        }
        if (!window.Games.byId[id]) {
          return typeLines([
            `{err}no game: ${id}`,
            `available: ${window.Games.list.map(g => g.id).join(", ")}`,
          ]);
        }
        window.Games.launch(id);
        return typeLines([`{muted}launching ${id}... (Esc to exit)`]);
      },
    },
  };

  // command aliases
  const ALIASES = {
    "skills": ["about", "skills"],
    "projects": ["portfolio"],
    "work": ["portfolio"],
    "me": ["about", "trent"],
    "bio": ["about", "trent"],
    "ferrule": ["portfolio", "ferrule"],
    "itflow": ["portfolio", "ferrule"],
    "arcade": ["games"],
    "asteroids": ["play", "asteroids"],
    "invaders": ["play", "invaders"],
    "snake": ["play", "snake"],
    "tetris": ["play", "tetris"],
    "2048": ["play", "2048"],
    "pong": ["play", "pong"],
    "chess": ["play", "chess"],
    "mines": ["play", "mines"],
    "minesweeper": ["play", "mines"],
  };

  // ---------- Parser / dispatcher ----------
  function parseCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const tokens = parts.map(t => t.replace(/^"|"$/g, ""));
    return { name: tokens[0].toLowerCase(), args: tokens.slice(1), raw: trimmed };
  }

  async function runCommand(raw) {
    const parsed = parseCommand(raw);
    if (!parsed) return;

    state.history.push(parsed.raw);
    state.historyIndex = state.history.length;

    logToWorker("cmd", parsed.raw);

    printEcho(parsed.raw);

    let { name, args } = parsed;

    if (ALIASES[name]) {
      const [alias, ...extra] = ALIASES[name];
      name = alias;
      args = [...extra, ...args];
    }

    // strip leading slash for slash-command style
    if (name.startsWith("/") && COMMANDS[name.slice(1)]) {
      name = name.slice(1);
    }

    const cmd = COMMANDS[name];
    if (!cmd) {
      await typeLines([
        `{err}command not found: ${name}`,
        "{muted}type `help` for the list of commands.",
      ]);
      return;
    }

    try {
      await cmd.run(args);
    } catch (err) {
      await typeLines([`{err}error running command: ${err && err.message || err}`]);
    }
  }

  // ---------- Tab completion ----------
  function completionsFor(text) {
    const tokens = text.split(/\s+/);
    const baseCommands = Object.keys(COMMANDS).concat(Object.keys(ALIASES))
      .filter(k => !k.startsWith("/") && k !== "?");

    if (tokens.length <= 1) {
      const prefix = tokens[0] || "";
      return baseCommands.filter(c => c.startsWith(prefix.toLowerCase())).sort();
    }

    const cmd = tokens[0].toLowerCase();
    const arg = tokens.slice(1).join(" ");
    const argTopics = {
      about: ["trent", "skills", "service", "philosophy", "roots", "beyond", "quickfacts", "all"],
      portfolio: ["bordertech", "ferrule", "prism", "payments"],
      cat: [...Object.keys(ABOUT), ...Object.keys(PORTFOLIO)],
      theme: ["green", "amber", "mono"],
      contact: ["reveal"],
      open: ["bordertech", "ferrule", "itflow"],
      play: window.Games ? window.Games.list.map(g => g.id) : ["asteroids","invaders","snake","tetris","2048","pong","chess","mines"],
    };
    const list = argTopics[cmd] || [];
    return list.filter(t => t.startsWith(arg.toLowerCase()));
  }

  function commonPrefix(arr) {
    if (!arr.length) return "";
    let p = arr[0];
    for (const s of arr) {
      while (!s.startsWith(p)) p = p.slice(0, -1);
      if (!p) return "";
    }
    return p;
  }

  // ---------- Input handling ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = "";
    updateCaret();

    if (state.typing) {
      // user submitted while typing - skip current animation
      state.typing.finishImmediately();
      return;
    }

    if (!value.trim()) {
      printEcho("");
      return;
    }
    await runCommand(value);
  });

  input.addEventListener("keydown", (e) => {
    // Esc skips active typing
    if (e.key === "Escape") {
      if (state.typing) state.typing.finishImmediately();
      return;
    }

    // Ctrl+L to clear
    if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      output.innerHTML = "";
      return;
    }

    // Ctrl+C cancel current line / typing
    if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
      if (state.typing) {
        e.preventDefault();
        state.typing.finishImmediately();
        return;
      }
      if (input.value) {
        e.preventDefault();
        printEcho(input.value + "^C");
        input.value = "";
        updateCaret();
        return;
      }
    }

    // History navigation
    if (e.key === "ArrowUp") {
      if (!state.history.length) return;
      e.preventDefault();
      state.historyIndex = Math.max(0, state.historyIndex - 1);
      input.value = state.history[state.historyIndex] || "";
      // place caret at end
      requestAnimationFrame(() => { input.setSelectionRange(input.value.length, input.value.length); updateCaret(); });
      return;
    }
    if (e.key === "ArrowDown") {
      if (!state.history.length) return;
      e.preventDefault();
      state.historyIndex = Math.min(state.history.length, state.historyIndex + 1);
      input.value = state.history[state.historyIndex] || "";
      requestAnimationFrame(() => { input.setSelectionRange(input.value.length, input.value.length); updateCaret(); });
      return;
    }

    // Tab completion
    if (e.key === "Tab") {
      e.preventDefault();
      const text = input.value;
      const matches = completionsFor(text);
      if (!matches.length) return;
      const tokens = text.split(/\s+/);
      if (matches.length === 1) {
        if (tokens.length <= 1) {
          input.value = matches[0] + " ";
        } else {
          tokens[tokens.length - 1] = matches[0];
          input.value = tokens.join(" ") + " ";
        }
        updateCaret();
      } else {
        const prefix = commonPrefix(matches);
        const lastTok = tokens[tokens.length - 1] || "";
        if (prefix && prefix.length > lastTok.length) {
          if (tokens.length <= 1) input.value = prefix;
          else { tokens[tokens.length - 1] = prefix; input.value = tokens.join(" "); }
          updateCaret();
        } else {
          // Show the available completions above the (still-active) prompt line, bash-style
          printText("  " + matches.join("    "), "line muted");
        }
      }
      return;
    }
  });

  // ---------- Banner / boot ----------
  const NARROW_BREAKPOINT = 720;
  let lastBannerEl = null;

  function shouldUseCompactBanner() {
    return window.innerWidth < NARROW_BREAKPOINT;
  }

  function printBanner() {
    const isNarrow = shouldUseCompactBanner();
    const bannerEl = el("pre", { cls: "banner" + (isNarrow ? " compact" : "") });
    bannerEl.textContent = isNarrow ? BANNER_COMPACT : BANNER_FULL;
    appendNode(bannerEl);
    lastBannerEl = bannerEl;
    return Promise.resolve();
  }

  // Re-render the most recent banner on resize / rotation so the layout stays sane.
  let bannerResizeTimer = null;
  window.addEventListener("resize", () => {
    if (!lastBannerEl || !lastBannerEl.isConnected) return;
    clearTimeout(bannerResizeTimer);
    bannerResizeTimer = setTimeout(() => {
      const isNarrow = shouldUseCompactBanner();
      const wantsCompact = lastBannerEl.classList.contains("compact");
      if (isNarrow === wantsCompact) return;
      lastBannerEl.classList.toggle("compact", isNarrow);
      lastBannerEl.textContent = isNarrow ? BANNER_COMPACT : BANNER_FULL;
    }, 120);
  });

  async function bootSequence() {
    await typeLines([
      "{muted}[boot] trent-buckley.com terminal v2.0",
      "{muted}[boot] checking systems........ ok",
      "{muted}[boot] loading portfolio modules ok",
      "{muted}[boot] mounting /home/guest..... ok",
      "{muted}[boot] ready.",
    ], { speed: 4, linePause: 60 });
    printBlankLine();
    await printBanner();
    logToWorker("cmd", "[site loaded]");
    printBlankLine();
    await typeLines([
      "Welcome to trent-buckley.com.",
      "{muted}Self-taught developer, maker, and lifelong tinkerer based in country Victoria, Australia.",
      "",
      "Enter a command, or type /help for a list of commands.",
    ], { speed: 10 });
    printBlankLine();
    state.booted = true;
  }

  function applyTheme(name) {
    if (name === "green") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", name);
    }
  }

  // ---------- Konami code ----------
  const KONAMI_SEQ = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
  let konamiIdx = 0;

  window.addEventListener("keydown", (e) => {
    if (e.key === KONAMI_SEQ[konamiIdx]) {
      konamiIdx++;
      if (konamiIdx === KONAMI_SEQ.length) {
        konamiIdx = 0;
        triggerKonami();
      }
    } else {
      konamiIdx = e.key === KONAMI_SEQ[0] ? 1 : 0;
    }
  }, true);

  function playKonamiSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // C5 E5 G5 C6 E6 - classic 8-bit power-up arpeggio
      const notes = [
        [523.25, 0.00, 0.10],
        [659.25, 0.09, 0.10],
        [783.99, 0.18, 0.10],
        [1046.50, 0.27, 0.10],
        [1318.51, 0.37, 0.32],
      ];
      notes.forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t);
        osc.stop(t + dur);
      });
    } catch {}
  }

  function triggerKonami() {
    document.documentElement.classList.add("konami-flash");
    setTimeout(() => document.documentElement.classList.remove("konami-flash"), 700);
    playKonamiSound();
    logToWorker("cmd", "[konami]");
    input.value = "";
    updateCaret();
    typeLines([
      "{accent}↑ ↑ ↓ ↓ ← → ← → B A",
      "",
      "{accent}+30 LIVES",
      "{muted}cheat code accepted.",
      "{muted}god mode: ON",
      "{muted}(this changes absolutely nothing)",
    ], { speed: 14 });
  }

  // ---------- Init ----------
  window.addEventListener("load", () => {
    const splash = document.getElementById("boot-splash");
    const anyKeyLink = document.getElementById("any-key-link");

    function dismissSplash() {
      if (!splash || splash.classList.contains("fade-out")) return;
      // Counts as a user gesture — unlock the AudioContext now so sounds
      // play immediately when the boot sequence starts typing.
      getAudioCtx();
      splash.classList.add("fade-out");
      splash.addEventListener("animationend", () => {
        splash.remove();
        input.focus();
        updateCaret();
        bootSequence();
      }, { once: true });
    }

    // Physical key press → boot
    window.addEventListener("keydown", dismissSplash, { once: true });

    // Click anywhere on the splash except the link itself → boot
    splash.addEventListener("pointerdown", (e) => {
      if (e.target === anyKeyLink || e.target.closest("#any-key-link")) return;
      dismissSplash();
    });

    // Clicking the "any key" link opens YouTube AND boots
    anyKeyLink.addEventListener("click", () => {
      setTimeout(dismissSplash, 80);
    });
  });

  // Friendly fallback if focus is lost on touch devices
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) input.focus();
  });
})();
