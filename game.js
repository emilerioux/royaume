/* La Quête du Chevalier — petit RPG médiéval, vue de dessus, hors ligne.
   Phase 1 : village + forêt + grotte, 3 quêtes, combat, or, échoppe, sauvegarde. */
(() => {
  "use strict";

  // ---------------------------------------------------------------- constantes
  const TILE = 16;
  const SAVE_KEY = "quete-chevalier-v1";
  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const COL = {
    grass: "#4f7a3b", grass2: "#578140", flower: "#d8d24a",
    path: "#b6884f", path2: "#a5793f",
    water: "#3d6ea6", water2: "#4f80b6",
    floor: "#5a4a3a", floor2: "#63513f",
    wallTop: "#9aa0ac", wall: "#6f7480", wallDark: "#4c505a",
    wood: "#7a4f2c", woodDark: "#5c3c22", roof: "#a4402f", roofDark: "#822f21",
    tree: "#2f6b34", tree2: "#3c7d3f", trunk: "#6b4a2b",
    shadow: "rgba(0,0,0,0.28)",
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

  const SOLID = new Set(["T", "#", "H", "R", "w", "S", "o", "C", "K", "f"]);
  const isSolidChar = (c) => SOLID.has(c);

  // ---------------------------------------------------------------- cartes
  function buildVillage() {
    const W = 24, H = 22, g = grid(W, H, ".");
    border(g, "T");
    rect(g, 19, 2, 4, 3, "w");
    house(g, 4, 3, 4, 4);
    house(g, 12, 3, 4, 4);
    house(g, 4, 12, 4, 4);
    hline(g, 6, 13, 8, "=");
    hline(g, 6, 18, 15, "=");
    vline(g, 7, 15, 6, "=");
    vline(g, 7, 20, 13, "=");
    vline(g, 8, 20, 18, "=");
    hline(g, 13, 18, 20, "=");
    rect(g, 10, 10, 2, 2, "o"); // puits
    put(g, 15, 13, "S"); // panneau
    put(g, 13, 21, "x"); // sortie sud -> forêt
    scatter(g, ",", 16, (x, y) => y > 18);
    scatter(g, "~", 10);
    return {
      id: "village", g, name: "Village de Bonrepos",
      spawn: { x: 12, y: 17 },
      transitions: [{ x: 13, y: 21, to: "foret", tx: 11, ty: 2 }],
      npcs: [
        { id: "elder", x: 12, y: 8, name: "Ancien", color: "#7c5cff", hair: "#d8d8d8" },
        { id: "baker", x: 6, y: 8, name: "Boulangère", color: "#d98b3c", hair: "#5b3a1e" },
        { id: "shop", x: 18, y: 10, name: "Marchand", color: "#3c8f6b", hair: "#2a2a2a", shop: true },
      ],
      signs: { "15,13": ["« Village de Bonrepos »", "Au sud : la forêt. On dit qu'une brute rôde dans la grotte."] },
      enemies: [],
      wells: ["10,10", "11,10", "10,11", "11,11"],
    };
  }

  function buildForet() {
    const W = 24, H = 26, g = grid(W, H, ".");
    border(g, "T");
    // bosquets
    rect(g, 3, 5, 3, 2, "T"); rect(g, 17, 4, 3, 3, "T");
    rect(g, 6, 12, 2, 4, "T"); rect(g, 15, 14, 4, 2, "T");
    rect(g, 9, 20, 3, 2, "T"); rect(g, 4, 18, 2, 3, "T");
    // ruisseau + pont
    hline(g, 1, 22, 10, "w"); put(g, 11, 10, "="); put(g, 12, 10, "=");
    // chemins
    vline(g, 1, 25, 11, "="); vline(g, 1, 25, 12, "=");
    hline(g, 12, 20, 16, "="); hline(g, 4, 11, 22, "=");
    // entrée village (haut) et grotte (bas)
    put(g, 11, 0, "="); put(g, 12, 0, "=");
    put(g, 11, 25, "K"); put(g, 12, 25, "K"); // façade de la grotte
    put(g, 11, 24, "^"); put(g, 12, 24, "^"); // le seuil déclenche l'entrée
    put(g, 8, 8, "S");
    scatter(g, "~", 26); scatter(g, ",", 12);
    return {
      id: "foret", g, name: "Forêt de Bonrepos",
      spawn: { x: 11, y: 2 },
      transitions: [
        { x: 11, y: 0, to: "village", tx: 13, ty: 20 },
        { x: 12, y: 0, to: "village", tx: 13, ty: 20 },
        { x: 11, y: 24, to: "grotte", tx: 8, ty: 11 },
        { x: 12, y: 24, to: "grotte", tx: 8, ty: 11 },
      ],
      npcs: [{ id: "woodcutter", x: 18, y: 17, name: "Bûcheron", color: "#8a6a3a", hair: "#3a2a18" }],
      signs: { "8,8": ["Sentier de la forêt.", "Nord : le village. Sud : la grotte.", "Attention aux slimes et aux loups."] },
      enemies: [
        { type: "slime", x: 7, y: 7 }, { type: "slime", x: 15, y: 8 },
        { type: "slime", x: 9, y: 13 }, { type: "slime", x: 17, y: 13 },
        { type: "slime", x: 6, y: 20 }, { type: "slime", x: 14, y: 21 },
        { type: "slime", x: 19, y: 18 },
        { type: "wolf", x: 5, y: 22 }, { type: "wolf", x: 20, y: 21 },
      ],
      wells: [],
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
      transitions: [{ x: 8, y: 13, to: "foret", tx: 11, ty: 22 }],
      npcs: [],
      signs: {},
      enemies: [{ type: "brute", x: 8, y: 5 }],
      wells: [],
      floor: true,
      chest: "13,2",
    };
  }

  const MAPS = { village: buildVillage(), foret: buildForet(), grotte: buildGrotte() };
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
    x: 0, y: 0, dir: "down", moving: false, anim: 0,
    hp: 3, maxHp: 3, gold: 0, sword: 0,
    bag: [], iframe: 0, kb: { x: 0, y: 0 },
    attack: 0, attackDir: "down",
  };
  let quest = {}; // id -> { state, progress }
  let world = { chestOpened: false, bruteDefeated: false };
  let enemies = [];
  let pickups = [];

  const input = { mx: 0, my: 0, attack: false, interact: false };

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
    ]);
  }

  // ---------------------------------------------------------------- cartes : entrée
  function enterMap(id, tx, ty, keepSpawnAsIs) {
    mapId = id;
    map = MAPS[id];
    player.x = tx * TILE + TILE / 2;
    player.y = ty * TILE + TILE / 2;
    player.kb.x = player.kb.y = 0;
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

  // ---------------------------------------------------------------- écran-titre / game over
  const titleEl = document.getElementById("title");
  const overEl = document.getElementById("over");
  const hudEl = document.getElementById("hud");
  const padEl = document.getElementById("pad");
  function showTitle() {
    state = "title";
    titleEl.hidden = false;
    hudEl.hidden = true;
    padEl.hidden = true;
    document.getElementById("btn-continue").hidden = !hasSave();
  }
  function startPlay() {
    titleEl.hidden = true;
    overEl.hidden = true;
    hudEl.hidden = false;
    padEl.hidden = false;
    state = "play";
    updateHud();
  }
  document.getElementById("btn-new").addEventListener("click", newGame);
  document.getElementById("btn-continue").addEventListener("click", loadGame);
  document.getElementById("btn-revive").addEventListener("click", () => {
    overEl.hidden = true;
    player.hp = player.maxHp;
    player.iframe = 60;
    enterMap("village", MAPS.village.spawn.x, MAPS.village.spawn.y);
    startPlay();
  });
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
    if (mag < 0.22) { input.mx = 0; input.my = 0; }
    else { input.mx = nx * mag; input.my = ny * mag; }
  }
  function stickEnd() {
    stickId = null;
    input.mx = 0; input.my = 0;
    knobEl.style.transform = "translate(0,0)";
    stickEl.classList.remove("on");
  }
  cv.addEventListener("touchstart", (e) => {
    if (state !== "play") return;
    for (const t of e.changedTouches) {
      if (stickId === null) { stickStart(t.identifier, t.clientX, t.clientY); }
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
  btnA.addEventListener("pointerdown", (e) => { e.preventDefault(); pressAction("attack"); });
  btnB.addEventListener("pointerdown", (e) => { e.preventDefault(); pressAction("interact"); });
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
    if (state === "title" && (k === "enter" || k === " ")) { hasSave() ? loadGame() : newGame(); return; }
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
    if (state !== "play") { input.attack = input.interact = false; return; }
    keyboardMove();

    // interaction
    if (input.interact) { input.interact = false; tryInteract(); return; }

    // attaque
    if (input.attack && player.attack <= 0) {
      player.attack = 15;
      player.attackDir = player.dir;
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
      player.anim += dt * 0.14;
    } else player.anim = 0;
    // recul
    if (Math.abs(player.kb.x) > 0.1 || Math.abs(player.kb.y) > 0.1) {
      moveEntity(player, player.kb.x, player.kb.y, 5, 4);
      player.kb.x *= 0.8; player.kb.y *= 0.8;
    }
    if (player.moving) moveEntity(player, mvx * sp, mvy * sp, 5, 4);
    if (player.iframe > 0) player.iframe--;

    // transitions de carte
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
    for (const tr of map.transitions) {
      if (tr.x === ptx && tr.y === pty) {
        enterMap(tr.to, tr.tx, tr.ty);
        return;
      }
    }

    updateEnemies(dt);
    updatePickups();
    updateCamera(false);
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
        moveEntity(e, e.kb.x, e.kb.y, e.r - 1, e.r - 1);
        e.kb.x *= 0.78; e.kb.y *= 0.78;
      } else {
        moveEntity(e, vx * e.speed, vy * e.speed, e.r - 1, e.r - 1);
      }
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
        player.hp -= e.dmg;
        player.iframe = 85;
        const k = dist || 1;
        player.kb.x = (-dx / k) * 3.2; player.kb.y = (-dy / k) * 3.2;
        updateHud();
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
  function updateCamera(snap) {
    const vw = cv.width, vh = cv.height;
    let tx = player.x - vw / 2, ty = player.y - vh / 2;
    const maxX = Math.max(0, map.w * TILE - vw);
    const maxY = Math.max(0, map.h * TILE - vh);
    tx = Math.max(0, Math.min(maxX, tx));
    ty = Math.max(0, Math.min(maxY, ty));
    if (map.w * TILE < vw) tx = (map.w * TILE - vw) / 2;
    if (map.h * TILE < vh) ty = (map.h * TILE - vh) / 2;
    if (snap) { cam.x = tx; cam.y = ty; }
    else { cam.x += (tx - cam.x) * 0.18; cam.y += (ty - cam.y) * 0.18; }
  }

  // ---------------------------------------------------------------- rendu
  function resize() {
    const r = cv.getBoundingClientRect();
    const targetW = 240;
    cv.width = targetW;
    cv.height = Math.max(280, Math.min(470, Math.round(targetW * r.height / r.width)));
    ctx.imageSmoothingEnabled = false;
    updateCamera(true);
  }
  addEventListener("resize", resize);

  function px(v) { return Math.round(v - cam.x); }
  function py(v) { return Math.round(v - cam.y); }

  function drawTile(c, sx, sy) {
    if (map.floor) {
      ctx.fillStyle = ((sx + sy) & 1) ? COL.floor : COL.floor2;
      ctx.fillRect(sx * TILE - cam.x, sy * TILE - cam.y, TILE, TILE);
    } else {
      ctx.fillStyle = ((sx + sy) & 1) ? COL.grass : COL.grass2;
      ctx.fillRect(sx * TILE - cam.x, sy * TILE - cam.y, TILE, TILE);
    }
    const X = Math.round(sx * TILE - cam.x), Y = Math.round(sy * TILE - cam.y);
    switch (c) {
      case "=":
        ctx.fillStyle = COL.path; ctx.fillRect(X, Y, TILE, TILE);
        ctx.fillStyle = COL.path2; ctx.fillRect(X + 3, Y + 5, 3, 3); ctx.fillRect(X + 9, Y + 10, 3, 2);
        break;
      case ",":
        ctx.fillStyle = COL.flower;
        ctx.fillRect(X + 4, Y + 5, 2, 2); ctx.fillRect(X + 10, Y + 9, 2, 2); ctx.fillRect(X + 7, Y + 12, 2, 2);
        break;
      case "~":
        ctx.fillStyle = "#3f6a30";
        ctx.fillRect(X + 2, Y + 8, 2, 5); ctx.fillRect(X + 6, Y + 6, 2, 7); ctx.fillRect(X + 10, Y + 9, 2, 5); ctx.fillRect(X + 13, Y + 7, 2, 6);
        break;
      case "w": {
        const o = Math.sin((time * 0.05) + (sx + sy)) * 1.5;
        ctx.fillStyle = COL.water; ctx.fillRect(X, Y, TILE, TILE);
        ctx.fillStyle = COL.water2;
        ctx.fillRect(X + 2 + o, Y + 4, 5, 1); ctx.fillRect(X + 9 - o, Y + 10, 5, 1);
        break;
      }
      case "#":
        ctx.fillStyle = COL.wallDark; ctx.fillRect(X, Y, TILE, TILE);
        ctx.fillStyle = COL.wall; ctx.fillRect(X, Y, TILE, TILE - 3);
        ctx.fillStyle = COL.wallTop; ctx.fillRect(X, Y, TILE, 3);
        break;
      case "x": case "^":
        if (map.floor || c === "x") { ctx.fillStyle = COL.path; ctx.fillRect(X, Y, TILE, TILE); }
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        break;
      case "K":
        ctx.fillStyle = "#3a3a42"; ctx.fillRect(X, Y, TILE, TILE);
        ctx.fillStyle = "#20202a"; ctx.fillRect(X + 3, Y + 2, TILE - 6, TILE - 2);
        break;
    }
  }

  function drawHouseTop(sx, sy) {
    const X = Math.round(sx * TILE - cam.x), Y = Math.round(sy * TILE - cam.y);
    ctx.fillStyle = COL.roofDark; ctx.fillRect(X, Y, TILE, TILE);
    ctx.fillStyle = COL.roof; ctx.fillRect(X, Y + 2, TILE, TILE - 4);
    ctx.fillStyle = "#c65a48"; ctx.fillRect(X, Y + 2, TILE, 2);
  }
  function drawHouseBody(sx, sy, isDoor) {
    const X = Math.round(sx * TILE - cam.x), Y = Math.round(sy * TILE - cam.y);
    ctx.fillStyle = COL.woodDark; ctx.fillRect(X, Y, TILE, TILE);
    ctx.fillStyle = COL.wood; ctx.fillRect(X, Y, TILE, TILE - 2);
    ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.strokeRect(X + 0.5, Y + 0.5, TILE - 1, TILE - 1);
    if (isDoor) { ctx.fillStyle = "#2a1c10"; ctx.fillRect(X + 4, Y + 3, TILE - 8, TILE - 3); }
  }

  function drawShadow(x, y, w) {
    ctx.fillStyle = COL.shadow;
    ctx.beginPath();
    ctx.ellipse(px(x), py(y) + 6, w, w * 0.45, 0, 0, 7);
    ctx.fill();
  }

  function drawKnight() {
    const x = px(player.x), y = py(player.y);
    if (player.iframe > 0 && (player.iframe >> 2) & 1) return;
    drawShadow(player.x, player.y, 6);
    const step = player.moving ? (Math.floor(player.anim) % 2) : 0;
    const d = player.dir;
    // jambes
    ctx.fillStyle = "#3a2a18";
    if (d === "left" || d === "right") {
      ctx.fillRect(x - 3, y + 3 - step, 3, 4 + step);
      ctx.fillRect(x + 1, y + 3 + step, 3, 4 - step);
    } else {
      ctx.fillRect(x - 3, y + 3 - step, 2, 4);
      ctx.fillRect(x + 1, y + 3 + step, 2, 4);
    }
    // tunique
    ctx.fillStyle = "#2e5e9e";
    ctx.fillRect(x - 4, y - 5, 8, 9);
    ctx.fillStyle = "#244e86";
    ctx.fillRect(x - 4, y + 1, 8, 3);
    // ceinture
    ctx.fillStyle = "#7a5a34";
    ctx.fillRect(x - 4, y, 8, 1);
    // épaulières
    ctx.fillStyle = "#b9c0c8";
    ctx.fillRect(x - 5, y - 5, 2, 4); ctx.fillRect(x + 3, y - 5, 2, 4);
    // tête + casque
    ctx.fillStyle = "#e2b98f";
    ctx.fillRect(x - 3, y - 10, 6, 5);
    ctx.fillStyle = "#b9c0c8";
    ctx.fillRect(x - 4, y - 12, 8, 4);
    ctx.fillRect(x - 3, y - 8, 6, 1);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(x - 1, y - 15, 2, 4);
    // yeux selon direction
    ctx.fillStyle = "#20140c";
    if (d === "down") { ctx.fillRect(x - 2, y - 8, 1, 2); ctx.fillRect(x + 1, y - 8, 1, 2); }
    else if (d === "left") { ctx.fillRect(x - 3, y - 8, 1, 2); }
    else if (d === "right") { ctx.fillRect(x + 2, y - 8, 1, 2); }
    // épée
    if (player.attack > 0) {
      const dv = DIRV[player.attackDir];
      const len = player.sword ? 15 : 11;
      const swing = player.attack > 12 || player.attack < 6; // arc rapide
      ctx.fillStyle = "#ececf2";
      const bx = x + dv.x * 5, by = y + dv.y * 5 - 2;
      if (dv.x) ctx.fillRect(dv.x > 0 ? bx : bx - len, by - 1, len, 3);
      else ctx.fillRect(bx - 1, dv.y > 0 ? by : by - len, 3, len);
      ctx.fillStyle = "#7a5a34"; // garde
      ctx.fillRect(bx - 2, by - 2, 4, 4);
      if (swing) {
        ctx.strokeStyle = "rgba(255,255,255,.35)";
        ctx.beginPath();
        ctx.arc(x, y - 2, len, 0, Math.PI * 1.2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "#c9ccd4";
      if (d === "left") ctx.fillRect(x - 6, y - 3, 2, 7);
      else ctx.fillRect(x + 4, y - 3, 2, 7);
    }
  }

  function drawEnemy(e) {
    const x = px(e.x), y = py(e.y);
    drawShadow(e.x, e.y, e.r - 1);
    const hit = e.flash > 0 && (e.flash & 1);
    if (e.type === "slime") {
      const wob = Math.sin(time * 0.12 + e.x) * 1.5;
      ctx.fillStyle = hit ? "#fff" : "#5fbf5f";
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 7, 6 - wob * 0.3, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = hit ? "#fff" : "#3d9d3d";
      ctx.fillRect(x - 7, y + 4, 14, 3);
      ctx.fillStyle = "#123";
      ctx.fillRect(x - 3, y - 1, 1, 2); ctx.fillRect(x + 2, y - 1, 1, 2);
    } else if (e.type === "wolf") {
      ctx.fillStyle = hit ? "#fff" : "#7d7d85";
      ctx.fillRect(x - 7, y - 3, 14, 7);
      ctx.fillStyle = hit ? "#fff" : "#5a5a62";
      const hx = e.dir === "left" ? x - 8 : x + 5;
      ctx.fillRect(hx, y - 4, 4, 5);
      ctx.fillRect(hx + (e.dir === "left" ? 0 : 2), y - 6, 2, 2); // oreille
      ctx.fillStyle = "#cfcfd6";
      ctx.fillRect(x - 6, y + 2, 12, 2);
      ctx.fillStyle = "#111";
      ctx.fillRect(hx + (e.dir === "left" ? 0 : 3), y - 2, 1, 1);
    } else {
      ctx.fillStyle = hit ? "#fff" : "#6a8f4a";
      ctx.fillRect(x - 9, y - 8, 18, 14);
      ctx.fillStyle = hit ? "#fff" : "#4d6b34";
      ctx.fillRect(x - 9, y + 2, 18, 4);
      ctx.fillStyle = "#5c3c22";
      ctx.fillRect(x - 9, y + 4, 18, 3);
      ctx.fillStyle = "#20140c";
      ctx.fillRect(x - 4, y - 4, 2, 2); ctx.fillRect(x + 2, y - 4, 2, 2);
      // barre de vie
      ctx.fillStyle = "#000"; ctx.fillRect(x - 9, y - 12, 18, 3);
      ctx.fillStyle = "#d33"; ctx.fillRect(x - 9, y - 12, 18 * Math.max(0, e.hp) / e.maxHp, 3);
    }
  }

  function drawNpc(n) {
    const x = px(n.x * TILE + TILE / 2), y = py(n.y * TILE + TILE / 2);
    drawShadow(n.x * TILE + TILE / 2, n.y * TILE + TILE / 2, 6);
    ctx.fillStyle = "#3a2a18";
    ctx.fillRect(x - 3, y + 3, 2, 4); ctx.fillRect(x + 1, y + 3, 2, 4);
    ctx.fillStyle = n.color;
    ctx.fillRect(x - 4, y - 5, 8, 9);
    ctx.fillStyle = "#e2b98f";
    ctx.fillRect(x - 3, y - 10, 6, 5);
    ctx.fillStyle = n.hair;
    ctx.fillRect(x - 4, y - 12, 8, 3);
    ctx.fillStyle = "#20140c";
    ctx.fillRect(x - 2, y - 8, 1, 2); ctx.fillRect(x + 1, y - 8, 1, 2);
    // marqueur de quête
    let mark = null;
    for (const id of questsForNpc(n.id)) {
      const st = quest[id].state;
      if (QUESTS[id].giver === n.id && st === "available") mark = "!";
      if (QUESTS[id].turnInAt === n.id && st === "ready") { mark = "?"; break; }
    }
    if (n.shop) mark = mark || "$";
    if (mark) {
      const b = Math.sin(time * 0.15) * 1.5;
      ctx.fillStyle = mark === "?" ? "#f2c14e" : mark === "$" ? "#8bd18b" : "#f2c14e";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(mark, x, y - 16 + b);
    }
  }

  function drawTree(sx, sy) {
    const X = Math.round(sx * TILE - cam.x), Y = Math.round(sy * TILE - cam.y);
    ctx.fillStyle = COL.trunk;
    ctx.fillRect(X + 6, Y + 8, 4, 7);
    ctx.fillStyle = "#1f4a24";
    ctx.beginPath(); ctx.arc(X + 8, Y + 5, 9, 0, 7); ctx.fill();
    ctx.fillStyle = COL.tree;
    ctx.beginPath(); ctx.arc(X + 8, Y + 4, 8, 0, 7); ctx.fill();
    ctx.fillStyle = COL.tree2;
    ctx.beginPath(); ctx.arc(X + 5, Y + 2, 4, 0, 7); ctx.fill();
  }

  function drawChest(sx, sy) {
    const X = Math.round(sx * TILE - cam.x), Y = Math.round(sy * TILE - cam.y);
    ctx.fillStyle = "#5c3c22"; ctx.fillRect(X + 2, Y + 5, 12, 8);
    ctx.fillStyle = "#7a5a34"; ctx.fillRect(X + 2, Y + 5, 12, 3);
    ctx.fillStyle = "#d9b24a";
    if (world.chestOpened) { ctx.fillRect(X + 2, Y + 3, 12, 2); }
    else { ctx.fillRect(X + 7, Y + 7, 2, 3); }
  }

  function drawSign(sx, sy) {
    const X = Math.round(sx * TILE - cam.x), Y = Math.round(sy * TILE - cam.y);
    ctx.fillStyle = COL.woodDark; ctx.fillRect(X + 7, Y + 6, 2, 8);
    ctx.fillStyle = COL.wood; ctx.fillRect(X + 2, Y + 2, 12, 6);
    ctx.strokeStyle = COL.woodDark; ctx.strokeRect(X + 2.5, Y + 2.5, 11, 5);
  }
  // dessine tout le puits (2x2) depuis sa case supérieure-gauche
  function drawWell(sx, sy) {
    const X = Math.round(sx * TILE - cam.x), Y = Math.round(sy * TILE - cam.y);
    const S = TILE * 2;
    // margelle ronde
    ctx.fillStyle = "#5c616c";
    ctx.beginPath(); ctx.ellipse(X + TILE, Y + TILE + 3, 15, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#7b8290";
    ctx.beginPath(); ctx.ellipse(X + TILE, Y + TILE, 15, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#20303a";
    ctx.beginPath(); ctx.ellipse(X + TILE, Y + TILE, 10, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#3d6a8f";
    ctx.beginPath(); ctx.ellipse(X + TILE, Y + TILE + 1, 7, 4, 0, 0, 7); ctx.fill();
    // poteaux + toit
    ctx.fillStyle = COL.woodDark;
    ctx.fillRect(X + 3, Y - 6, 3, S - 8);
    ctx.fillRect(X + S - 6, Y - 6, 3, S - 8);
    ctx.fillStyle = COL.roof;
    ctx.beginPath();
    ctx.moveTo(X - 2, Y - 4); ctx.lineTo(X + TILE, Y - 12); ctx.lineTo(X + S + 2, Y - 4); ctx.closePath();
    ctx.fill();
  }

  function render() {
    ctx.fillStyle = map.floor ? "#20160f" : "#1c2a14";
    ctx.fillRect(0, 0, cv.width, cv.height);

    const x0 = Math.max(0, Math.floor(cam.x / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE));
    const x1 = Math.min(map.w - 1, Math.ceil((cam.x + cv.width) / TILE));
    const y1 = Math.min(map.h - 1, Math.ceil((cam.y + cv.height) / TILE));

    // couche sol
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const c = map.g[y][x];
        if (c !== "H" && c !== "R") drawTile(c, x, y);
      }

    // objets triés par profondeur
    const list = [];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const c = map.g[y][x];
        const baseY = y * TILE + TILE;
        if (c === "T") list.push({ y: baseY - 6, d: () => drawTree(x, y) });
        else if (c === "R") list.push({ y: y * TILE + 2, d: () => drawHouseTop(x, y) });
        else if (c === "H" || c === "D") list.push({ y: baseY, d: () => drawHouseBody(x, y, c === "D") });
        else if (c === "S") list.push({ y: baseY, d: () => drawSign(x, y) });
        else if (c === "o") {
          const topLeft = map.g[y][x - 1] !== "o" && (!map.g[y - 1] || map.g[y - 1][x] !== "o");
          if (topLeft) list.push({ y: baseY + TILE, d: () => drawWell(x, y) });
        }
        else if (c === "C") list.push({ y: baseY, d: () => drawChest(x, y) });
      }
    for (const n of map.npcs) list.push({ y: n.y * TILE + TILE, d: () => drawNpc(n) });
    for (const e of enemies) if (!e.dead) list.push({ y: e.y, d: () => drawEnemy(e) });
    for (const p of pickups) list.push({ y: p.y, d: () => drawPickup(p) });
    list.push({ y: player.y, d: drawKnight });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.d();

    // vignette
    const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.3, cv.width / 2, cv.height / 2, cv.height * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, map.floor ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }

  function drawPickup(p) {
    const x = px(p.x), y = py(p.y) - Math.min(4, p.t * 0.4);
    if (p.kind === "coin") {
      ctx.fillStyle = "#f2c14e"; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
      ctx.fillStyle = "#c9962f"; ctx.fillRect(x - 1, y - 1, 2, 2);
    } else if (p.kind === "heart") {
      ctx.fillStyle = "#e8455f";
      ctx.fillRect(x - 3, y - 2, 6, 4); ctx.fillRect(x - 2, y + 2, 4, 2);
      ctx.fillRect(x - 3, y - 4, 2, 2); ctx.fillRect(x + 1, y - 4, 2, 2);
    } else if (p.kind === "key") {
      ctx.fillStyle = "#e9d27a";
      ctx.fillRect(x - 1, y - 4, 2, 7); ctx.fillRect(x - 3, y - 4, 6, 2); ctx.fillRect(x + 1, y + 1, 3, 2);
    }
  }

  // ---------------------------------------------------------------- boucle
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 16.667;
    last = now;
    if (dt > 3) dt = 3;
    update(dt);
    if (state !== "title") render();
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
