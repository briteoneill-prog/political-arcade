// ===== Supabase Connection =====
const SUPABASE_URL = "https://lspoqdrbmrqyeyqazwkw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Puz5-fNXMzstJB0gpWpY8g_KmdbD70i";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ====== CONFIG ======
// Change this to your real Margarita Challenge date (YYYY-MM-DD)
const CHALLENGE_DATE = "2026-06-15";

// ====== TITLES BY RANK (top -> bottom) ======
const TITLES = [
  "The Filibuster Wizard 🧙‍♂️",
  "Policy Paladin ⚔️",
  "Debate Dragon 🐉",
  "Grassroots Gladiator 🌱",
  "Ballot Boss 🗳️",
  "Civic Superfan 📣",
  "Town Hall Hero 🏛️",
  "Hashtag Firestarter 🔥",
  "Opinionated Owl 🦉",
  "Newsfeed Ninja 🥷",
  "Political Dabbler 🎯",
  "Ballot-Only Betty / Ben ✍️",
  "Couch Campaigner 🛋️",
  "Low-Info Legend 🕶️",
  "The Apolitical Unicorn 🦄"
];

// ====== DOM ======
const playersDiv = document.getElementById("players");
const addBtn = document.getElementById("addBtn");
const resetBtn = document.getElementById("resetBtn");
const gameStatus = document.getElementById("gameStatus");

const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalEmoji = document.getElementById("modalEmoji");
const reasonInput = document.getElementById("reasonInput");
const cancelVoteBtn = document.getElementById("cancelVoteBtn");
const submitVoteBtn = document.getElementById("submitVoteBtn");

// Comments
const commenterName = document.getElementById("commenterName");
const commentText = document.getElementById("commentText");
const addCommentBtn = document.getElementById("addCommentBtn");
const commentList = document.getElementById("commentList");

// Betting
const bettorName = document.getElementById("bettorName");
const betAmount = document.getElementById("betAmount");
const betTony = document.getElementById("betTony");
const betBrittany = document.getElementById("betBrittany");
const betCloseLine = document.getElementById("betCloseLine");
const betStatus = document.getElementById("betStatus");
const tonyTotal = document.getElementById("tonyTotal");
const brittanyTotal = document.getElementById("brittanyTotal");
const tonyCount = document.getElementById("tonyCount");
const brittanyCount = document.getElementById("brittanyCount");
const betList = document.getElementById("betList");

// ====== STATE ======
let players = [];   // {id, name, photo_url, score, votes:[]}
let comments = [];  // {id, name, text, created_at}
let bets = [];      // {id, name, amount, pick, created_at}

let pendingVote = null;
modalBackdrop.classList.remove("show");

// ====== EVENTS ======
addBtn.addEventListener("click", addPlayer);

resetBtn.addEventListener("click", async () => {
  // For a shared backend, "reset" is dangerous. We’ll do a local-friendly message.
  alert("Reset is disabled for shared backend (so one person can’t wipe everyone). If you want an admin reset button, tell me and I’ll add one safely.");
});

cancelVoteBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});
submitVoteBtn.addEventListener("click", submitVote);

addCommentBtn.addEventListener("click", addComment);

betTony.addEventListener("click", () => placeBet("Tony"));
betBrittany.addEventListener("click", () => placeBet("Brittany"));

// ====== INIT ======
(async function init() {
  // quick smoke test
  const test = await supabaseClient.from("players").select("*").limit(1);
  if (test.error) {
    console.error(test.error);
    alert("Supabase connection error. Open Console for details.");
    return;
  }

  await refreshAll();

  // Optional: auto-refresh every 10 seconds so everyone sees updates
  setInterval(refreshAll, 10000);
})();

// ====== REFRESH ======
async function refreshAll() {
  await Promise.all([
    loadPlayersAndVotes(),
    loadComments(),
    loadBets()
  ]);
  renderAll();
}

