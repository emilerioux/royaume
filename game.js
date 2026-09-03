/* La Quête du Chevalier — petit RPG médiéval, vue de dessus, hors ligne.
   Phase 1 : village + forêt + grotte, 3 quêtes, combat, or, échoppe, sauvegarde. */
(() => {
  "use strict";

  // ---------------------------------------------------------------- constantes
  const TILE = 16;
  const SAVE_KEY = "quete-chevalier-v1";
  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let VIEW_W = 240, VIEW_H = 400;
  ctx.imageSmoothingEnabled = true;

  // grain de toile (pré-rendu une fois)
  const grainCv = document.createElement("canvas");
  grainCv.width = grainCv.height = 96;
  (() => {
    const g = grainCv.getContext("2d");
    const im = g.createImageData(96, 96);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = 118 + Math.random() * 80;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  })();

  // ambiance : fondu village doré (nord) <-> forêt fraîche (sud) sur la carte continue,
  // + réglages fixes pour la grotte et les intérieurs.
  const AMB = { village: [255, 214, 150, 0.10], foret: [110, 140, 105, 0.145] };
  const ZONE = {
    grotte: { tint: "rgba(20,26,44,0.44)", vig: 0.58, torch: true },
    interieur: { tint: "rgba(58,40,22,0.16)", vig: 0.50, hearth: true },
  };

  // Palette « À ciel ouvert » : terreuse, désaturée, lumière chaude / ombres froides
  const COL = {
    grass: "#77854a", grass2: "#748249", grassDark: "#586a35", grassRim: "#aebf7a",
    flower: "#e6dcc0",
    path: "#ab8e63", path2: "#a2855b", pathDark: "#6f5a3c",
    water: "#3f606a", water2: "#7fa6a6", waterRim: "#cdd8cf",
    floor: "#4a4236", floor2: "#413a30", floorDark: "#2a251d",
    wallTop: "#a8a294", wall: "#7c7768", wallDark: "#4e4a40",
    wood: "#7a5a38", woodDark: "#4a3722",
    roof: "#b0704a", roofDark: "#6f3c26", roofRim: "#e0b48a",
    tree: "#57713a", tree2: "#5c7534", treeDark: "#3a5020", treeRim: "#b8c979",
    trunk: "#5f4529", trunkDark: "#3a2a19",
    stone: "#a9a08a", stoneDark: "#5c564b",
    steel: "#9aa0a6", steelDark: "#45484e", steelLit: "#c8cdd2",
    skin: "#d7a978",
    shadow: "rgba(26,30,38,0.24)",
  };

  // ---------------------------------------------------------------- utilitaires carte
  function grid(w, h, fill) {
    const g = [];
    for (let y = 0; y < h; y++) g.push(new Array(w).fill(fill));
    return g;
  }
  const inb = (g, x, y) => y >= 0 && y < g.length && x >= 0 && x < g[0].length;
  function put(g, x, y, c) { if (inb(g, x, y)) g[y][x] = c; }
  function rect(g, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, c); }
  function border(g, c) {
    const w = g[0].length, h = g.length;
    for (let x = 0; x < w; x++) { put(g, x, 0, c); put(g, x, h - 1, c); }
    for (let y = 0; y < h; y++) { put(g, 0, y, c); put(g, w - 1, y, c); }
  }
  function hline(g, x1, x2, y, c) { for (let x = x1; x <= x2; x++) put(g, x, y, c); }
  function vline(g, y1, y2, x, c) { for (let y = y1; y <= y2; y++) put(g, x, y, c); }
  function house(g, x, y, w, h) {
    rect(g, x, y, w, h, "H");
    rect(g, x, y, w, 1, "R");
    put(g, x + (w >> 1), y + h - 1, "D");
  }
  function scatter(g, c, n, avoid) {
    let tries = 0;
    while (n > 0 && tries < 400) {
      tries++;
      const x = 1 + ((Math.random() * (g[0].length - 2)) | 0);
      const y = 1 + ((Math.random() * (g.length - 2)) | 0);
      if (g[y][x] === "." && !(avoid && avoid(x, y))) { g[y][x] = c; n--; }
    }
  }

  const SOLID = new Set(["T", "#", "H", "R", "w", "S", "o", "C", "K", "f", "t", "b", "k", "v", "h"]);
  const isSolidChar = (c) => SOLID.has(c);

  // ---------------------------------------------------------------- cartes
  // Village (nord) + forêt (sud) = UNE seule carte continue : plus de coupure d'écran
  // en franchissant la lisière. Seuls les lieux fermés (grotte, maisons) sont des cartes à part.
  function buildOverworld() {
    const W = 26, H = 44, g = grid(W, H, ".");
    const forestY = 21;               // rangée de la lisière (ligne d'arbres)
    border(g, "T");

    // bâtiments visitables : corps solide + une porte (case "=") qui déclenche l'entrée
    const buildings = [
      { x: 6, y: 2, w: 4, h: 4, kind: "bakery", door: { x: 7, y: 5 }, to: "boulangerie" },
      { x: 12, y: 1, w: 5, h: 5, kind: "manor", door: { x: 14, y: 5 }, to: "manoir" },
      { x: 18, y: 2, w: 4, h: 4, kind: "cottage", door: { x: 19, y: 5 }, to: "chaumiereA" },
      { x: 6, y: 11, w: 4, h: 4, kind: "shop", door: { x: 7, y: 14 }, to: "echoppe" },
      { x: 16, y: 11, w: 4, h: 4, kind: "cottage2", door: { x: 17, y: 14 }, to: "chaumiereB" },
    ];

    // -------- sentiers du village (tracés d'abord, les murs passeront par-dessus)
    hline(g, 5, 22, 6, "=");           // rue nord
    hline(g, 5, 22, 15, "=");          // rue sud
    vline(g, 6, 15, 5, "=");           // desserte ouest
    vline(g, 6, 15, 22, "=");          // desserte est
    vline(g, 6, 15, 11, "=");          // place (devant le puits)
    vline(g, 6, 15, 12, "=");
    vline(g, 15, forestY, 11, "=");    // descente vers la lisière
    vline(g, 15, forestY, 12, "=");

    rect(g, 13, 8, 2, 2, "o");         // puits, au cœur de la place

    for (const b of buildings) {       // murs
      rect(g, b.x, b.y, b.w, b.h, "H");
    }
    for (const b of buildings) {       // on reperce la porte + le pas de porte
      put(g, b.door.x, b.door.y, "=");
      put(g, b.door.x, b.door.y + 1, "=");
    }

    put(g, 10, 10, "S");              // panneau du village
    scatter(g, ",", 14, (x, y) => y > forestY - 2);
    scatter(g, "~", 7, (x, y) => y > forestY - 2);

    // -------- lisière : ligne d'arbres avec une trouée (x = 11,12)
    for (let x = 1; x < W - 1; x++) if (x < 11 || x > 12) put(g, x, forestY, "T");

    // ============ FORÊT (y : 22..42) ============
    rect(g, 3, 24, 3, 2, "T"); rect(g, 20, 25, 3, 3, "T");
    rect(g, 6, 31, 2, 4, "T"); rect(g, 17, 33, 4, 2, "T");
    rect(g, 9, 38, 3, 2, "T"); rect(g, 4, 35, 2, 3, "T"); rect(g, 22, 34, 2, 3, "T");
    vline(g, 22, 42, 11, "="); vline(g, 22, 42, 12, "=");   // sente principale
    hline(g, 12, 22, 34, "="); hline(g, 5, 12, 26, "=");     // embranchements
    hline(g, 1, 24, 29, "w"); put(g, 11, 29, "="); put(g, 12, 29, "="); // ruisseau + pont
    put(g, 8, 26, "S");                                      // panneau de la forêt
    put(g, 11, 42, "K"); put(g, 12, 42, "K");               // façade de la grotte
    put(g, 11, 41, "^"); put(g, 12, 41, "^");               // le seuil déclenche l'entrée
    scatter(g, "~", 22, (x, y) => y < forestY + 1);
    scatter(g, ",", 9, (x, y) => y < forestY + 1);

    return {
      id: "village", g, name: "Village de Bonrepos", forestY, buildings,
      spawn: { x: 11, y: 13 },
      transitions: [
        { x: 7, y: 5, to: "boulangerie", tx: 5, ty: 6 },
        { x: 14, y: 5, to: "manoir", tx: 5, ty: 7 },
        { x: 19, y: 5, to: "chaumiereA", tx: 4, ty: 5 },
        { x: 7, y: 14, to: "echoppe", tx: 5, ty: 6 },
        { x: 17, y: 14, to: "chaumiereB", tx: 4, ty: 5 },
        { x: 11, y: 41, to: "grotte", tx: 8, ty: 11 },
        { x: 12, y: 41, to: "grotte", tx: 8, ty: 11 },
      ],
      npcs: [
        { id: "elder", x: 12, y: 9, name: "Ancien", color: "#7c5cff", hair: "#d8d8d8" },
        { id: "woodcutter", x: 20, y: 34, name: "Bûcheron", color: "#8a6a3a", hair: "#3a2a18" },
      ],
      signs: {
        "10,10": ["« Village de Bonrepos »", "Au sud, par la trouée : la forêt. Une brute rôderait dans la grotte."],
        "8,26": ["Sentier de la forêt.", "Nord : le village. Sud : la grotte.", "Attention aux slimes et aux loups."],
      },
      enemies: [
        { type: "slime", x: 7, y: 25 }, { type: "slime", x: 16, y: 27 },
        { type: "slime", x: 9, y: 33 }, { type: "slime", x: 19, y: 32 },
        { type: "slime", x: 6, y: 38 }, { type: "slime", x: 15, y: 39 },
        { type: "slime", x: 21, y: 28 },
        { type: "wolf", x: 5, y: 40 }, { type: "wolf", x: 22, y: 37 },
      ],
      wells: ["13,8", "14,8", "13,9", "14,9"],
    };
  }

  // Intérieur générique (maison, échoppe, demeure) : petite pièce, un seuil de sortie.
  function buildInterior(id, name, s) {
    const W = s.w, H = s.h, g = grid(W, H, ".");
    border(g, "#");
    put(g, s.door, H - 1, "^");                       // seuil -> retour au village
    for (const [fx, fy, fc] of (s.furniture || [])) put(g, fx, fy, fc);
    for (const k in (s.signs || {})) { const p = k.split(","); put(g, +p[0], +p[1], "S"); }
    return {
      id, g, name, floor: true, interior: true, forestY: 0,
      spawn: { x: s.door, y: H - 2 },
      transitions: [{ x: s.door, y: H - 1, to: "village", tx: s.back.x, ty: s.back.y }],
      npcs: s.npcs || [],
      signs: s.signs || {},
      enemies: [],
      wells: [],
      hearthPos: s.hearth || null,
    };
  }

  function buildGrotte() {
    const W = 17, H = 14, g = grid(W, H, ".");
    border(g, "#");
    rect(g, 4, 4, 2, 2, "#"); rect(g, 11, 4, 2, 2, "#");
    rect(g, 7, 8, 3, 2, "#");
    put(g, 8, 13, "^"); // sortie sud -> forêt
    put(g, 13, 2, "C"); // coffre
    return {
      id: "grotte", g, name: "Grotte de la brute",
      spawn: { x: 8, y: 11 },
      transitions: [{ x: 8, y: 13, to: "village", tx: 11, ty: 39 }],
      npcs: [],
      signs: {},
      enemies: [{ type: "brute", x: 8, y: 5 }],
      wells: [],
      floor: true,
      chest: "13,2",
    };
  }

  const MAPS = {
    village: buildOverworld(),
    manoir: buildInterior("manoir", "Demeure de l'Ancien", {
      w: 11, h: 8, door: 5, back: { x: 14, y: 6 }, hearth: [8, 1],
      furniture: [[8, 1, "h"], [1, 1, "k"], [1, 2, "k"], [1, 3, "k"], [5, 4, "t"], [9, 5, "v"], [2, 5, "v"], [7, 4, "u"]],
      signs: { "3,1": ["Des cartes jaunies, une épée émoussée au mur.", "L'Ancien veille sur Bonrepos depuis quarante hivers."] },
    }),
    boulangerie: buildInterior("boulangerie", "Boulangerie", {
      w: 11, h: 8, door: 5, back: { x: 7, y: 6 }, hearth: [2, 1],
      furniture: [[2, 1, "h"], [7, 3, "t"], [9, 5, "v"], [1, 4, "k"], [1, 5, "v"], [7, 4, "u"]],
      npcs: [{ id: "baker", x: 5, y: 3, name: "Boulangère", color: "#d98b3c", hair: "#5b3a1e" }],
    }),
    echoppe: buildInterior("echoppe", "Échoppe du village", {
      w: 11, h: 8, door: 5, back: { x: 7, y: 15 },
      furniture: [[3, 4, "t"], [7, 4, "t"], [1, 2, "v"], [1, 3, "v"], [9, 2, "v"], [9, 3, "v"], [3, 5, "u"]],
      npcs: [{ id: "shop", x: 5, y: 2, name: "Marchand", color: "#3c8f6b", hair: "#2a2a2a", shop: true }],
    }),
    chaumiereA: buildInterior("chaumiereA", "Chaumière", {
      w: 9, h: 7, door: 4, back: { x: 19, y: 6 }, hearth: [1, 1],
      furniture: [[1, 1, "h"], [6, 4, "b"], [3, 3, "t"], [7, 5, "v"], [2, 4, "u"]],
      npcs: [{ id: "villager", x: 5, y: 2, name: "Villageois", color: "#6b8f6b", hair: "#3a2a18" }],
    }),
    chaumiereB: buildInterior("chaumiereB", "Chaumière", {
      w: 9, h: 7, door: 4, back: { x: 17, y: 15 }, hearth: [7, 1],
      furniture: [[7, 1, "h"], [2, 4, "b"], [5, 4, "t"], [1, 1, "k"], [6, 3, "u"]],
      signs: { "3,1": ["Un lit fait, un feu qui couve.", "Les occupants sont aux champs."] },
    }),
    grotte: buildGrotte(),
  };
  for (const m of Object.values(MAPS)) {
    m.w = m.g[0].length; m.h = m.g.length;
  }

  // ---------------------------------------------------------------- quêtes
  const QUESTS = {
    slimes: {
      name: "Le potager assiégé", turnInAt: "elder", giver: "elder",
      type: "kill", targetType: "slime", count: 5,
      reward: { gold: 20, maxHp: 1 },
      dlgOffer: [
        "Chevalier ! Des slimes ravagent nos potagers, au sud.",
        "Va dans la forêt et détruis-en cinq. Le village t'en sera reconnaissant.",
      ],
      dlgProgress: ["Cinq slimes, chevalier. Je compte sur ta lame."],
      dlgComplete: ["Le potager respire enfin. Prends cette bourse… et cette relique : ton cœur en sera fortifié."],
      dlgDone: ["Le village te doit beaucoup."],
    },
    bread: {
      name: "La miche du bûcheron", giver: "baker", turnInAt: "woodcutter",
      type: "deliver", item: "bread", grantItem: "bread",
      reward: { gold: 15 },
      dlgOffer: [
        "Le bûcheron n'est pas venu chercher son pain. Tu le lui portes ?",
        "Tiens, la miche est encore chaude. Il travaille à l'est de la forêt.",
      ],
      dlgProgress: ["Le bûcheron doit avoir faim… la miche est dans ton sac."],
      dlgComplete: ["Ah, du pain frais ! Merci mille fois. Voilà pour ta peine."],
      dlgDone: ["Encore merci pour le pain, chevalier."],
    },
    amulet: {
      name: "L'amulette du bosquet", giver: "woodcutter", turnInAt: "woodcutter",
      type: "fetch", item: "amulet", prereq: "bread",
      reward: { gold: 40, sword: 1 },
      dlgOffer: [
        "Une brute s'est installée dans la grotte, au sud.",
        "Elle garde une vieille clé. Derrière, un coffre — et l'amulette de mon grand-père.",
        "Rapporte-la-moi et j'affûterai ta lame.",
      ],
      dlgProgress: ["La brute d'abord — elle a la clé. Le coffre est au fond de la grotte."],
      dlgComplete: ["L'amulette ! Tu l'as retrouvée… Prends cet or. Et donne-moi ta lame un instant."],
      dlgDone: ["Cette amulette appartenait à mon grand-père. Merci."],
    },
  };
  const ITEM_NAME = {
    bread: "Miche de pain", key: "Vieille clé", amulet: "Amulette du bosquet",
  };

  // ---------------------------------------------------------------- état
  let state = "title"; // title | play | dialogue | menu | shop | over
  let mapId = "village";
  let map = MAPS.village;
  let cam = { x: 0, y: 0 };
  let time = 0;

  const player = {
    x: 0, y: 0, dir: "down", moving: false, anim: 0, gait: 0,
    hp: 3, maxHp: 3, gold: 0, sword: 0,
    bag: [], iframe: 0, kb: { x: 0, y: 0 },
    attack: 0, attackDir: "down",
  };
  let quest = {}; // id -> { state, progress }
  let world = { chestOpened: false, bruteDefeated: false };
  let enemies = [];
  let pickups = [];

  const input = { mx: 0, my: 0, attack: false, interact: false };
  let atkHeld = false; // bouton ⚔️ maintenu -> attaques enchaînées
  let hurtFx = 0;      // minuteur du flash rouge quand on encaisse
  let leftHanded = false;
  try { leftHanded = localStorage.getItem("quete-lefty") === "1"; } catch (e) {}

  // ---------------------------------------------------------------- sauvegarde
  function freshQuests() {
    return {
      slimes: { state: "available", progress: 0 },
      bread: { state: "available", progress: 0 },
      amulet: { state: "locked", progress: 0 },
    };
  }
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        mapId,
        player: {
          x: player.x, y: player.y, dir: player.dir,
          hp: player.hp, maxHp: player.maxHp, gold: player.gold,
          sword: player.sword, bag: player.bag,
        },
        quest, world,
      }));
    } catch (e) {}
  }
  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }
  function loadGame() {
    let d;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { d = null; }
    if (!d) return newGame();
    mapId = MAPS[d.mapId] ? d.mapId : "village";
    map = MAPS[mapId];
    Object.assign(player, {
      x: d.player.x, y: d.player.y, dir: d.player.dir || "down",
      hp: d.player.hp, maxHp: d.player.maxHp, gold: d.player.gold || 0,
      sword: d.player.sword || 0, bag: d.player.bag || [],
      iframe: 0, attack: 0, kb: { x: 0, y: 0 }, moving: false,
    });
    quest = Object.assign(freshQuests(), d.quest || {});
    world = Object.assign({ chestOpened: false, bruteDefeated: false }, d.world || {});
    enterMap(mapId, player.x / TILE, player.y / TILE, true);
    startPlay();
  }
  function newGame() {
    mapId = "village";
    map = MAPS.village;
    Object.assign(player, {
      dir: "down", hp: 3, maxHp: 3, gold: 0, sword: 0, bag: [],
      iframe: 0, attack: 0, kb: { x: 0, y: 0 }, moving: false,
    });
    quest = freshQuests();
    world = { chestOpened: false, bruteDefeated: false };
    enterMap("village", MAPS.village.spawn.x, MAPS.village.spawn.y, true);
    startPlay();
    startDialogue("", [
      "Bonrepos, un matin brumeux.",
      "Tu es le nouveau chevalier du village. Va voir l'Ancien, près du puits.",
    ], showFirstHint);
  }
  function showFirstHint() {
    try {
      if (localStorage.getItem("quete-tuto")) return;
      localStorage.setItem("quete-tuto", "1");
    } catch (e) {}
    const fh = document.getElementById("firsthint");
    if (!fh) return;
    fh.hidden = false;
    setTimeout(() => { fh.hidden = true; }, 3600);
  }

  // ---------------------------------------------------------------- cartes : entrée
  function enterMap(id, tx, ty, keepSpawnAsIs) {
    mapId = id;
    map = MAPS[id];
    player.x = Math.max(TILE, Math.min((map.w - 1.5) * TILE, tx * TILE + TILE / 2));
    player.y = Math.max(TILE, Math.min((map.h - 1.5) * TILE, ty * TILE + TILE / 2));
    player.kb.x = player.kb.y = 0;
    player.attack = 0;
    footDust.length = 0;
    enemies = [];
    for (const e of map.enemies) {
      if (id === "grotte" && e.type === "brute" && world.bruteDefeated) continue;
      enemies.push(makeEnemy(e.type, e.x * TILE + TILE / 2, e.y * TILE + TILE / 2));
    }
    pickups = [];
    updateCamera(true);
    save();
  }

  function makeEnemy(type, x, y) {
    const base = {
      slime: { hp: 1, speed: 0.24, r: 6, dmg: 1, aggro: 58, gold: [1, 3] },
      wolf: { hp: 2, speed: 0.55, r: 6, dmg: 1, aggro: 105, gold: [2, 4] },
      brute: { hp: 6, speed: 0.42, r: 9, dmg: 2, aggro: 150, gold: [8, 14] },
    }[type];
    return {
      type, x, y, hp: base.hp, maxHp: base.hp, ...base,
      dir: "down", flash: 0, kb: { x: 0, y: 0 },
      wander: { x: 0, y: 0 }, wanderT: 0, hurtCd: 0,
    };
  }

  // ---------------------------------------------------------------- collision
  function solidAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
    return isSolidChar(map.g[ty][tx]);
  }
  function moveEntity(ent, dx, dy, halfW, halfH) {
    if (dx) {
      const nx = ent.x + dx;
      const side = dx > 0 ? nx + halfW : nx - halfW;
      if (!solidAt(side, ent.y - halfH + 1) && !solidAt(side, ent.y + halfH - 1) && !solidAt(side, ent.y)) ent.x = nx;
    }
    if (dy) {
      const ny = ent.y + dy;
      const side = dy > 0 ? ny + halfH : ny - halfH;
      if (!solidAt(ent.x - halfW + 1, side) && !solidAt(ent.x + halfW - 1, side) && !solidAt(ent.x, side)) ent.y = ny;
    }
  }

  // ---------------------------------------------------------------- dialogue
  let dlg = { lines: [], i: 0, name: "", cb: null };
  const dlgEl = document.getElementById("dialogue");
  const dlgName = document.getElementById("dlg-name");
  const dlgText = document.getElementById("dlg-text");
  function startDialogue(name, lines, cb) {
    dlg = { lines: lines.slice(), i: 0, name: name || "", cb: cb || null };
    state = "dialogue";
    renderDialogue();
    dlgEl.hidden = false;
  }
  function renderDialogue() {
    dlgName.textContent = dlg.name;
    dlgText.textContent = dlg.lines[dlg.i] || "";
  }
  function advanceDialogue() {
    dlg.i++;
    if (dlg.i >= dlg.lines.length) {
      dlgEl.hidden = true;
      state = "play";
      const cb = dlg.cb; dlg.cb = null;
      if (cb) cb();
    } else {
      renderDialogue();
    }
  }

  // ---------------------------------------------------------------- toasts
  const toastsEl = document.getElementById("toasts");
  function toast(msg) {
    const d = document.createElement("div");
    d.className = "toast";
    d.textContent = msg;
    toastsEl.appendChild(d);
    setTimeout(() => d.remove(), 2100);
  }

  // ---------------------------------------------------------------- sac / quêtes logique
  function hasItem(it) { return player.bag.includes(it); }
  function giveItem(it) {
    if (!hasItem(it)) player.bag.push(it);
    toast("Objet reçu : " + (ITEM_NAME[it] || it));
    for (const id in QUESTS) {
      const q = QUESTS[id], st = quest[id];
      if (q.type === "fetch" && q.item === it && st.state === "active") {
        st.state = "ready";
        toast("Objectif atteint : parle au " + npcTitle(q.turnInAt));
      }
    }
    save();
  }
  function removeItem(it) {
    const i = player.bag.indexOf(it);
    if (i >= 0) player.bag.splice(i, 1);
  }
  function npcTitle(id) {
    return { elder: "l'Ancien", baker: "à la Boulangère", woodcutter: "Bûcheron" }[id] || id;
  }
  function setQuest(id, s) { quest[id].state = s; save(); }
  function onEnemyKilled(type) {
    for (const id in QUESTS) {
      const q = QUESTS[id], st = quest[id];
      if (q.type === "kill" && q.targetType === type && st.state === "active") {
        st.progress++;
        if (st.progress >= q.count) {
          st.state = "ready";
          toast("Objectif atteint : retourne voir " + npcTitle(q.turnInAt));
        } else {
          toast(labelKill(type) + " " + st.progress + "/" + q.count);
        }
      }
    }
    updateHud();
  }
  const labelKill = (t) => ({ slime: "Slimes", wolf: "Loups", brute: "Brute" }[t] || t);
  function completeQuest(id) {
    const q = QUESTS[id];
    quest[id].state = "done";
    if (q.item) removeItem(q.item);
    const r = q.reward || {};
    if (r.gold) { player.gold += r.gold; toast("+" + r.gold + " or"); }
    if (r.maxHp) { player.maxHp += r.maxHp; player.hp = player.maxHp; toast("Cœur maximal +" + r.maxHp); }
    if (r.sword) { player.sword = Math.max(player.sword, r.sword); toast("Ta lame est affûtée !"); }
    toast("Quête terminée : " + q.name);
    // débloque les quêtes dont le prérequis est rempli
    for (const oid in QUESTS) {
      if (QUESTS[oid].prereq === id && quest[oid].state === "locked") {
        quest[oid].state = "available";
        toast("Nouvelle quête disponible !");
      }
    }
    updateHud();
    save();
  }

  // ---------------------------------------------------------------- interaction
  function facingTile() {
    const d = DIRV[player.dir];
    return {
      x: Math.floor((player.x + d.x * TILE) / TILE),
      y: Math.floor((player.y + d.y * TILE) / TILE),
    };
  }
  const DIRV = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

  function tryInteract() {
    // PNJ le plus proche à portée
    let npc = null, best = 22 * 22;
    for (const n of map.npcs) {
      const nx = n.x * TILE + TILE / 2, ny = n.y * TILE + TILE / 2;
      const d = (nx - player.x) ** 2 + (ny - player.y) ** 2;
      if (d < best) { best = d; npc = n; }
    }
    if (npc) { talkTo(npc); return; }

    const ft = facingTile();
    const key = ft.x + "," + ft.y;
    if (map.signs[key]) { startDialogue("Panneau", map.signs[key]); return; }
    if ((map.wells || []).includes(key)) {
      startDialogue("", ["L'eau du puits est fraîche et claire.", "Tu bois longuement… te voilà revigoré."], () => {
        player.hp = player.maxHp; updateHud();
      });
      return;
    }
    if (map.chest && key === map.chest) {
      if (world.chestOpened) { startDialogue("", ["Le coffre est vide."]); return; }
      if (!hasItem("key")) { startDialogue("", ["Un lourd cadenas de fer. Il te faudrait une clé."]); return; }
      startDialogue("", ["Tu tournes la vieille clé… *clic*.", "À l'intérieur : une amulette ancienne."], () => {
        world.chestOpened = true; removeItem("key"); giveItem("amulet");
      });
      return;
    }
  }

  function questsForNpc(npcId) {
    const list = [];
    for (const id in QUESTS) if (QUESTS[id].giver === npcId || QUESTS[id].turnInAt === npcId) list.push(id);
    return list;
  }
  function talkTo(npc) {
    if (npc.shop) { openShop(); return; }
    // livraison : devient "ready" en parlant à la cible avec l'objet
    for (const id in QUESTS) {
      const q = QUESTS[id], st = quest[id];
      if (q.type === "deliver" && q.turnInAt === npc.id && st.state === "active" && hasItem(q.item)) st.state = "ready";
    }
    // 1) une quête à rendre ici ?
    for (const id of questsForNpc(npc.id)) {
      if (QUESTS[id].turnInAt === npc.id && quest[id].state === "ready") {
        startDialogue(npc.name, QUESTS[id].dlgComplete, () => completeQuest(id));
        return;
      }
    }
    // 2) une quête à donner ?
    for (const id of questsForNpc(npc.id)) {
      if (QUESTS[id].giver === npc.id && quest[id].state === "available") {
        const q = QUESTS[id];
        startDialogue(npc.name, q.dlgOffer, () => {
          setQuest(id, "active");
          if (q.grantItem) giveItem(q.grantItem);
          toast("Quête acceptée : " + q.name);
          updateHud();
        });
        return;
      }
    }
    // 3) quête en cours donnée par ce PNJ ?
    for (const id of questsForNpc(npc.id)) {
      if (QUESTS[id].giver === npc.id && quest[id].state === "active") {
        startDialogue(npc.name, QUESTS[id].dlgProgress);
        return;
      }
    }
    // 4) quête déjà finie ?
    for (const id of questsForNpc(npc.id)) {
      if (quest[id].state === "done" && QUESTS[id].dlgDone) {
        startDialogue(npc.name, QUESTS[id].dlgDone);
        return;
      }
    }
    startDialogue(npc.name, idleLine(npc.id));
  }
  function idleLine(id) {
    return {
      elder: ["Que la route te soit clémente, chevalier."],
      baker: ["Ça sent bon le pain chaud, n'est-ce pas ?"],
      woodcutter: ["*coup de hache* … Tu as besoin de quelque chose ?"],
      villager: ["Belle matinée, chevalier.", "On dort sur nos deux oreilles depuis que tu veilles."],
    }[id] || ["…"];
  }

  // ---------------------------------------------------------------- échoppe
  const SHOP = [
    { id: "potion", icon: "🧪", name: "Potion de soin", desc: "Restaure tous les cœurs.", price: 10 },
    { id: "heart", icon: "❤️", name: "Cœur supplémentaire", desc: "Cœur maximal +1 (et soin complet).", price: 50, max: 2 },
    { id: "sword", icon: "🗡️", name: "Lame renforcée", desc: "+1 dégât, portée accrue.", price: 40, once: true },
  ];
  let shopBought = { heart: 0 };
  const shopEl = document.getElementById("shop");
  function openShop() {
    if (state !== "play") return;
    state = "shop";
    renderShop();
    shopEl.hidden = false;
  }
  function renderShop() {
    document.getElementById("shop-gold").textContent = "Bourse : " + player.gold + " or";
    const box = document.getElementById("shop-items");
    box.innerHTML = "";
    for (const it of SHOP) {
      const b = document.createElement("button");
      b.className = "buy";
      let disabled = player.gold < it.price;
      let note = "";
      if (it.once && it.id === "sword" && player.sword >= 1) { disabled = true; note = " (déjà acquis)"; }
      if (it.max && shopBought.heart >= it.max) { disabled = true; note = " (max atteint)"; }
      b.disabled = disabled;
      b.innerHTML = `<span class="bi">${it.icon}</span><span class="bt"><b>${it.name}${note}</b><span>${it.desc}</span></span><span class="bp">${it.price} or</span>`;
      b.addEventListener("click", () => buy(it));
      box.appendChild(b);
    }
  }
  function buy(it) {
    if (player.gold < it.price) return;
    if (it.id === "sword" && player.sword >= 1) return;
    if (it.id === "heart" && shopBought.heart >= (it.max || 99)) return;
    player.gold -= it.price;
    if (it.id === "potion") player.hp = player.maxHp;
    if (it.id === "heart") { player.maxHp++; player.hp = player.maxHp; shopBought.heart++; }
    if (it.id === "sword") player.sword = 1;
    toast("Acheté : " + it.name);
    updateHud();
    renderShop();
    save();
  }
  document.getElementById("btn-shop-close").addEventListener("click", () => { shopEl.hidden = true; state = "play"; });

  // ---------------------------------------------------------------- HUD
  const heartsEl = document.getElementById("hearts");
  const goldNEl = document.getElementById("gold-n");
  const trackerEl = document.getElementById("tracker");
  function heartSVG(kind) {
    const fill = kind === "full" ? "#e8455f" : kind === "half" ? "#e8455f" : "#3a2a18";
    const clip = kind === "half" ? '<clipPath id="h"><rect x="0" y="0" width="12" height="24"/></clipPath>' : "";
    const path = '<path d="M12 21C12 21 3 14.5 3 8.5C3 5.5 5.2 3.5 7.7 3.5C9.4 3.5 11 4.6 12 6C13 4.6 14.6 3.5 16.3 3.5C18.8 3.5 21 5.5 21 8.5C21 14.5 12 21 12 21Z"';
    const base = `<svg class="heart" viewBox="0 0 24 24">${clip}${path} fill="#2a1a10" stroke="#1a0f08" stroke-width="1.5"/>`;
    if (kind === "empty") return base + "</svg>";
    if (kind === "half") return base + `${path} fill="${fill}" clip-path="url(#h)"/></svg>`;
    return base + `${path} fill="${fill}"/></svg>`;
  }
  function updateHud() {
    let h = "";
    for (let i = 0; i < player.maxHp; i++) h += heartSVG(i < player.hp ? "full" : "empty");
    heartsEl.innerHTML = h;
    goldNEl.textContent = player.gold;
    // suivi de quête
    let track = "";
    for (const id in QUESTS) {
      const q = QUESTS[id], st = quest[id];
      if (st.state === "active") {
        if (q.type === "kill") track = q.name + " — <b>" + st.progress + "/" + q.count + "</b>";
        else if (q.type === "deliver") track = q.name + " — <b>porter la miche</b>";
        else if (q.type === "fetch") track = q.name + " — <b>trouver l'amulette</b>";
        break;
      }
      if (st.state === "ready") { track = q.name + " — <b>à rendre</b>"; break; }
    }
    if (track) { trackerEl.innerHTML = track; trackerEl.hidden = false; }
    else trackerEl.hidden = true;
  }

  // ---------------------------------------------------------------- menu / journal
  const menuEl = document.getElementById("menu");
  function openMenu() {
    if (state !== "play") return;
    state = "menu";
    const qbox = document.getElementById("menu-quests");
    qbox.innerHTML = "";
    let any = false;
    for (const id in QUESTS) {
      const q = QUESTS[id], st = quest[id];
      if (st.state === "locked") continue;
      any = true;
      const d = document.createElement("div");
      d.className = "q";
      let s = "";
      if (st.state === "available") s = '<span class="prog">Disponible — va voir ' + npcTitle(q.giver) + "</span>";
      else if (st.state === "active" && q.type === "kill") s = '<span class="prog">' + labelKill(q.targetType) + " : " + st.progress + "/" + q.count + "</span>";
      else if (st.state === "active") s = '<span class="prog">En cours</span>';
      else if (st.state === "ready") s = '<span class="prog">Objectif atteint — retourne rendre la quête</span>';
      else if (st.state === "done") s = '<span class="done">✔ Terminée</span>';
      d.innerHTML = '<div class="qn">' + q.name + '</div><div class="qd">' + q.dlgOffer[0] + '</div><div class="qs">' + s + "</div>";
      qbox.appendChild(d);
    }
    if (!any) qbox.innerHTML = '<div class="empty">Aucune quête connue.</div>';
    const bag = document.getElementById("menu-bag");
    bag.innerHTML = player.bag.length
      ? player.bag.map((i) => '<div class="it">• ' + (ITEM_NAME[i] || i) + "</div>").join("")
      : '<div class="empty">Ton sac est vide.</div>';
    menuEl.hidden = false;
  }
  document.getElementById("btn-resume").addEventListener("click", () => { menuEl.hidden = true; state = "play"; });
  document.getElementById("btn-quit").addEventListener("click", () => {
    menuEl.hidden = true; save(); showTitle();
  });
  document.getElementById("menu-btn").addEventListener("click", () => {
    if (state === "play") openMenu();
  });
  // mode gaucher
  function applyLefty() {
    document.getElementById("game").classList.toggle("lefty", leftHanded);
    const b = document.getElementById("btn-lefty");
    b.setAttribute("aria-pressed", leftHanded ? "true" : "false");
    b.querySelector("b").textContent = leftHanded ? "Oui" : "Non";
  }
  document.getElementById("btn-lefty").addEventListener("click", () => {
    leftHanded = !leftHanded;
    try { localStorage.setItem("quete-lefty", leftHanded ? "1" : "0"); } catch (e) {}
    applyLefty();
  });
  applyLefty();

  // ---------------------------------------------------------------- écran-titre / game over
  const titleEl = document.getElementById("title");
  const overEl = document.getElementById("over");
  const hudEl = document.getElementById("hud");
  const padEl = document.getElementById("pad");
  function saveSummary() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d) return null;
      const name = (MAPS[d.mapId] && MAPS[d.mapId].name) || "En chemin";
      const gold = (d.player && d.player.gold) || 0;
      let q = 0;
      for (const id in (d.quest || {})) { const st = d.quest[id].state; if (st === "active" || st === "ready") q++; }
      const qt = q === 0 ? "aucune quête en cours" : q === 1 ? "1 quête" : q + " quêtes";
      return name + " · " + gold + " or · " + qt;
    } catch (e) { return null; }
  }
  function showTitle() {
    state = "title";
    titleEl.hidden = false;
    hudEl.hidden = true;
    padEl.hidden = true;
    const has = hasSave();
    document.getElementById("btn-continue").hidden = !has;
    const csub = document.getElementById("continue-sub");
    const sum = has ? saveSummary() : null;
    if (sum) { csub.textContent = sum; csub.hidden = false; } else csub.hidden = true;
    // relance la séquence d'apparition
    titleEl.classList.remove("animate");
    void titleEl.offsetWidth;
    titleEl.classList.add("animate");
  }

  const fadeEl = document.getElementById("fade");
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function fadeTo(fn) {
    if (REDUCED) { fn(); return; }
    fadeEl.classList.add("on");
    setTimeout(() => { fn(); requestAnimationFrame(() => fadeEl.classList.remove("on")); }, 340);
  }

  // ---- transition « volet iris » pour entrer/sortir d'un lieu fermé (grotte, maison, échoppe)
  let trans = null;                 // { phase:"in"|"out", t, dur, fn, cx, cy }
  function irisEase(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function irisTo(fn) {
    if (REDUCED || trans) { if (!trans) fn(); return; }
    trans = { phase: "in", t: 0, dur: 14, fn, cx: px(player.x), cy: py(player.y) };
  }
  function updateTransition(dt) {
    input.mx = input.my = 0; input.attack = input.interact = false; atkHeld = false;
    trans.t += dt;
    if (trans.t < trans.dur) return;
    if (trans.phase === "in") {
      const fn = trans.fn; trans.fn = null;
      if (fn) fn();
      trans.phase = "out"; trans.t = 0;
      trans.cx = px(player.x); trans.cy = py(player.y);
    } else {
      trans = null;
    }
  }
  function drawIris() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const maxR = Math.hypot(VIEW_W, VIEW_H) * 0.62;
    const k = Math.max(0, Math.min(1, trans.t / trans.dur));
    const r = Math.max(0, trans.phase === "in" ? maxR * (1 - irisEase(k)) : maxR * irisEase(k));
    ctx.fillStyle = "#0a0908";
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.arc(trans.cx, trans.cy, r, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    if (r > 1) {
      ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(trans.cx, trans.cy, r + 2.5, 0, Math.PI * 2); ctx.stroke();
    }
  }
  function startPlay() {
    titleEl.hidden = true;
    overEl.hidden = true;
    hudEl.hidden = false;
    padEl.hidden = false;
    state = "play";
    updateHud();
  }
  document.getElementById("btn-new").addEventListener("click", () => fadeTo(newGame));
  document.getElementById("btn-continue").addEventListener("click", () => fadeTo(loadGame));
  document.getElementById("btn-revive").addEventListener("click", () => fadeTo(() => {
    overEl.hidden = true;
    player.hp = player.maxHp;
    player.iframe = 60;
    enterMap("village", MAPS.village.spawn.x, MAPS.village.spawn.y);
    startPlay();
  }));
  function gameOver() {
    state = "over";
    dlgEl.hidden = true; menuEl.hidden = true; shopEl.hidden = true;
    document.getElementById("over-sub").textContent =
      "Tu gardes ton or (" + player.gold + ") et tes quêtes. Repose-toi et repars.";
    overEl.hidden = false;
  }

  // ---------------------------------------------------------------- entrées
  // joystick
  let stickId = null, stickBase = { x: 0, y: 0 };
  const stickEl = document.getElementById("stick");
  const knobEl = document.getElementById("knob");
  function stickStart(id, x, y) {
    stickId = id;
    stickBase = { x, y };
    stickEl.style.left = x - 59 + "px";
    stickEl.style.top = y - 59 + "px";
    stickEl.classList.add("on");
  }
  function stickMove(x, y) {
    let dx = x - stickBase.x, dy = y - stickBase.y;
    const len = Math.hypot(dx, dy) || 1;
    const R = 46;
    const cl = Math.min(len, R);
    const nx = (dx / len), ny = (dy / len);
    knobEl.style.transform = `translate(${nx * cl}px, ${ny * cl}px)`;
    const mag = cl / R;
    if (mag < 0.12) { input.mx = 0; input.my = 0; }          // zone morte réduite
    else {
      const tier = mag < 0.62 ? 0.58 : 1;                    // marche / course, deux paliers
      input.mx = nx * tier; input.my = ny * tier;
    }
  }
  function stickEnd() {
    stickId = null;
    input.mx = 0; input.my = 0;
    knobEl.style.transform = "translate(0,0)";
    stickEl.classList.remove("on");
  }
  cv.addEventListener("touchstart", (e) => {
    if (state !== "play") return;
    const w = window.innerWidth;
    for (const t of e.changedTouches) {
      // le joystick ne naît que du côté marche (gauche, ou droite en mode gaucher)
      const inZone = leftHanded ? t.clientX > w * 0.4 : t.clientX < w * 0.6;
      if (stickId === null && inZone) stickStart(t.identifier, t.clientX, t.clientY);
    }
  }, { passive: true });
  cv.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === stickId) stickMove(t.clientX, t.clientY);
  }, { passive: false });
  const endTouch = (e) => { for (const t of e.changedTouches) if (t.identifier === stickId) stickEnd(); };
  cv.addEventListener("touchend", endTouch);
  cv.addEventListener("touchcancel", endTouch);
  // tap sur le canvas = avancer dialogue
  cv.addEventListener("pointerdown", () => { if (state === "dialogue") advanceDialogue(); });

  const btnA = document.getElementById("btn-a");
  const btnB = document.getElementById("btn-b");
  // Boutons : on écoute directement touchstart/touchend (fiable en multi-touch sur iOS,
  // contrairement à pointerdown qui rate le 2e doigt quand le joystick est tenu).
  function bindBtn(el, kind, onHold) {
    el.addEventListener("touchstart", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (onHold) onHold(true);
      pressAction(kind);
    }, { passive: false });
    const up = (e) => { if (e.cancelable) e.preventDefault(); if (onHold) onHold(false); };
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("touchcancel", up);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    // souris (bureau) — le preventDefault du touchstart supprime le mousedown synthétique sur mobile
    el.addEventListener("mousedown", (e) => { e.preventDefault(); if (onHold) onHold(true); pressAction(kind); });
    el.addEventListener("mouseup", () => { if (onHold) onHold(false); });
    el.addEventListener("mouseleave", () => { if (onHold) onHold(false); });
  }
  bindBtn(btnA, "attack", (v) => { atkHeld = v; });
  bindBtn(btnB, "interact");
  function pressAction(kind) {
    if (state === "dialogue") { advanceDialogue(); return; }
    if (state !== "play") return;
    if (kind === "attack") input.attack = true;
    if (kind === "interact") input.interact = true;
  }

  // clavier (test / desktop)
  const keys = {};
  addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    const k = e.key.toLowerCase();
    if (state === "dialogue" && (k === " " || k === "enter" || k === "e" || k === "j")) { e.preventDefault(); advanceDialogue(); return; }
    if (state === "title" && (k === "enter" || k === " ")) { fadeTo(hasSave() ? loadGame : newGame); return; }
    if (state === "over" && (k === "enter" || k === " ")) { document.getElementById("btn-revive").click(); return; }
    if (state === "play") {
      if (k === "j" || k === " ") { e.preventDefault(); input.attack = true; }
      if (k === "e" || k === "f") input.interact = true;
      if (k === "m" || k === "escape" || k === "tab") { e.preventDefault(); openMenu(); }
    } else if (state === "menu" && (k === "m" || k === "escape")) {
      menuEl.hidden = true; state = "play";
    } else if (state === "shop" && k === "escape") {
      shopEl.hidden = true; state = "play";
    }
  });
  addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
  function keyboardMove() {
    let x = 0, y = 0;
    if (keys["arrowleft"] || keys["a"] || keys["q"]) x -= 1;
    if (keys["arrowright"] || keys["d"]) x += 1;
    if (keys["arrowup"] || keys["w"] || keys["z"]) y -= 1;
    if (keys["arrowdown"] || keys["s"]) y += 1;
    if (x || y) { const l = Math.hypot(x, y); input.mx = x / l; input.my = y / l; }
  }

  // ---------------------------------------------------------------- boucle : update
  function update(dt) {
    time += dt;
    if (hurtFx > 0) hurtFx -= dt;
    if (trans) { updateTransition(dt); return; }
    if (state !== "play") { input.attack = input.interact = false; atkHeld = false; return; }
    keyboardMove();

    // interaction
    if (input.interact) { input.interact = false; tryInteract(); return; }

    // attaque (le bouton maintenu enchaîne les coups à la cadence du geste)
    if (atkHeld) input.attack = true;
    if (input.attack && player.attack <= 0) {
      const ax = input.mx, ay = input.my;
      if (ax * ax + ay * ay > 0.04) {
        // frappe vers là où pousse le joystick
        player.attackDir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? "right" : "left") : (ay > 0 ? "down" : "up");
        player.dir = player.attackDir;
      } else {
        player.attackDir = player.dir;
      }
      player.attack = 12;                 // 15 -> 12 : le coup sort plus vite
      input.attack = false;
    }
    input.attack = false;
    if (player.attack > 0) player.attack--;

    // déplacement joueur
    const sp = 1.15;
    let mvx = input.mx, mvy = input.my;
    player.moving = (mvx * mvx + mvy * mvy) > 0.02 && player.attack < 10;
    if (player.moving) {
      if (Math.abs(mvx) > Math.abs(mvy)) player.dir = mvx > 0 ? "right" : "left";
      else player.dir = mvy > 0 ? "down" : "up";
      // cadence des jambes proportionnelle à l'allure (marche vs course)
      player.anim += dt * (0.1 + 0.09 * Math.min(1, Math.hypot(mvx, mvy)));
    }
    // "gait" : 0..1 qui monte/descend en douceur -> la marche s'enclenche et se pose sans à-coup
    player.gait += ((player.moving ? 1 : 0) - player.gait) * Math.min(1, 0.28 * dt);
    if (!player.moving && player.gait < 0.02) { player.gait = 0; player.anim = 0; }
    // recul
    if (Math.abs(player.kb.x) > 0.1 || Math.abs(player.kb.y) > 0.1) {
      moveEntity(player, player.kb.x * dt, player.kb.y * dt, 5, 4);
      const decay = Math.pow(0.8, dt);
      player.kb.x *= decay; player.kb.y *= decay;
    }
    if (player.moving) moveEntity(player, mvx * sp * dt, mvy * sp * dt, 5, 4);
    if (player.iframe > 0) player.iframe--;

    // transitions de carte : volet iris qui se ferme puis se rouvre
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
    for (const tr of map.transitions) {
      if (tr.x === ptx && tr.y === pty) {
        const to = tr.to, dx = tr.tx, dy = tr.ty;
        irisTo(() => enterMap(to, dx, dy));
        return;
      }
    }

    updateEnemies(dt);
    updatePickups();
    updateCamera(false, dt);
  }

  function updateEnemies(dt) {
    // hitbox d'attaque du joueur
    let atkBox = null;
    if (player.attack > 2 && player.attack < 14) {
      const d = DIRV[player.attackDir];
      const reach = player.sword ? 18 : 15;
      atkBox = { x: player.x + d.x * 11, y: player.y + d.y * 11, r: reach };
    }
    for (const e of enemies) {
      if (e.dead) continue;
      e.wanderT -= dt;
      const dx = player.x - e.x, dy = player.y - e.y;
      const dist = Math.hypot(dx, dy);
      let vx = 0, vy = 0;
      if (dist < e.aggro) { vx = dx / dist; vy = dy / dist; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"); }
      else {
        if (e.wanderT <= 0) {
          e.wanderT = 40 + Math.random() * 60;
          const a = Math.random() * Math.PI * 2;
          e.wander = Math.random() < 0.4 ? { x: 0, y: 0 } : { x: Math.cos(a), y: Math.sin(a) };
        }
        vx = e.wander.x; vy = e.wander.y;
      }
      if (Math.abs(e.kb.x) > 0.1 || Math.abs(e.kb.y) > 0.1) {
        moveEntity(e, e.kb.x * dt, e.kb.y * dt, e.r - 1, e.r - 1);
        const decay = Math.pow(0.78, dt);
        e.kb.x *= decay; e.kb.y *= decay;
      } else {
        moveEntity(e, vx * e.speed * dt, vy * e.speed * dt, e.r - 1, e.r - 1);
      }
      // sur la carte continue, les bêtes ne remontent pas dans le village
      const nLim = (map.forestY || 0) * TILE;
      if (nLim && e.y < nLim + e.r) e.y = nLim + e.r;
      if (e.flash > 0) e.flash--;
      if (e.hurtCd > 0) e.hurtCd--;

      // touché par l'attaque ?
      if (atkBox && e.hurtCd <= 0) {
        if (Math.hypot(e.x - atkBox.x, e.y - atkBox.y) < atkBox.r + e.r) {
          const dmg = 1 + player.sword;
          e.hp -= dmg;
          e.flash = 10;
          e.hurtCd = 12;
          const kd = DIRV[player.attackDir];
          e.kb.x = kd.x * 3.4; e.kb.y = kd.y * 3.4;
          if (e.hp <= 0) killEnemy(e);
        }
      }
      // contact avec le joueur (pas juste après avoir encaissé un coup)
      if (!e.dead && e.flash <= 0 && player.iframe <= 0 && dist < e.r + 5) {
        const before = player.hp;
        player.hp -= e.dmg;
        player.iframe = 50;              // invincibilité raccourcie (était 85 ≈ 1,4 s -> ~0,8 s)
        hurtFx = 20;                     // flash rouge sur les bords
        const k = dist || 1;
        player.kb.x = (-dx / k) * 1.8; player.kb.y = (-dy / k) * 1.8;  // recul réduit
        updateHud();
        // les cœurs qui viennent de se vider tressautent
        for (let c = Math.max(0, player.hp); c < before; c++) {
          const hh = heartsEl.children[c];
          if (hh) { hh.classList.remove("hit"); void hh.offsetWidth; hh.classList.add("hit"); }
        }
        if (player.hp <= 0) { player.hp = 0; updateHud(); gameOver(); return; }
      }
    }
    enemies = enemies.filter((e) => !e.dead || e.deadT-- > 0);
  }

  function killEnemy(e) {
    e.dead = true; e.deadT = 10;
    onEnemyKilled(e.type);
    if (e.type === "brute") {
      world.bruteDefeated = true;
      pickups.push({ kind: "key", x: e.x, y: e.y, t: 0 });
    }
    const [lo, hi] = e.gold;
    const g = lo + ((Math.random() * (hi - lo + 1)) | 0);
    for (let i = 0; i < g; i++) pickups.push({ kind: "coin", x: e.x + (Math.random() * 10 - 5), y: e.y + (Math.random() * 10 - 5), t: 0, v: 1 });
    if (Math.random() < 0.22 && player.hp < player.maxHp) pickups.push({ kind: "heart", x: e.x, y: e.y, t: 0 });
    save();
  }

  function updatePickups() {
    for (const p of pickups) {
      if (p.got) continue;
      p.t += 1;
      const dx = player.x - p.x, dy = player.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 30 && p.kind === "coin") { p.x += dx / d * 1.8; p.y += dy / d * 1.8; }
      if (d < 9) {
        p.got = true;
        if (p.kind === "coin") { player.gold += p.v || 1; }
        else if (p.kind === "heart") { player.hp = Math.min(player.maxHp, player.hp + 1); }
        else if (p.kind === "key") { giveItem("key"); }
        updateHud();
        if (p.kind !== "key") save();
      }
    }
    pickups = pickups.filter((p) => !p.got);
  }

  // ---------------------------------------------------------------- caméra
  function updateCamera(snap, dt) {
    const vw = VIEW_W, vh = VIEW_H;
    let tx = player.x - vw / 2, ty = player.y - vh / 2;
    const maxX = Math.max(0, map.w * TILE - vw);
    const maxY = Math.max(0, map.h * TILE - vh);
    tx = Math.max(0, Math.min(maxX, tx));
    ty = Math.max(0, Math.min(maxY, ty));
    if (map.w * TILE < vw) tx = (map.w * TILE - vw) / 2;
    if (map.h * TILE < vh) ty = (map.h * TILE - vh) / 2;
    if (snap) { cam.x = tx; cam.y = ty; return; }
    // suivi souple, indépendant du framerate
    const k = 1 - Math.pow(0.78, dt || 1);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    // évite le sur-lissage résiduel (sinon micro-dérive infinie)
    if (Math.abs(tx - cam.x) < 0.06) cam.x = tx;
    if (Math.abs(ty - cam.y) < 0.06) cam.y = ty;
  }

  // ---------------------------------------------------------------- rendu
  function resize() {
    const r = cv.getBoundingClientRect();
    VIEW_W = 240;
    VIEW_H = Math.max(280, Math.min(470, Math.round(240 * r.height / Math.max(1, r.width))));
    cv.width = Math.round(VIEW_W * DPR);
    cv.height = Math.round(VIEW_H * DPR);
    ctx.imageSmoothingEnabled = true;
    updateCamera(true);
  }
  addEventListener("resize", resize);

  // positions écran en sous-pixel (lissage) — la caméra est arrondie une seule fois par image
  function px(v) { return v - cam.x; }
  function py(v) { return v - cam.y; }

  // -------- helpers de rendu « peint »
  function lgV(x, y0, y1, a, b, c) {
    const g = ctx.createLinearGradient(x, y0, x, y1);
    g.addColorStop(0, a); if (c) { g.addColorStop(0.5, b); g.addColorStop(1, c); } else g.addColorStop(1, b);
    return g;
  }
  function lgH(x0, x1, y, a, b, c) {
    const g = ctx.createLinearGradient(x0, y, x1, y);
    g.addColorStop(0, a); if (c) { g.addColorStop(0.5, b); g.addColorStop(1, c); } else g.addColorStop(1, b);
    return g;
  }
  function orb(cx, cy, r, lit, mid, dark) {
    const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.42, r * 0.08, cx, cy, r * 1.06);
    g.addColorStop(0, lit); g.addColorStop(0.55, mid); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  }
  // soleil en haut-gauche -> ombre projetée vers le bas-droite
  function castShadow(wx, wy, len, wid) {
    const x = wx - cam.x + len * 0.4, y = wy - cam.y + wid * 0.5;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, 0.4);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
    g.addColorStop(0, "rgba(24,28,36,.26)"); g.addColorStop(0.6, "rgba(24,28,36,.1)"); g.addColorStop(1, "rgba(24,28,36,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, len, 0, 7); ctx.fill();
    ctx.restore();
  }
  function blade(bx, by, h, ph, lit) {
    const s = Math.sin(time * 0.05 + ph) * (0.6 + h * 0.1);
    ctx.strokeStyle = lit ? "rgba(160,180,110,.55)" : "rgba(74,92,45,.5)";
    ctx.lineWidth = 0.8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + s * 0.5, by - h * 0.6, bx + s, by - h); ctx.stroke();
  }

  function drawTile(c, sx, sy) {
    // positions sous-pixel (pas d'arrondi) — le +1 px de recouvrement évite les coutures entre tuiles
    const X = sx * TILE - cam.x, Y = sy * TILE - cam.y, T1 = TILE + 1;
    if (map.floor) {
      ctx.fillStyle = ((sx + sy) & 1) ? COL.floor : COL.floor2;
      ctx.fillRect(X, Y, T1, T1);
      if (((sx * 13 + sy * 7) % 6) === 0) { ctx.fillStyle = "rgba(20,16,12,.35)"; ctx.beginPath(); ctx.ellipse(X + 8, Y + 9, 6, 4, 0, 0, 7); ctx.fill(); }
    } else {
      ctx.fillStyle = ((sx + sy) & 1) ? COL.grass : COL.grass2;
      ctx.fillRect(X, Y, T1, T1);
      const m = (sx * 13 + sy * 7) % 11;
      if (m === 0 || m === 4) { ctx.fillStyle = "rgba(52,64,32,.2)"; ctx.beginPath(); ctx.ellipse(X + 6 + (m & 3), Y + 8, 11, 6, 0, 0, 7); ctx.fill(); }
      else if (m === 7) { ctx.fillStyle = "rgba(150,165,95,.14)"; ctx.beginPath(); ctx.ellipse(X + 9, Y + 7, 9, 5, 0, 0, 7); ctx.fill(); }
      if (c === "." && ((sx * 7 + sy * 11) % 6) === 0) { blade(X + 5, Y + 13, 4, sx + sy, true); blade(X + 10, Y + 14, 5, sx * 2, false); }
    }
    switch (c) {
      case "=":
      case "x":
        ctx.fillStyle = COL.path2; ctx.fillRect(X, Y, T1, T1);
        ctx.fillStyle = COL.path; ctx.fillRect(X, Y + 2, T1, TILE - 5);
        ctx.fillStyle = "rgba(226,196,140,.16)"; ctx.fillRect(X, Y + 5, TILE, 4);
        ctx.fillStyle = COL.pathDark;
        if ((sx + sy) % 3 === 0) { ctx.beginPath(); ctx.arc(X + 4, Y + 6, 1.4, 0, 7); ctx.fill(); }
        if ((sx * 2 + sy) % 4 === 0) { ctx.beginPath(); ctx.arc(X + 11, Y + 11, 1.6, 0, 7); ctx.fill(); }
        if (c === "x") { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.ellipse(X + 8, Y + 8, 6, 6, 0, 0, 7); ctx.fill(); }
        break;
      case ",":
        ctx.fillStyle = COL.grassRim; blade(X + 4, Y + 13, 5, sx, true); blade(X + 12, Y + 12, 5, sy, true);
        for (const f of [[5, 6], [11, 10], [8, 13]]) {
          ctx.save(); ctx.globalCompositeOperation = "screen";
          const g = ctx.createRadialGradient(X + f[0], Y + f[1], 0, X + f[0], Y + f[1], 4);
          g.addColorStop(0, "rgba(255,244,210,.5)"); g.addColorStop(1, "rgba(255,244,210,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X + f[0], Y + f[1], 4, 0, 7); ctx.fill(); ctx.restore();
          ctx.fillStyle = COL.flower; ctx.beginPath(); ctx.arc(X + f[0], Y + f[1], 1.3, 0, 7); ctx.fill();
        }
        break;
      case "~":
        for (let i = 0; i < 4; i++) blade(X + 2 + i * 4, Y + 15, 8 + (i % 2) * 3, sx * 3 + i, i % 2 === 0);
        break;
      case "w": {
        const o = Math.sin((time * 0.04) + (sx + sy)) * 1.6;
        ctx.fillStyle = COL.water; ctx.fillRect(X, Y, T1, T1);
        ctx.fillStyle = COL.water2; ctx.fillRect(X, Y, T1, 4);
        ctx.strokeStyle = "rgba(205,216,207,.4)"; ctx.lineWidth = 1; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(X + 2 + o, Y + 5); ctx.lineTo(X + 8 + o, Y + 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X + 7 - o, Y + 11); ctx.lineTo(X + 13 - o, Y + 11); ctx.stroke();
        break;
      }
      case "#":
        ctx.fillStyle = COL.wallDark; ctx.fillRect(X, Y, T1, T1);
        ctx.fillStyle = COL.wall; ctx.fillRect(X, Y, T1, TILE - 4);
        ctx.fillStyle = COL.wallTop; ctx.fillRect(X, Y, T1, 3);
        ctx.strokeStyle = "rgba(20,18,14,.22)"; ctx.beginPath(); ctx.moveTo(X + 8, Y + 3); ctx.lineTo(X + 8, Y + TILE); ctx.stroke();
        break;
      case "^":
        if (map.floor) { ctx.fillStyle = COL.floorDark; ctx.fillRect(X, Y, TILE, TILE); }
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.beginPath(); ctx.ellipse(X + 8, Y + 8, 6, 6, 0, 0, 7); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = "screen";
        { const g = ctx.createRadialGradient(X + 8, Y + 8, 0, X + 8, Y + 8, 9); g.addColorStop(0, "rgba(255,180,110,.3)"); g.addColorStop(1, "rgba(255,180,110,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X + 8, Y + 8, 9, 0, 7); ctx.fill(); }
        ctx.restore();
        break;
      case "K":
        ctx.fillStyle = "#242028"; ctx.fillRect(X, Y, T1, T1);
        ctx.fillStyle = "#38343c"; ctx.fillRect(X, Y, T1, TILE - 4);
        ctx.fillStyle = "#4c4850"; ctx.fillRect(X, Y, T1, 2);
        break;
      case "u": // tapis (teinte textile, jamais rouge sang)
        ctx.fillStyle = "#4c5460"; roundRectP(X + 0.5, Y + 0.5, TILE, TILE, 3); ctx.fill();
        ctx.fillStyle = "rgba(224,210,180,.20)";
        ctx.fillRect(X + 2, Y + 2, TILE - 3, 1.2); ctx.fillRect(X + 2, Y + TILE - 3, TILE - 3, 1.2);
        ctx.fillStyle = "rgba(200,140,90,.20)"; ctx.fillRect(X + TILE / 2 - 0.6, Y + 2, 1.2, TILE - 4);
        break;
    }
  }

  // --------- bâtiment complet (mur crépi + colombages, toit, cheminée qui fume, fenêtres éclairées)
  const ROOFS = {
    bakery:   ["#c39a58", "#7a5626", "#eddaa6"],
    manor:    ["#8a5f7c", "#4a2f45", "#caa9bf"],
    cottage:  ["#b0704a", "#743b28", "#e0b48a"],
    cottage2: ["#9a7050", "#5a3826", "#d6b088"],
    shop:     ["#6f8a6a", "#3e5440", "#b6c9ae"],
  };
  function drawBuilding(b) {
    const X = b.x * TILE - cam.x, Y = b.y * TILE - cam.y;
    const W = b.w * TILE, H = b.h * TILE;
    const tall = b.kind === "manor";
    const roofH = tall ? 21 : 13;
    const [rMid, rDark, rRim] = ROOFS[b.kind] || ROOFS.cottage;

    castShadow(b.x * TILE + W / 2, b.y * TILE + H + 3, W * 0.52, 8);

    // --- corps
    ctx.fillStyle = "#5f4a37";
    roundRectP(X, Y + roofH - 7, W, H - roofH + 8, 3); ctx.fill();
    ctx.fillStyle = lgV(X, Y + roofH, Y + H, "#d0c3a8", "#a4917a");
    roundRectP(X + 1.5, Y + roofH - 5, W - 3, H - roofH + 4, 2); ctx.fill();
    // colombages
    ctx.strokeStyle = "rgba(58,40,26,.45)"; ctx.lineWidth = 1.5;
    for (let i = 1; i < b.w; i++) { ctx.beginPath(); ctx.moveTo(X + i * TILE, Y + roofH - 3); ctx.lineTo(X + i * TILE, Y + H - 1); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(X + 2, Y + H - TILE + 1); ctx.lineTo(X + W - 2, Y + H - TILE + 1); ctx.stroke();

    // --- fenêtres éclairées à l'aube
    const glow = 0.42 + 0.18 * Math.sin(time * 0.05 + b.x);
    const cols = b.w >= 4 ? [0.55, b.w - 1.55] : [b.w / 2 - 0.5];
    for (const wc of cols) {
      const fx = X + wc * TILE + 3, fy = Y + roofH + 3;
      ctx.save(); ctx.globalCompositeOperation = "screen";
      const gg = ctx.createRadialGradient(fx + 4, fy + 4, 0, fx + 4, fy + 4, 13);
      gg.addColorStop(0, "rgba(255,196,110," + glow + ")"); gg.addColorStop(1, "rgba(255,196,110,0)");
      ctx.fillStyle = gg; ctx.fillRect(fx - 7, fy - 7, 22, 22); ctx.restore();
      ctx.fillStyle = "#2f2114"; roundRectP(fx - 1, fy - 1, 10, 11, 2); ctx.fill();
      ctx.fillStyle = "rgba(255,214,150,.92)"; roundRectP(fx, fy, 8, 9, 1.5); ctx.fill();
      ctx.strokeStyle = "rgba(40,28,16,.7)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fx + 4, fy); ctx.lineTo(fx + 4, fy + 9); ctx.moveTo(fx, fy + 4.5); ctx.lineTo(fx + 8, fy + 4.5); ctx.stroke();
    }

    // --- porte
    const dxp = X + (b.door.x - b.x) * TILE, dyp = Y + H - TILE - 1;
    ctx.fillStyle = "#3a2616";
    ctx.beginPath();
    ctx.moveTo(dxp + 3, dyp + TILE + 1); ctx.lineTo(dxp + 3, dyp + 5);
    ctx.arc(dxp + 8, dyp + 5, 5, Math.PI, 0); ctx.lineTo(dxp + 13, dyp + TILE + 1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#5a3f26"; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(dxp + 4, dyp + 4 + i * 4); ctx.lineTo(dxp + 12, dyp + 4 + i * 4); ctx.stroke(); }
    ctx.fillStyle = "#e8c878"; ctx.beginPath(); ctx.arc(dxp + 11, dyp + 9, 0.9, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(150,140,120,.5)"; roundRectP(dxp + 1, dyp + TILE, 14, 3, 1); ctx.fill();

    // --- toit
    if (tall) {
      ctx.fillStyle = rDark;
      ctx.beginPath(); ctx.moveTo(X - 5, Y + roofH); ctx.lineTo(X + W / 2, Y - 7); ctx.lineTo(X + W + 5, Y + roofH); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lgV(X, Y - 4, Y + roofH, rRim, rMid);
      ctx.beginPath(); ctx.moveTo(X - 2, Y + roofH - 2); ctx.lineTo(X + W / 2, Y - 3); ctx.lineTo(X + W + 2, Y + roofH - 2); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = rDark; roundRectP(X - 4, Y - 3, W + 8, roofH + 3, 3); ctx.fill();
      ctx.fillStyle = lgV(X, Y - 3, Y + roofH, rRim, rMid); roundRectP(X - 3, Y - 2, W + 6, roofH, 3); ctx.fill();
    }
    ctx.fillStyle = rRim; ctx.fillRect(X - 3, Y - (tall ? 3 : 2), W + 6, 1.6);
    ctx.strokeStyle = "rgba(40,24,16,.16)"; ctx.lineWidth = 1;
    for (let r = 5; r < roofH; r += 4.5) { ctx.beginPath(); ctx.moveTo(X - 2, Y + r); ctx.lineTo(X + W + 2, Y + r); ctx.stroke(); }

    // --- cheminée + fumée
    const chx = X + W - 11, chy = Y + (tall ? 1 : -3);
    ctx.fillStyle = "#544435"; ctx.fillRect(chx, chy, 6, 11);
    ctx.fillStyle = "#6a5848"; ctx.fillRect(chx, chy, 6, 2);
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 4; i++) {
      const t2 = (time * 0.4 + i * 22) % 88;
      const sy = chy - t2 * 0.55, sxx = chx + 3 + Math.sin((t2 + i * 30) * 0.06) * 5;
      const a = Math.max(0, 0.15 * (1 - t2 / 88));
      ctx.fillStyle = "rgba(224,218,208," + a + ")";
      ctx.beginPath(); ctx.arc(sxx, sy, 2.4 + t2 * 0.06, 0, 7); ctx.fill();
    }
    ctx.restore();

    // --- enseigne bois pour l'échoppe / la boulangerie
    if (b.kind === "shop" || b.kind === "bakery") {
      const sgx = dxp + 21, sgy = dyp - 3;
      ctx.strokeStyle = "#3a2a18"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sgx, dyp - 9); ctx.lineTo(sgx, sgy + 9); ctx.stroke();
      ctx.fillStyle = lgV(sgx, sgy, sgy + 9, "#8a6a3e", "#5c3c22");
      roundRectP(sgx - 10, sgy, 10, 9, 1.5); ctx.fill();
      ctx.fillStyle = b.kind === "shop" ? "#e0b34a" : "#ecd6a2";
      ctx.font = "700 6px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b.kind === "shop" ? "$" : "P", sgx - 5, sgy + 5);
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    }
  }

  function drawTable(sx, sy) {
    const X = sx * TILE - cam.x, Y = sy * TILE - cam.y;
    castShadow(sx * TILE + 8, sy * TILE + 13, 9, 4);
    ctx.fillStyle = "#3a2a18"; ctx.fillRect(X + 2, Y + 9, 2, 6); ctx.fillRect(X + TILE - 4, Y + 9, 2, 6);
    ctx.fillStyle = lgV(X, Y + 3, Y + 11, "#8a6a3e", "#5c3c22");
    roundRectP(X + 1, Y + 3, TILE - 2, 7, 2); ctx.fill();
    ctx.fillStyle = "rgba(255,224,170,.16)"; ctx.fillRect(X + 1, Y + 3, TILE - 2, 2);
  }
  function drawBed(sx, sy) {
    const X = sx * TILE - cam.x, Y = sy * TILE - cam.y;
    castShadow(sx * TILE + 8, sy * TILE + 14, 9, 4);
    ctx.fillStyle = "#4a3722"; ctx.fillRect(X + 2, Y + TILE - 3, 2, 3); ctx.fillRect(X + TILE - 4, Y + TILE - 3, 2, 3);
    ctx.fillStyle = "#5a4126"; roundRectP(X + 1, Y + 2, TILE - 2, TILE - 4, 2); ctx.fill();
    ctx.fillStyle = "#f2ead6"; roundRectP(X + 2.5, Y + 3, TILE - 6, 4, 1.5); ctx.fill();          // oreiller
    ctx.fillStyle = "#7c3d38"; roundRectP(X + 1.5, Y + 8, TILE - 3, TILE - 11, 2); ctx.fill();     // couverture
  }
  function drawShelf(sx, sy) {
    const X = sx * TILE - cam.x, Y = sy * TILE - cam.y;
    ctx.fillStyle = "#4a3722"; ctx.fillRect(X + 1, Y - 1, TILE - 2, TILE + 1);
    ctx.fillStyle = "#5f4529"; ctx.fillRect(X + 1, Y - 1, TILE - 2, 1.5);
    const pal = ["#7c3d38", "#3c5a7a", "#5e7a3e", "#8a6a3e"];
    for (let r = 0; r < 3; r++) {
      const ry = Y + 3 + r * 4;
      ctx.fillStyle = "#2e2013"; ctx.fillRect(X + 1, ry, TILE - 2, 1);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = pal[(r + i) & 3]; ctx.fillRect(X + 2 + i * 3, ry - 2.6, 2.2, 2.6); }
    }
  }
  function drawBarrel(sx, sy) {
    const X = sx * TILE - cam.x, Y = sy * TILE - cam.y;
    castShadow(sx * TILE + 8, sy * TILE + 13, 7, 3);
    ctx.fillStyle = lgH(X + 3, X + TILE - 3, Y, "#8a6a3e", "#5c3c22");
    roundRectP(X + 3, Y + 2, TILE - 6, TILE - 3, 3); ctx.fill();
    ctx.strokeStyle = "rgba(40,28,16,.6)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X + 3, Y + 6); ctx.lineTo(X + TILE - 3, Y + 6); ctx.moveTo(X + 3, Y + 11); ctx.lineTo(X + TILE - 3, Y + 11); ctx.stroke();
    ctx.fillStyle = "rgba(255,224,170,.14)"; ctx.fillRect(X + 4.5, Y + 2, 2, TILE - 3);
  }
  function drawHearth(sx, sy) {
    const X = sx * TILE - cam.x, Y = sy * TILE - cam.y;
    ctx.fillStyle = COL.stoneDark; roundRectP(X, Y, TILE, TILE, 2); ctx.fill();
    ctx.fillStyle = COL.stone; ctx.fillRect(X + 1, Y + 1, TILE - 2, 3);
    ctx.fillStyle = "#160f08"; roundRectP(X + 3, Y + 4, TILE - 6, TILE - 5, 2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const fl = 0.65 + 0.3 * Math.sin(time * 0.3 + sx);
    const g = ctx.createRadialGradient(X + 8, Y + 10, 0, X + 8, Y + 10, 11);
    g.addColorStop(0, "rgba(255,182,92," + fl + ")"); g.addColorStop(0.5, "rgba(255,120,50,.3)"); g.addColorStop(1, "rgba(255,120,50,0)");
    ctx.fillStyle = g; ctx.fillRect(X - 5, Y - 5, TILE + 10, TILE + 10);
    ctx.restore();
    ctx.fillStyle = "#ffb347";
    for (let i = 0; i < 3; i++) {
      const fx = X + 5 + i * 3, h = 4 + Math.sin(time * 0.4 + i * 2) * 2 + (i % 2) * 2;
      ctx.beginPath(); ctx.moveTo(fx, Y + 13); ctx.quadraticCurveTo(fx + 1, Y + 13 - h, fx + 2, Y + 13); ctx.fill();
    }
  }

  const footDust = [];
  let lastStepSign = 0;

  function drawKnight() {
    // éclair rouge quand on encaisse : 2 pulses, le chevalier reste visible
    const ifr = player.iframe;
    const hurtTint = (ifr > 44 || (ifr <= 39 && ifr > 34));

    const d = player.dir;
    const g = player.gait;                                  // 0..1 (marche enclenchée)
    const idle = g < 0.12;
    const wc = player.anim * 1.25;                          // phase de foulée
    const swing = Math.sin(wc) * g;                         // -1..1 * gait
    const bounce = Math.abs(Math.sin(wc)) * g;              // 0..1 (2 rebonds/cycle)
    const breathe = (idle && player.attack <= 0) ? Math.sin(time * 0.06) : 0;
    const atk = player.attack;
    const dv = DIRV[player.attackDir];

    // coup d'épée : préparation (recul, courte) -> frappe -> suivi
    let atkP = 0, lunge = 0;
    if (atk > 0) {
      atkP = 1 - atk / 12;
      lunge = atkP < 0.12 ? -atkP * 4
        : atkP < 0.6 ? -0.5 + (atkP - 0.12) / 0.48 * 5
        : 4.5 - (atkP - 0.6) / 0.4 * 3;
    }

    const x = px(player.x) + (atk > 0 ? dv.x * lunge * 0.6 : 0);
    const y = py(player.y) + (atk > 0 ? dv.y * lunge * 0.6 : 0);

    castShadow(player.x, player.y + 5, 9, 4);

    // ---- poussière sous les pieds (un souffle par pas)
    if (g > 0.35 && state === "play") {
      const sign = swing >= 0 ? 1 : -1;
      if (sign !== lastStepSign) {
        lastStepSign = sign;
        const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
        const dirt = map.g[ty] && (map.g[ty][tx] === "=" || map.g[ty][tx] === "x");
        footDust.push({ wx: player.x - 2 + Math.random() * 4, wy: player.y + 5, t: 0, life: 20, dirt: !!dirt });
      }
    }
    for (let i = footDust.length - 1; i >= 0; i--) {
      const p = footDust[i]; p.t++;
      if (p.t >= p.life) { footDust.splice(i, 1); continue; }
      const k = p.t / p.life, r = 1.4 + k * 3.8;
      ctx.fillStyle = (p.dirt ? "rgba(196,174,136," : "rgba(150,166,110,") + (0.3 * (1 - k)) + ")";
      ctx.beginPath(); ctx.ellipse(px(p.wx), py(p.wy) - k * 3, r, r * 0.5, 0, 0, 7); ctx.fill();
    }

    // ---- repère : roulis + léger penché dans la direction
    ctx.save();
    const pvx = x, pvy = y + 6;
    ctx.translate(pvx, pvy);
    const lean = (d === "left" ? -0.05 : d === "right" ? 0.05 : d === "up" ? -0.02 : 0.02) * g;
    ctx.rotate(swing * 0.05 + lean);
    ctx.translate(-pvx, -pvy);

    const bob = idle ? breathe * 0.5 : -bounce * 1.8;
    const yy = y + bob;
    const sideAxis = (d === "left" || d === "right");
    const backX = { left: 1, right: -1, up: 0, down: 0 }[d];
    const backYd = { up: 1, down: -1, left: 0, right: 0 }[d];

    // ---- jambes (grande foulée)
    ctx.fillStyle = "#41372a";
    if (sideAxis) {
      const f = swing * 3.3, b = -swing * 3.3;
      ctx.save(); ctx.translate(x + f, y + 3 - Math.max(0, swing) * 1.6); roundRectP(-1.6, 0, 3.2, 6, 1.4); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(x + b, y + 3 - Math.max(0, -swing) * 1.6); roundRectP(-1.6, 0, 3.2, 6, 1.4); ctx.fill(); ctx.restore();
    } else {
      const l1 = swing * 2.7, l2 = -swing * 2.7;
      ctx.save(); ctx.translate(x - 3 + swing * 0.6, y + 3 + l1); roundRectP(-1.5, 0, 3, 6, 1.4); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(x + 3 + swing * 0.6, y + 3 + l2); roundRectP(-1.5, 0, 3, 6, 1.4); ctx.fill(); ctx.restore();
    }

    // ---- cape qui flotte
    const flow = (g * 3.6) + Math.sin(time * 0.18 + wc) * (0.7 + g * 1.4);
    if (d !== "down" || g > 0.1) {
      ctx.fillStyle = "#7c3d38";
      const cbx = x + backX * flow, cby = yy + 7 + Math.max(0, backYd) * flow;
      ctx.beginPath();
      ctx.moveTo(x - 4, yy - 6);
      ctx.quadraticCurveTo(x - 7 + backX * 2, yy + 1, cbx - 3, cby);
      ctx.lineTo(cbx + 3, cby);
      ctx.quadraticCurveTo(x + 7 + backX * 2, yy + 1, x + 4, yy - 6);
      ctx.closePath(); ctx.fill();
    }

    // ---- torse + plastron
    ctx.fillStyle = lgH(x - 5, x + 5, yy, "#4c72a6", "#33578f", "#22406c");
    roundRectP(x - 5, yy - 6, 10, 11, 3); ctx.fill();
    ctx.fillStyle = COL.woodDark; ctx.fillRect(x - 5, yy + 1, 10, 1.5);
    ctx.fillStyle = lgH(x - 4, x + 4, yy, COL.steelLit, COL.steel, COL.steelDark);
    ctx.beginPath(); ctx.moveTo(x - 4, yy - 6); ctx.lineTo(x + 4, yy - 6); ctx.lineTo(x + 3, yy - 1); ctx.lineTo(x, yy + 1); ctx.lineTo(x - 3, yy - 1); ctx.closePath(); ctx.fill();

    // ---- épaules qui balancent (opposition aux jambes)
    const shR = swing * 1.4;
    orb(x - 5, yy - 6 - shR, 2.4, COL.steelLit, COL.steel, COL.steelDark);
    orb(x + 5, yy - 6 + shR, 2.4, COL.steelLit, COL.steel, COL.steelDark);

    // ---- tête : visage lisible selon la direction du regard
    const hx = x - swing * 0.6;
    const hy = yy - 10.5;
    const HR = 3.7;

    // panache, derrière la tête, penché à l'opposé du regard
    const plLean = d === "left" ? 1.6 : d === "right" ? -1.6 : 0;
    const plx = hx + 1 - backX * g * 2 + Math.sin(time * 0.2 + wc) * (0.7 + g * 1.4) + swing * 1.1 + plLean;
    ctx.fillStyle = lgV(hx, hy - 8, hy - 1, "#c85742", "#7c2f26");
    ctx.beginPath();
    ctx.moveTo(hx - 1.4, hy - 3.4);
    ctx.quadraticCurveTo(plx + 4, hy - 9, plx, hy + 0.5);
    ctx.quadraticCurveTo(hx + 1.3, hy - 1.8, hx - 1.4, hy - 3.4);
    ctx.fill();

    if (d === "up") {
      // dos du heaume : acier plein, gorgerin, aucun visage
      orb(hx, hy - 0.2, HR + 0.2, COL.steelLit, COL.steel, COL.steelDark);
      ctx.strokeStyle = "rgba(40,44,50,.55)"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(hx - HR + 0.4, hy - 0.6); ctx.quadraticCurveTo(hx, hy + 0.8, hx + HR - 0.4, hy - 0.6); ctx.stroke();
      ctx.fillStyle = COL.steelLit;
      ctx.beginPath(); ctx.arc(hx - 1.7, hy - 1.7, 0.5, 0, 7); ctx.arc(hx + 1.7, hy - 1.7, 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#5a5f66";
      ctx.beginPath(); ctx.ellipse(hx, hy + HR - 0.6, HR - 0.6, 1.7, 0, 0, Math.PI); ctx.fill();
    } else {
      const s2 = d === "left" ? -1 : d === "right" ? 1 : 0;
      // visage (peau)
      orb(hx, hy, HR, "#f5d3a7", COL.skin, "#a97e52");
      // nez qui dépasse (profil)
      if (s2) {
        ctx.fillStyle = "#eabd8b";
        ctx.beginPath();
        ctx.moveTo(hx + s2 * (HR - 1), hy - 0.2);
        ctx.lineTo(hx + s2 * (HR + 1.3), hy + 0.9);
        ctx.lineTo(hx + s2 * (HR - 1), hy + 2);
        ctx.closePath(); ctx.fill();
      }
      // calotte du heaume (haut de la tête seulement -> le visage reste dégagé)
      ctx.fillStyle = lgV(hx, hy - HR, hy, COL.steelLit, COL.steel, COL.steelDark);
      ctx.beginPath();
      ctx.arc(hx, hy, HR, Math.PI, 0);
      ctx.lineTo(hx + HR, hy - 0.4);
      ctx.lineTo(hx - HR, hy - 0.4);
      ctx.closePath(); ctx.fill();
      if (s2) orb(hx - s2 * 1.8, hy + 0.2, HR * 0.78, COL.steelLit, COL.steel, COL.steelDark); // arrière du crâne
      else { ctx.fillStyle = COL.steel; ctx.fillRect(hx - 0.7, hy - 0.5, 1.4, 2.7); } // protège-nez
      // ombre du rebord sur le front
      ctx.fillStyle = "rgba(48,32,16,.3)";
      ctx.fillRect(hx - HR + 0.5, hy - 0.5, HR * 2 - 1, 0.9);
      // yeux
      ctx.fillStyle = "#20140c";
      if (s2) ctx.fillRect(hx + s2 * 1.15 - 0.6, hy + 0.15, 1.2, 1.6);
      else { ctx.fillRect(hx - 2.1, hy + 0.25, 1.2, 1.6); ctx.fillRect(hx + 0.9, hy + 0.25, 1.2, 1.6); }
      // reflets
      ctx.fillStyle = "rgba(255,255,255,.6)";
      if (s2) ctx.fillRect(hx + s2 * 1.15 - 0.5, hy + 0.3, 0.45, 0.45);
      else { ctx.fillRect(hx - 2, hy + 0.4, 0.5, 0.5); ctx.fillRect(hx + 1, hy + 0.4, 0.5, 0.5); }
      // bouche
      ctx.strokeStyle = "rgba(95,55,38,.45)"; ctx.lineWidth = 0.7;
      ctx.beginPath();
      if (s2) { ctx.moveTo(hx + s2 * 0.5, hy + 2.6); ctx.lineTo(hx + s2 * 2, hy + 2.2); }
      else { ctx.moveTo(hx - 1, hy + 2.9); ctx.lineTo(hx + 1, hy + 2.9); }
      ctx.stroke();
    }

    // ---- rim light
    ctx.strokeStyle = "rgba(255,224,165,.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x - 1, yy - 2, 7, -2.5, -0.5); ctx.stroke();

    // ---- épée
    if (atk > 0) {
      const a0 = -2.3, a1 = 1.15;
      const sweep = atkP < 0.12 ? a0 - atkP * 1.2
        : atkP < 0.64 ? a0 + (atkP - 0.12) / 0.52 * (a1 - a0)
        : a1 + (atkP - 0.64) * 0.6;
      const baseAng = Math.atan2(dv.y, dv.x);
      const len = player.sword ? 15 : 12;
      const hxp = x + dv.x * 3, hyp = yy + dv.y * 3 - 1;
      if (atkP > 0.14 && atkP < 0.8) {
        ctx.strokeStyle = "rgba(255,248,224," + (0.55 * (1 - Math.abs(atkP - 0.5) * 2)) + ")";
        ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.arc(hxp, hyp, len, baseAng + a0, baseAng + sweep, false); ctx.stroke();
      }
      ctx.save(); ctx.translate(hxp, hyp); ctx.rotate(baseAng + sweep);
      ctx.fillStyle = lgH(0, len, 0, "#eef1f5", "#c2c8d0", "#8b929c");
      roundRectP(0, -1.6, len, 3.2, 1.4); ctx.fill();
      ctx.fillStyle = "#b98f45"; roundRectP(-2, -2.4, 4, 4.8, 1.4); ctx.fill();
      ctx.restore();
    } else {
      const sb = bounce * 1.4;
      ctx.save();
      const sx2 = (d === "left" ? x - 5 : x + 5);
      ctx.translate(sx2, yy - 2 + sb);
      ctx.rotate(swing * 0.12 + (d === "left" ? 0.16 : -0.16));
      ctx.fillStyle = lgV(0, -3, 6, COL.steelLit, "#8b929c");
      roundRectP(-1, -3, 2, 9, 1); ctx.fill();
      ctx.fillStyle = "#b98f45"; roundRectP(-1.6, -3.6, 3.2, 1.8, 0.8); ctx.fill();
      ctx.restore();
    }

    // ---- éclair rouge d'encaissement (par-dessus, translucide -> le perso reste visible)
    if (hurtTint) {
      ctx.fillStyle = "rgba(255,64,50,0.5)";
      roundRectP(x - 6, yy - 8, 12, 17, 5); ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy - 0.5, HR + 1, 0, 7); ctx.fill();
      ctx.fillRect(x - 5, y + 2, 4, 8); ctx.fillRect(x + 1, y + 2, 4, 8);
    }

    ctx.restore(); // roulis
  }
  function roundRectP(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawEnemy(e) {
    const x = px(e.x), y = py(e.y);
    castShadow(e.x, e.y + 3, e.r + 1, e.r * 0.5);
    const hit = e.flash > 0 && (e.flash & 1);
    if (e.type === "slime") {
      const wob = Math.sin(time * 0.1 + e.x) * 1.2;
      if (hit) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x, y, 8, 6.5 - wob * 0.3, 0, 0, 7); ctx.fill(); }
      else {
        const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y + 1, 9);
        g.addColorStop(0, "rgba(160,220,150,.95)"); g.addColorStop(0.55, "rgba(95,175,90,.94)"); g.addColorStop(1, "rgba(45,110,50,.96)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 8, 6.5 - wob * 0.3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.ellipse(x - 3, y - 2.5, 2.4, 1.5, -0.5, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,232,170,.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y + 1, 7.4, 0.3, 2.6); ctx.stroke();
      }
      ctx.fillStyle = "#0f2410"; ctx.beginPath(); ctx.arc(x - 2.6, y, 1.1, 0, 7); ctx.arc(x + 2.6, y, 1.1, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x - 3, y - 0.5, 0.5, 0, 7); ctx.fill();
    } else if (e.type === "wolf") {
      const lit = hit ? "#fff" : "#9a9ea6", mid = hit ? "#fff" : "#6b6f78", dk = hit ? "#fff" : "#43464e";
      ctx.fillStyle = lgV(x, y - 4, y + 5, lit, mid, dk);
      roundRectP(x - 7, y - 4, 14, 9, 4); ctx.fill();
      const hx = e.dir === "left" ? x - 7 : x + 3;
      orb(hx + (e.dir === "left" ? -1 : 1), y - 3, 3.2, lit, mid, dk);
      ctx.fillStyle = mid;
      ctx.beginPath(); ctx.moveTo(hx + (e.dir === "left" ? -2 : 0), y - 6); ctx.lineTo(hx + (e.dir === "left" ? 0 : 2), y - 9); ctx.lineTo(hx + (e.dir === "left" ? 2 : 4), y - 6); ctx.fill();
      ctx.fillStyle = "rgba(210,214,220,.6)"; ctx.fillRect(x - 5, y + 2, 10, 2);
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(hx + (e.dir === "left" ? -1 : 3), y - 3, 0.9, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,224,165,.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y - 1, 7, -2.4, -0.6); ctx.stroke();
    } else {
      const lit = hit ? "#fff" : "#88a55e", mid = hit ? "#fff" : "#5e7a3e", dk = hit ? "#fff" : "#3c5228";
      ctx.fillStyle = lgV(x, y - 8, y + 6, lit, mid, dk);
      roundRectP(x - 9, y - 8, 18, 14, 5); ctx.fill();
      orb(x - 8, y - 6, 3.5, lit, mid, dk); orb(x + 8, y - 6, 3.5, lit, mid, dk);
      ctx.fillStyle = "#4a3722"; ctx.fillRect(x - 9, y + 3, 18, 3);
      ctx.fillStyle = "#1a120a"; ctx.beginPath(); ctx.arc(x - 3, y - 3, 1.2, 0, 7); ctx.arc(x + 3, y - 3, 1.2, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,224,165,.4)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x - 1, y - 3, 10, -2.5, -0.5); ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,.45)"; roundRectP(x - 9, y - 13, 18, 3, 1.5); ctx.fill();
      ctx.fillStyle = "#cf5b44"; roundRectP(x - 9, y - 13, 18 * Math.max(0, e.hp) / e.maxHp, 3, 1.5); ctx.fill();
    }
  }

  function drawNpc(n) {
    const x = px(n.x * TILE + TILE / 2), y = py(n.y * TILE + TILE / 2);
    castShadow(n.x * TILE + TILE / 2, n.y * TILE + TILE / 2 + 4, 8, 4);
    ctx.fillStyle = "#41372a";
    ctx.fillRect(x - 3, y + 3, 3, 5); ctx.fillRect(x + 1, y + 3, 3, 5);
    ctx.fillStyle = n.color;
    roundRectP(x - 4, y - 6, 8, 11, 3); ctx.fill();
    ctx.fillStyle = "rgba(20,20,26,.28)"; ctx.fillRect(x, y - 6, 4, 11);
    ctx.fillStyle = "rgba(255,232,180,.22)"; ctx.fillRect(x - 4, y - 6, 3, 11);
    orb(x, y - 10, 3, "#f0cda0", COL.skin, "#a97e52");
    ctx.fillStyle = n.hair; roundRectP(x - 3.5, y - 13, 7, 4, 2); ctx.fill();
    ctx.fillStyle = "#20140c"; ctx.fillRect(x - 2, y - 10, 1, 1.5); ctx.fillRect(x + 1, y - 10, 1, 1.5);
    // marqueur de quête
    let mark = null;
    for (const id of questsForNpc(n.id)) {
      const st = quest[id].state;
      if (QUESTS[id].giver === n.id && st === "available") mark = "!";
      if (QUESTS[id].turnInAt === n.id && st === "ready") { mark = "?"; break; }
    }
    if (n.shop) mark = mark || "$";
    if (mark) {
      const b = Math.sin(time * 0.12) * 1.5;
      const my = y - 18 + b;
      ctx.save(); ctx.globalCompositeOperation = "screen";
      const g = ctx.createRadialGradient(x, my, 0, x, my, 7);
      g.addColorStop(0, "rgba(255,220,150,.5)"); g.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, my, 7, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = mark === "$" ? "#a7d189" : "#f2c14e";
      ctx.font = "700 9px ui-rounded, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(mark, x, my);
      ctx.textBaseline = "alphabetic";
    }
  }

  function drawTree(sx, sy) {
    const X = sx * TILE - cam.x, Y = sy * TILE - cam.y;
    const sway = Math.sin(time * 0.028 + sx) * 1.4;
    castShadow(sx * TILE + 8, sy * TILE + 15, 15, 6);
    // tronc
    ctx.fillStyle = lgH(X + 5, X + 11, Y, "#7a5a38", COL.trunk, COL.trunkDark);
    ctx.beginPath();
    ctx.moveTo(X + 5, Y + 15); ctx.quadraticCurveTo(X + 6, Y + 7, X + 7 + sway * 0.3, Y + 2);
    ctx.lineTo(X + 10 + sway * 0.3, Y + 2); ctx.quadraticCurveTo(X + 11, Y + 8, X + 12, Y + 15); ctx.closePath(); ctx.fill();
    // canopée
    const cx = X + 8 + sway, cy = Y + 1;
    orb(cx - 5, cy, 7, "#7f9a48", COL.tree, COL.treeDark);
    orb(cx + 5, cy - 1, 6.5, "#7f9a48", COL.tree, COL.treeDark);
    orb(cx, cy - 6, 6, "#8aa552", COL.tree2, COL.treeDark);
    ctx.fillStyle = "rgba(28,42,18,.35)"; ctx.beginPath(); ctx.arc(cx + 4, cy + 3, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(200,222,140,.5)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx - 2, cy - 4, 9, -2.5, -0.4); ctx.stroke();
  }

  function drawChest(sx, sy) {
    const X = sx * TILE - cam.x, Y = sy * TILE - cam.y;
    castShadow(sx * TILE + 8, sy * TILE + 13, 9, 4);
    ctx.fillStyle = lgV(X, Y + 5, Y + 13, "#7a5a34", "#4a3320");
    ctx.fillRect(X + 2, Y + 5, 12, 8);
    ctx.fillStyle = lgV(X, Y + (world.chestOpened ? 1 : 3), Y + 8, "#8a6a3e", "#5c3c22");
    ctx.fillRect(X + 2, Y + (world.chestOpened ? 1 : 3), 12, world.chestOpened ? 3 : 4);
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const g = ctx.createRadialGradient(X + 8, Y + 8, 0, X + 8, Y + 8, 6);
    g.addColorStop(0, "rgba(240,200,120,.4)"); g.addColorStop(1, "rgba(240,200,120,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X + 8, Y + 8, 6, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = world.chestOpened ? "#1c1710" : "#e0b34a";
    if (world.chestOpened) ctx.fillRect(X + 4, Y + 5, 8, 4);
    else { ctx.fillRect(X + 7, Y + 7, 2, 3); ctx.fillStyle = "#fff6d8"; ctx.fillRect(X + 7, Y + 7, 1, 1); }
  }

  function drawSign(sx, sy) {
    const X = sx * TILE - cam.x, Y = sy * TILE - cam.y;
    castShadow(sx * TILE + 8, sy * TILE + 14, 7, 3);
    ctx.fillStyle = lgH(X + 6, X + 10, Y, "#8a6a3e", COL.woodDark, "#2e2013");
    ctx.fillRect(X + 7, Y + 6, 2, 9);
    ctx.fillStyle = lgV(X, Y + 2, Y + 9, "#8a6a3e", COL.wood, COL.woodDark);
    ctx.fillRect(X + 2, Y + 2, 12, 7);
    ctx.strokeStyle = "rgba(30,20,12,.4)"; ctx.strokeRect(X + 2.5, Y + 2.5, 11, 6);
    ctx.strokeStyle = "rgba(255,230,190,.25)"; ctx.beginPath(); ctx.moveTo(X + 3, Y + 3.5); ctx.lineTo(X + 13, Y + 3.5); ctx.stroke();
  }

  // puits complet (2x2) depuis sa case supérieure-gauche
  function drawWell(sx, sy) {
    const X = sx * TILE - cam.x, Y = sy * TILE - cam.y, cx = X + TILE, cy = Y + TILE;
    castShadow(sx * TILE + TILE, sy * TILE + TILE + 8, 18, 7);
    // margelle
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.68); ctx.translate(-cx, -cy);
    orb(cx, cy, 15, "#bdb49c", COL.stone, COL.stoneDark);
    ctx.fillStyle = "#231f1a"; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 7); ctx.fill();
    ctx.fillStyle = lgV(cx, cy - 8, cy + 10, "#3a372f", "#0e0d0b"); ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(90,150,170,.5)"; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 5, 3, 0, 0, 7); ctx.fill();
    ctx.restore();
    // poteaux + toit
    ctx.fillStyle = lgH(X + 3, X + 7, Y, "#7a5a38", COL.wood, COL.woodDark); ctx.fillRect(X + 3, Y - 6, 4, TILE * 2 - 10);
    ctx.fillStyle = lgH(X + TILE * 2 - 7, X + TILE * 2 - 3, Y, "#7a5a38", COL.wood, COL.woodDark); ctx.fillRect(X + TILE * 2 - 7, Y - 6, 4, TILE * 2 - 10);
    ctx.fillStyle = lgV(cx, Y - 13, Y - 2, COL.roofRim, COL.roof, COL.roofDark);
    ctx.beginPath();
    ctx.moveTo(X - 3, Y - 3); ctx.quadraticCurveTo(cx, Y - 15, X + TILE * 2 + 3, Y - 3);
    ctx.quadraticCurveTo(cx, Y - 7, X - 3, Y - 3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,230,195,.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X - 1, Y - 3.5); ctx.quadraticCurveTo(cx, Y - 13, X + TILE * 2 + 1, Y - 3.5); ctx.stroke();
  }

  function drawPickup(p) {
    const x = px(p.x), y = py(p.y) - Math.min(4, p.t * 0.4);
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
    g.addColorStop(0, p.kind === "heart" ? "rgba(255,120,140,.4)" : "rgba(255,225,150,.45)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
    ctx.restore();
    if (p.kind === "coin") {
      orb(x, y, 3, "#ffe9b0", "#f2c14e", "#b98a2f");
      ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.beginPath(); ctx.arc(x - 1, y - 1, 0.8, 0, 7); ctx.fill();
    } else if (p.kind === "heart") {
      orb(x - 2, y - 1, 2.4, "#ff9aa8", "#e8455f", "#a5293c");
      orb(x + 2, y - 1, 2.4, "#ff9aa8", "#e8455f", "#a5293c");
      ctx.fillStyle = "#c33448"; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(x - 2.5, y - 1.6, 0.7, 0, 7); ctx.fill();
    } else if (p.kind === "key") {
      ctx.fillStyle = lgV(x, y - 4, y + 3, "#f2e0a0", "#b58f45");
      ctx.fillRect(x - 1, y - 4, 2, 7); ctx.fillRect(x - 3, y - 4, 6, 2); ctx.fillRect(x + 1, y + 1, 3, 2);
      ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(x - 2, y - 3.5, 1, 1);
    }
  }

  // fondu d'ambiance selon la position : village doré au nord -> forêt fraîche au sud
  function ambiance() {
    if (mapId === "grotte") return ZONE.grotte;
    if (map.interior) return ZONE.interieur;
    const fy = (map.forestY || 21) * TILE;
    const f = Math.max(0, Math.min(1, (player.y - fy + 70) / 150));
    const a = AMB.village, b = AMB.foret;
    const m = a.map((v, i) => v + (b[i] - v) * f);
    return {
      tint: "rgba(" + (m[0] | 0) + "," + (m[1] | 0) + "," + (m[2] | 0) + "," + m[3].toFixed(3) + ")",
      vig: 0.30 + 0.06 * f, shafts: true,
    };
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const Z = ambiance();
    ctx.fillStyle = map.interior ? "#211812" : map.floor ? "#191410" : "#20281a";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const x0 = Math.max(0, Math.floor(cam.x / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE));
    const x1 = Math.min(map.w - 1, Math.ceil((cam.x + VIEW_W) / TILE));
    const y1 = Math.min(map.h - 1, Math.ceil((cam.y + VIEW_H) / TILE));

    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const c = map.g[y][x];
        if (c !== "H" && c !== "R") drawTile(c, x, y);   // corps de bâtiment : dessiné à part
      }

    const list = [];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const c = map.g[y][x];
        const baseY = y * TILE + TILE;
        if (c === "T") list.push({ y: baseY - 6, d: () => drawTree(x, y) });
        else if (c === "S") list.push({ y: baseY, d: () => drawSign(x, y) });
        else if (c === "o") {
          const topLeft = map.g[y][x - 1] !== "o" && (!map.g[y - 1] || map.g[y - 1][x] !== "o");
          if (topLeft) list.push({ y: baseY + TILE, d: () => drawWell(x, y) });
        }
        else if (c === "C") list.push({ y: baseY, d: () => drawChest(x, y) });
        else if (c === "t") list.push({ y: baseY, d: () => drawTable(x, y) });
        else if (c === "b") list.push({ y: baseY, d: () => drawBed(x, y) });
        else if (c === "k") list.push({ y: baseY - 2, d: () => drawShelf(x, y) });
        else if (c === "v") list.push({ y: baseY, d: () => drawBarrel(x, y) });
        else if (c === "h") list.push({ y: y * TILE + 5, d: () => drawHearth(x, y) });
      }
    if (map.buildings) for (const b of map.buildings) {
      if ((b.x + b.w) * TILE < cam.x - 8 || b.x * TILE > cam.x + VIEW_W + 8) continue;
      list.push({ y: (b.y + b.h) * TILE, d: () => drawBuilding(b) });
    }
    for (const n of map.npcs) list.push({ y: n.y * TILE + TILE, d: () => drawNpc(n) });
    for (const e of enemies) if (!e.dead) list.push({ y: e.y, d: () => drawEnemy(e) });
    for (const p of pickups) list.push({ y: p.y, d: () => drawPickup(p) });
    list.push({ y: player.y, d: drawKnight });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.d();

    // ---- ambiance
    ctx.fillStyle = Z.tint; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (Z.torch && state !== "title") {
      const gx = px(player.x), gy = py(player.y);
      const g = ctx.createRadialGradient(gx, gy, 6, gx, gy, 95);
      g.addColorStop(0, "rgba(255,170,90,.4)"); g.addColorStop(0.5, "rgba(255,150,80,.14)"); g.addColorStop(1, "rgba(255,150,80,0)");
      ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.restore();
    }
    if (Z.hearth && map.hearthPos && state !== "title") {
      const hx2 = (map.hearthPos[0] + 0.5) * TILE - cam.x, hy2 = (map.hearthPos[1] + 0.8) * TILE - cam.y;
      const fl = 0.30 + 0.05 * Math.sin(time * 0.13);
      const g = ctx.createRadialGradient(hx2, hy2, 6, hx2, hy2, 165);
      g.addColorStop(0, "rgba(255,168,88," + fl + ")"); g.addColorStop(0.5, "rgba(255,150,80,.09)"); g.addColorStop(1, "rgba(255,150,80,0)");
      ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.restore();
    }
    if (Z.shafts) {
      ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = "rgba(255,224,160,.045)";
      for (let i = 0; i < 3; i++) {
        const ox = VIEW_W * (0.0 + i * 0.17);
        ctx.beginPath(); ctx.moveTo(ox, -10); ctx.lineTo(ox + VIEW_W * 0.08, -10);
        ctx.lineTo(ox + VIEW_W * 0.44, VIEW_H + 10); ctx.lineTo(ox + VIEW_W * 0.28, VIEW_H + 10); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 7; i++) {
      const mx = ((i * 97.3 + time * 0.3) % (VIEW_W + 20)) - 10;
      const my = ((i * 61.7 + Math.sin(time * 0.02 + i) * 6) % VIEW_H + VIEW_H) % VIEW_H;
      ctx.fillStyle = "rgba(255,238,200," + (0.07 + 0.1 * Math.abs(Math.sin(time * 0.03 + i))) + ")";
      ctx.beginPath(); ctx.arc(mx, my, 0.7, 0, 7); ctx.fill();
    }
    ctx.restore();
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.46, VIEW_H * 0.34, VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.98);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(12,10,7," + Z.vig + ")");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // flash rouge sur les bords quand on encaisse
    if (hurtFx > 0) {
      const a = Math.min(1, hurtFx / 20) * 0.62;
      const rg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.16, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.7);
      rg.addColorStop(0, "rgba(205,25,25,0)"); rg.addColorStop(0.7, "rgba(205,25,25," + a * 0.35 + ")"); rg.addColorStop(1, "rgba(200,15,15," + a + ")");
      ctx.fillStyle = rg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = "overlay";
    for (let gy = 0; gy < VIEW_H; gy += 96) for (let gx = 0; gx < VIEW_W; gx += 96) ctx.drawImage(grainCv, gx, gy);
    ctx.restore();
  }

  // ---------------------------------------------------------------- scène de l'écran-titre
  function renderTitle() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const W = VIEW_W, H = VIEW_H, t = time, hz = H * 0.56;
    // ciel d'aube
    let g = ctx.createLinearGradient(0, 0, 0, hz + 8);
    g.addColorStop(0, "#f0d59a"); g.addColorStop(0.55, "#e4ab63"); g.addColorStop(1, "#d68f56");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 8);
    // sol
    g = ctx.createLinearGradient(0, hz, 0, H);
    g.addColorStop(0, "#6f7c45"); g.addColorStop(1, "#3f4c2b");
    ctx.fillStyle = g; ctx.fillRect(0, hz, W, H - hz);
    // halo de soleil
    const sx = W * 0.5, sy = H * 0.32;
    g = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.85);
    g.addColorStop(0, "rgba(255,247,222,.8)"); g.addColorStop(.28, "rgba(255,230,180,.3)"); g.addColorStop(1, "rgba(255,230,180,0)");
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    // montagnes fondues
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const mLayers = [
      { y: hz - H * .16, a: .38, c: "#9aa39c", amp: .06, step: .30 },
      { y: hz - H * .09, a: .5, c: "#828d81", amp: .08, step: .24 },
      { y: hz - H * .02, a: .62, c: "#6f7a6c", amp: .095, step: .20 },
    ];
    for (const L of mLayers) {
      ctx.fillStyle = L.c; ctx.globalAlpha = L.a;
      ctx.beginPath(); ctx.moveTo(-20, hz + 6);
      let x = -20, py = L.y;
      while (x < W + 40) {
        const nx = x + W * L.step * (0.7 + rnd() * 0.6);
        const ny = L.y - rnd() * H * L.amp;
        ctx.quadraticCurveTo((x + nx) / 2, Math.min(py, ny) - H * L.amp * 0.4, nx, ny);
        x = nx; py = ny;
      }
      ctx.lineTo(W + 40, hz + 6); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // château au loin (silhouette)
    ctx.save();
    ctx.translate(W * 0.62, hz - 2);
    ctx.fillStyle = "rgba(44,34,24,.82)";
    ctx.fillRect(-16, -14, 12, 14);
    ctx.fillRect(-4, -22, 12, 22);
    ctx.fillRect(8, -12, 9, 12);
    for (const cx of [-16, -12, -8, -4, 0, 4, 8, 13]) ctx.fillRect(cx, (cx >= -4 && cx <= 4) ? -25 : -17, 3, 4);
    ctx.strokeStyle = "rgba(44,34,24,.82)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(2, -22); ctx.lineTo(2, -30); ctx.stroke();
    ctx.fillStyle = "rgba(140,58,52,.9)";
    ctx.beginPath(); ctx.moveTo(2, -29); ctx.lineTo(11, -26); ctx.lineTo(2, -23); ctx.closePath(); ctx.fill();
    ctx.restore();
    // voile de brume sur l'horizon
    g = ctx.createLinearGradient(0, hz - H * .07, 0, hz + H * .05);
    g.addColorStop(0, "rgba(232,214,180,0)"); g.addColorStop(1, "rgba(232,214,180,.55)");
    ctx.fillStyle = g; ctx.fillRect(0, hz - H * .07, W, H * .12);
    // nuages qui dérivent
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 3; i++) {
      const cw = 46 + i * 16;
      const cx = ((i * 150 + t * (0.1 + i * 0.03)) % (W + cw + 80)) - cw - 40;
      const cy = H * (0.1 + i * 0.06);
      ctx.fillStyle = "rgba(255,244,222,.11)";
      ctx.beginPath(); ctx.ellipse(cx, cy, cw, cw * 0.26, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + cw * 0.4, cy + 3, cw * 0.5, cw * 0.18, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
    // colline de premier plan + herbes
    g = ctx.createLinearGradient(0, H * 0.74, 0, H);
    g.addColorStop(0, "#48532e"); g.addColorStop(1, "#2c3419");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-4, H + 4);
    ctx.quadraticCurveTo(W * 0.3, H * 0.78, W * 0.55, H * 0.82);
    ctx.quadraticCurveTo(W * 0.8, H * 0.86, W + 4, H * 0.8);
    ctx.lineTo(W + 4, H + 4); ctx.closePath(); ctx.fill();
    ctx.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const gx = (i / 25) * (W + 20) - 10;
      const base = H * 0.82 + Math.sin(i * 1.7) * 6 + (i % 3) * 3;
      const len = 6 + (i % 4) * 3;
      const sway = Math.sin(t * 0.05 + i * 0.6) * 2.2;
      ctx.strokeStyle = i % 2 ? "rgba(150,168,96,.55)" : "rgba(90,110,58,.6)";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(gx, base);
      ctx.quadraticCurveTo(gx + sway * 0.5, base - len * 0.6, gx + sway, base - len);
      ctx.stroke();
    }
    // rais de lumière
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = "rgba(255,226,160,.05)";
    for (let i = 0; i < 3; i++) {
      const ox = W * (0.06 + i * 0.16);
      ctx.beginPath(); ctx.moveTo(ox, -8); ctx.lineTo(ox + W * 0.07, -8);
      ctx.lineTo(ox + W * 0.4, H + 8); ctx.lineTo(ox + W * 0.26, H + 8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // poussières
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 10; i++) {
      const mx = ((i * 89.3 + t * 0.25) % (W + 20)) - 10;
      const my = H - ((i * 53.7 + t * 0.35) % H);
      ctx.fillStyle = "rgba(255,240,205," + (0.1 + 0.14 * Math.abs(Math.sin(t * 0.03 + i))) + ")";
      ctx.beginPath(); ctx.arc(mx, my, 0.8, 0, 7); ctx.fill();
    }
    ctx.restore();
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H * 0.44, H * 0.34, W / 2, H * 0.5, H * 0.98);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(10,8,5,.42)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------------- boucle
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 16.667;
    last = now;
    if (dt > 3) dt = 3;
    update(dt);
    if (state === "title") renderTitle();
    else render();
    if (trans) drawIris();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- démarrage
  resize();
  showTitle();
  requestAnimationFrame(frame);

  if ("serviceWorker" in navigator && location.hash !== "#debug") {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  // ---------------------------------------------------------------- hook de test (#debug)
  if (location.hash === "#debug") {
    window.__game = {
      get state() { return state; },
      get mapId() { return mapId; },
      get player() { return player; },
      get quest() { return quest; },
      get enemies() { return enemies; },
      get pickups() { return pickups; },
      get cam() { return cam; },
      newGame, loadGame,
      move(x, y) { input.mx = x; input.my = y; },
      stop() { input.mx = 0; input.my = 0; },
      attack() { input.attack = true; },
      interact() { input.interact = true; },
      face(d) { player.dir = d; },
      teleport(id, tx, ty) { enterMap(id, tx, ty); },
      killNearest() {
        let b = null, bd = 1e9;
        for (const e of enemies) if (!e.dead) { const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2; if (d < bd) { bd = d; b = e; } }
        if (b) { b.hp = 0; killEnemy(b); b.dead = true; }
        return b && b.type;
      },
      addGold(n) { player.gold += n; updateHud(); },
      openMenu, openShop,
    };
  }
})();
