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

  const LOG_ENDPOINT = "https://trent-term-log.boredmandiscord.workers.dev/";
  function logToWorker(type, cmd) {
    try {
      fetch(LOG_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, cmd, referrer: document.referrer || "" }),
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

  const HELP = [
    "{section}Available commands",
    "  about <topic>     learn about Trent",
    "                    topics: trent · skills · service · philosophy · roots · beyond · all",
    "  portfolio         list portfolio projects",
    "  portfolio <id>    show project details (bordertech, prism, payments)",
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
          // type a small chunk for responsiveness on long lines
          const chunk = Math.max(1, Math.floor(text.length / 80));
          pos = Math.min(text.length, pos + chunk);
          lineEl.textContent = text.slice(0, pos);
          scrollToBottom();
          if (pos < text.length) {
            setTimeout(tick, speed);
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
        const attempted = ["sudo", ...args].join(" ").trim();
        logToWorker("sudo", attempted);
        return typeLines([
          "{err}guest is not in the sudoers file. This incident will be reported.",
        ]);
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
      portfolio: ["bordertech", "prism", "payments"],
      cat: [...Object.keys(ABOUT), ...Object.keys(PORTFOLIO)],
      theme: ["green", "amber", "mono"],
      contact: ["reveal"],
      open: ["bordertech"],
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

  // ---------- Init ----------
  window.addEventListener("load", () => {
    input.focus();
    updateCaret();
    bootSequence();
  });

  // Friendly fallback if focus is lost on touch devices
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) input.focus();
  });
})();