async function loadPlayersAndVotes() {
  // players
  const { data: pData, error: pErr } = await supabaseClient
    .from("players")
    .select("id,name,photo_url,created_at")
    .order("created_at", { ascending: true });

  if (pErr) {
    console.error(pErr);
    return;
  }

  // votes (load recent enough; you can remove limit later)
  const { data: vData, error: vErr } = await supabaseClient
    .from("votes")
    .select("id,player_id,type,reason,agree,down,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (vErr) {
    console.error(vErr);
    return;
  }

  // attach votes + calc score
  const votesByPlayer = new Map();
  (vData || []).forEach(v => {
    if (!votesByPlayer.has(v.player_id)) votesByPlayer.set(v.player_id, []);
    votesByPlayer.get(v.player_id).push(v);
  });

  players = (pData || []).map(p => {
    const pvotes = votesByPlayer.get(p.id) || [];
    const score = calcScore(pvotes);
    return {
      ...p,
      votes: pvotes,
      score
    };
  });
}

async function loadComments() {
  const { data, error } = await supabaseClient
    .from("comments")
    .select("id,name,text,created_at")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) console.error(error);
  comments = data || [];
}

async function loadBets() {
  const { data, error } = await supabaseClient
    .from("bets")
    .select("id,name,amount,pick,created_at")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) console.error(error);
  bets = data || [];
}

// ====== RENDER ======
function renderAll() {
  renderPlayers();
  renderComments();
  renderBets();
  updateStatus();
  renderBetCloseInfo();
}

function updateStatus() {
  if (!gameStatus) return;
  if (players.length === 0) {
    gameStatus.textContent = "STATUS: WAITING FOR FIRST PLAYER…";
  } else {
    gameStatus.textContent = `STATUS: LIVE — ${players.length} PLAYER(S) IN GAME`;
  }
}

function renderPlayers() {
  playersDiv.innerHTML = "";

  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((player, idx) => {
    const title = TITLES[idx] || "Wildcard Voter 🎲";
    const photo = player.photo_url || "";

    const wrap = document.createElement("div");
    wrap.className = "player";

    wrap.innerHTML = `
      <div class="avatar">
        ${photo ? `<img src="${photo}" alt="${escapeHtml(player.name)}"/>` : ""}
      </div>

      <div class="player-info">
        <div class="player-name">${idx + 1}. ${escapeHtml(player.name)}</div>
        <div class="player-title">${title}</div>
        <div class="player-meta">
          <div>Score: <b>${player.score}</b></div>
        </div>
      </div>

      <div class="controls">
        <div class="vote-buttons">
          <button class="vote-btn" data-vote="donkey" data-id="${player.id}" title="Vote donkey">🫏</button>
          <button class="vote-btn" data-vote="elephant" data-id="${player.id}" title="Vote elephant">🐘</button>
        </div>
      </div>

      <div class="vote-list">${renderVotes(player)}</div>
    `;

    playersDiv.appendChild(wrap);
  });

  // Vote buttons + animation
  document.querySelectorAll(".vote-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.remove("pop");
      void btn.offsetWidth;
      btn.classList.add("pop");

      const playerId = btn.getAttribute("data-id");
      const type = btn.getAttribute("data-vote");
      openVoteModal(playerId, type);
    });
  });

  // Agree / Downvote
  document.querySelectorAll("[data-action='agree']").forEach(btn => {
    btn.addEventListener("click", () => {
      agreeVote(btn.getAttribute("data-voteid"));
    });
  });

  document.querySelectorAll("[data-action='down']").forEach(btn => {
    btn.addEventListener("click", () => {
      downvoteVote(btn.getAttribute("data-voteid"));
    });
  });
}

function renderVotes(player) {
  const pv = player.votes || [];
  if (pv.length === 0) {
    return `<div class="vote-item"><span style="opacity:.75">NO VOTES YET…</span></div>`;
  }

  const top = pv.slice(0, 8);
  return top.map(v => {
    const label = v.type === "donkey" ? "🫏" : "🐘";
    return `
      <div class="vote-item">
        <div class="vote-left">
          <div class="pill">${label}</div>
          <div class="vote-reason">${escapeHtml(v.reason)}</div>
          <div style="opacity:.85">+${v.agree} / -${v.down}</div>
        </div>
        <div class="vote-actions">
          <button class="small-btn" data-action="agree" data-voteid="${v.id}">AGREE</button>
          <button class="small-btn" data-action="down" data-voteid="${v.id}">DOWN</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderComments() {
  commentList.innerHTML = "";
  if (!comments.length) {
    commentList.innerHTML = `<div class="tiny" style="opacity:.75">No comments yet…</div>`;
    return;
  }

  comments.forEach(c => {
    const div = document.createElement("div");
    div.className = "comment";
    div.innerHTML = `
      <div class="who">${escapeHtml(c.name)} says:</div>
      <div class="text">${escapeHtml(c.text)}</div>
    `;
    commentList.appendChild(div);
  });
}

function renderBetCloseInfo() {
  const closeDate = bettingCloseDate();
  if (!closeDate) {
    betCloseLine.textContent = "Betting closes 1 week before the challenge.";
    return;
  }
  betCloseLine.textContent =
    `Betting closes ${formatDate(closeDate)} (1 week before the challenge).`;
}

function renderBets() {
  const tonyBetsArr = bets.filter(b => b.pick === "Tony");
  const brittBetsArr = bets.filter(b => b.pick === "Brittany");

  const tonySum = tonyBetsArr.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const brittSum = brittBetsArr.reduce((s, b) => s + (Number(b.amount) || 0), 0);

  tonyTotal.textContent = `$${tonySum}`;
  brittanyTotal.textContent = `$${brittSum}`;
  tonyCount.textContent = tonyBetsArr.length;
  brittanyCount.textContent = brittBetsArr.length;

  betList.innerHTML = "";
  if (!bets.length) {
    betList.innerHTML = `<div class="tiny" style="opacity:.75">No bets yet…</div>`;
    return;
  }

  bets.forEach(b => {
    const div = document.createElement("div");
    div.className = "bet";
    div.innerHTML = `
      <div class="line1">${escapeHtml(b.name)} bet <b>$${Number(b.amount)}</b> on <b>${b.pick}</b></div>
      <div class="line2">${formatDateTime(new Date(b.created_at))}</div>
    `;
    betList.appendChild(div);
  });
}

// ====== ADD PLAYER (with avatar upload) ======
async function addPlayer() {
  const nameEl = document.getElementById("nameInput");
  const photoEl = document.getElementById("photoInput");

  const name = (nameEl.value || "").trim();
  const photoFile = photoEl.files[0];

  if (!name) return alert("ENTER A NAME");
  if (!photoFile) return alert("UPLOAD A PHOTO");

  // 1) Upload photo to Storage (avatars bucket)
  const fileExt = (photoFile.name.split(".").pop() || "png").toLowerCase();
  const filePath = `${Date.now()}-${safeSlug(name)}.${fileExt}`;

  const { error: upErr } = await supabaseClient
    .storage
    .from("avatars")
    .upload(filePath, photoFile, { upsert: false });

  if (upErr) {
    console.error(upErr);
    alert("Photo upload failed. Make sure Storage bucket 'avatars' exists and is public.");
    return;
  }

  // 2) Get public URL for the uploaded image
  const { data: pub } = supabaseClient
    .storage
    .from("avatars")
    .getPublicUrl(filePath);

  const photo_url = pub?.publicUrl || "";

  // 3) Insert player row
  const { error: insErr } = await supabaseClient
    .from("players")
    .insert([{ name, photo_url }]);

  if (insErr) {
    console.error(insErr);
    alert("Could not add player. If the name already exists, try a different name.");
    return;
  }

  nameEl.value = "";
  photoEl.value = "";

  await refreshAll();
}

// ====== MODAL + VOTES ======
function openVoteModal(playerId, type) {
  const player = players.find(p => p.id === playerId);
  if (!player) return;

  pendingVote = { playerId, type };
  modalTitle.textContent = `VOTE ON ${player.name.toUpperCase()}`;
  modalEmoji.textContent = type === "donkey" ? "🫏" : "🐘";
  reasonInput.value = "";

  modalBackdrop.classList.add("show");
  reasonInput.focus();
}

function closeModal() {
  modalBackdrop.classList.remove("show");
  pendingVote = null;
}

async function submitVote() {
  if (!pendingVote) return;

  const reason = (reasonInput.value || "").trim();
  if (!reason) return alert("ADD A QUICK REASON");

  const payload = {
    player_id: pendingVote.playerId,
    type: pendingVote.type,
    reason
  };

  const { error } = await supabaseClient.from("votes").insert([payload]);
  if (error) {
    console.error(error);
    alert("Vote submit failed. Check your votes table policies/RLS.");
    return;
  }

  closeModal();
  await refreshAll();
}

async function agreeVote(voteId) {
  // Increment agree by 1
  const { data: current, error: selErr } = await supabaseClient
    .from("votes")
    .select("agree")
    .eq("id", voteId)
    .single();

  if (selErr) { console.error(selErr); return; }

  const { error } = await supabaseClient
    .from("votes")
    .update({ agree: (current.agree || 0) + 1 })
    .eq("id", voteId);

  if (error) console.error(error);
  await refreshAll();
}

async function downvoteVote(voteId) {
  // Increment down by 1
  const { data: current, error: selErr } = await supabaseClient
    .from("votes")
    .select("down")
    .eq("id", voteId)
    .single();

  if (selErr) { console.error(selErr); return; }

  const { error } = await supabaseClient
    .from("votes")
    .update({ down: (current.down || 0) + 1 })
    .eq("id", voteId);

  if (error) console.error(error);
  await refreshAll();
}

// ====== COMMENTS ======
async function addComment() {
  const name = (commenterName.value || "").trim();
  const text = (commentText.value || "").trim();

  if (!name) return alert("ADD YOUR NAME");
  if (!text) return alert("ADD A COMMENT");

  const { error } = await supabaseClient
    .from("comments")
    .insert([{ name, text }]);

  if (error) {
    console.error(error);
    alert("Comment failed. Check comments table policies/RLS.");
    return;
  }

  commenterName.value = "";
  commentText.value = "";

  await refreshAll();
}

// ====== BETTING ======
async function placeBet(pick) {
  const closeDate = bettingCloseDate();
  const now = new Date();

  if (closeDate && now >= closeDate) {
    betStatus.textContent = "BETTING IS CLOSED.";
    return alert("Betting is closed (1 week before the challenge).");
  }

  const name = (bettorName.value || "").trim();
  const amount = Number(betAmount.value);

  if (!name) return alert("ADD YOUR NAME FOR THE BET");
  if (!Number.isFinite(amount) || amount <= 0) return alert("ENTER A VALID AMOUNT");

  const { error } = await supabaseClient
    .from("bets")
    .insert([{ name, amount: Math.round(amount), pick }]);

  if (error) {
    console.error(error);
    alert("Bet failed. Check bets table policies/RLS.");
    return;
  }

  bettorName.value = "";
  betAmount.value = "";
  betStatus.textContent = `BET PLACED ON ${pick.toUpperCase()}!`;

  await refreshAll();
}

function bettingCloseDate() {
  const d = parseISODate(CHALLENGE_DATE);
  if (!d) return null;
  const close = new Date(d);
  close.setDate(close.getDate() - 7);
  close.setHours(0, 0, 0, 0);
  return close;
}

// ====== HELPERS ======
function calcScore(votes) {
  // each vote = +1, each agree = +1, each down = -1
  let total = 0;
  for (const v of votes) {
    total += 1;
    total += (v.agree || 0);
    total -= (v.down || 0);
  }
  return total;
}

function safeSlug(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24) || "player";
}

function parseISODate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, da = Number(m[3]);
  const d = new Date(y, mo, da);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatDate(d) {
  return d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
}
function formatDateTime(d) {
  return d.toLocaleString(undefined, {
    year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"
  });
}

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}