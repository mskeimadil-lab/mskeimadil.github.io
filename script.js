let allNovels = [];
let allCategories = [];
let currentCategory = "all";
let currentUser = null;
let currentNovel = null;
let currentChapters = [];
let currentChIndex = 0;
let currentFontSize = 16;
let currentLineHeight = 2.2;
let authMode = "login";
document.addEventListener("DOMContentLoaded", async () => {
showSplashOnce();
await checkSession();
await loadCategories();
await loadNovels();
bindReaderScroll();
checkNewsDot();
document.getElementById("searchInput").addEventListener("input", renderNovels);
});
function showSplashOnce() {
const splash = document.getElementById("splashScreen");
if (sessionStorage.getItem("splashShown")) {
splash.remove();
return;
}
sessionStorage.setItem("splashShown", "1");
setTimeout(() => {
splash.classList.add("fade-out");
setTimeout(() => splash.remove(), 700);
}, 1400);
}
async function checkSession() {
const { data: { session } } = await supabaseClient.auth.getSession();
if (session) await loadProfile(session.user.id);
}
async function loadProfile(userId) {
const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", userId).single();
if (data) {
currentUser = data;
updateAuthUI();
}
}
function updateAuthUI() {
document.getElementById("loginBtn").classList.toggle("hidden", !!currentUser);
document.getElementById("signupBtn").classList.toggle("hidden", !!currentUser);
document.getElementById("logoutBtn").classList.toggle("hidden", !currentUser);
document.getElementById("adminLink").classList.toggle("hidden", !currentUser);
document.getElementById("settingsLink").classList.toggle("hidden", !currentUser);
const badge = document.getElementById("userBadge");
if (currentUser) {
badge.textContent = "مرحباً، " + currentUser.username + (currentUser.is_admin ? " (أدمن)" : "");
badge.classList.remove("hidden");
} else {
badge.classList.add("hidden");
}
}
function showAuth(mode) {
authMode = mode;
document.getElementById("authTitle").textContent = mode === "login" ? "دخول" : "إنشاء حساب جديد";
document.getElementById("authMsg").textContent = "";
document.getElementById("authModal").classList.remove("hidden");
}
function closeAuth() { document.getElementById("authModal").classList.add("hidden"); }
async function submitAuth() {
const username = document.getElementById("authUsername").value.trim();
const code = document.getElementById("authCode").value.trim();
const msg = document.getElementById("authMsg");
if (!username || !code) { msg.textContent = "الرجاء تعبئة الحقلين"; return; }
const email = username.toLowerCase().replace(/[^a-z0-9]/g, "") + "@" + AUTH_DOMAIN;
if (authMode === "signup") {
const { data, error } = await supabaseClient.auth.signUp({
email, password: code,
options: { data: { username } }
});
if (error) { msg.textContent = "خطأ: " + error.message; return; }
if (data.user) await loadProfile(data.user.id);
} else {
const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: code });
if (error) { msg.textContent = "اسم مستخدم أو كود خاطئ"; return; }
await loadProfile(data.user.id);
}
closeAuth();
}
async function logout() {
await supabaseClient.auth.signOut();
currentUser = null;
updateAuthUI();
}
async function loadCategories() {
const { data } = await supabaseClient.from("categories").select("*").order("id");
allCategories = data || [];
const nav = document.getElementById("categoryTabs");
nav.innerHTML = '<button class="active" onclick="filterCategory(\'all\')">الكل</button>' +
allCategories.map(c => `<button onclick="filterCategory(${c.id})">${c.name}</button>`).join("");
}
function filterCategory(cat) {
currentCategory = cat;
document.querySelectorAll(".categories button").forEach(btn => btn.classList.remove("active"));
event.target.classList.add("active");
renderNovels();
}
async function loadNovels() {
const { data, error } = await supabaseClient
.from("novels")
.select("*, categories(name), chapters(id, chapter_number, title, created_at)")
.order("updated_at", { ascending: false })
.order("chapter_number", { ascending: false, foreignTable: "chapters" })
.limit(3, { foreignTable: "chapters" });
if (error) {
document.getElementById("novelsGrid").innerHTML = `<p style="text-align:center;grid-column:1/-1;">تعذر تحميل الروايات</p>`;
return;
}
allNovels = data || [];
renderBanner();
renderNovels();
}
function timeAgo(dateStr) {
if (!dateStr) return "";
const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
if (diff < 60) return "منذ لحظات";
if (diff < 3600) return "منذ " + Math.floor(diff / 60) + " دقيقة";
if (diff < 86400) return "منذ " + Math.floor(diff / 3600) + " ساعة";
if (diff < 2592000) return "منذ " + Math.floor(diff / 86400) + " يوم";
if (diff < 31536000) return "منذ " + Math.floor(diff / 2592000) + " شهر";
return "منذ " + Math.floor(diff / 31536000) + " سنة";
}
let bannerNovels = [];
let bannerIndex = 0;
let bannerTimer = null;
function renderBanner() {
const wrap = document.getElementById("bannerWrap");
bannerNovels = [...allNovels]
.filter(n => n.cover_url)
.sort((a, b) => (b.views || 0) - (a.views || 0))
.slice(0, 5);
if (!bannerNovels.length) { wrap.classList.add("hidden"); return; }
wrap.classList.remove("hidden");
const track = document.getElementById("bannerTrack");
const dots = document.getElementById("bannerDots");
track.innerHTML = bannerNovels.map((n, i) => `
<div class="banner-slide${i === 0 ? ' active' : ''}" style="background-image:url('${n.cover_url}')" onclick="openNovel('${n.id}')">
<div class="banner-info">
<span>🔥 الأكثر مشاهدة</span>
<h2>${n.title}</h2>
</div>
</div>`).join("");
dots.innerHTML = bannerNovels.map((_, i) => `<span class="${i === 0 ? 'active' : ''}" onclick="goToBanner(${i})"></span>`).join("");
bannerIndex = 0;
if (bannerTimer) clearInterval(bannerTimer);
if (bannerNovels.length > 1) {
bannerTimer = setInterval(() => goToBanner((bannerIndex + 1) % bannerNovels.length), 4500);
}
}
function goToBanner(i) {
bannerIndex = i;
document.querySelectorAll(".banner-slide").forEach((el, idx) => el.classList.toggle("active", idx === i));
document.querySelectorAll(".banner-dots span").forEach((el, idx) => el.classList.toggle("active", idx === i));
}
function renderNovels() {
const grid = document.getElementById("novelsGrid");
const term = document.getElementById("searchInput").value.toLowerCase();
const isTrending = currentCategory === "trending";
let filtered = allNovels.filter(n => {
const matchesCat = isTrending || currentCategory === "all" || n.category_id === currentCategory;
const matchesSearch = n.title.toLowerCase().includes(term) || (n.author || "").toLowerCase().includes(term);
return matchesCat && matchesSearch;
});
if (isTrending) {
filtered = filtered.slice().sort((a, b) => (b.views || 0) - (a.views || 0));
}
if (filtered.length === 0) {
grid.innerHTML = `<p style="text-align:center;grid-column:1/-1;padding:40px;">لا توجد روايات مطابقة بعد.</p>`;
return;
}
let html = "";
filtered.forEach((n) => {
const chapters = (n.chapters || []).slice().sort((a, b) => b.chapter_number - a.chapter_number).slice(0, 3);
html += `
<div class="novel-row" onclick="openNovel('${n.id}')">
<div class="novel-row-cover">
<img src="${n.cover_url || 'https://via.placeholder.com/300x400?text=No+Cover'}" alt="${n.title}">
</div>
<div class="novel-row-info">
<h3>${n.title}</h3>
<p class="novel-row-author">✍️ ${n.author || "غير معروف"} — 👁 ${n.views || 0}</p>
<div class="novel-row-chapters">
${chapters.length ? chapters.map(c => `
<div class="chapter-pill" onclick="event.stopPropagation(); openChapterDirect('${n.id}','${c.id}')">
<span class="ctime">${timeAgo(c.created_at)}</span>
<span class="cnum">الفصل ${c.chapter_number}</span>
</div>`).join("") : `<p class="no-chapters-msg">لا توجد فصول منشورة بعد</p>`}
</div>
</div>
</div>`;
});
grid.innerHTML = html;
}
async function openChapterDirect(novelId, chapterId) {
currentNovel = allNovels.find(n => n.id === novelId);
if (!currentNovel) return;
supabaseClient.rpc('increment_views', { target_id: novelId });
const { data: chapters } = await supabaseClient
.from("chapters").select("*").eq("novel_id", novelId).order("chapter_number");
currentChapters = chapters || [];
const idx = currentChapters.findIndex(c => c.id === chapterId);
openChapter(idx >= 0 ? idx : 0);
}
async function openNovel(id) {
currentNovel = allNovels.find(n => n.id === id);
if (!currentNovel) return;
supabaseClient.rpc('increment_views', { target_id: id });
document.getElementById("detailCover").src = currentNovel.cover_url || "https://via.placeholder.com/300x400?text=No+Cover";
document.getElementById("detailTitle").textContent = currentNovel.title;
document.getElementById("detailAuthor").textContent = "✍️ " + (currentNovel.author || "غير معروف");
document.getElementById("detailCategory").textContent = currentNovel.categories?.name || "";
document.getElementById("detailStatus").textContent = "الحالة: " + (currentNovel.status || "") +
"  |  👁 " + (currentNovel.views || 0) + " مشاهدة" +
"  |  📅 نُشرت: " + (currentNovel.created_at ? currentNovel.created_at.slice(0,10) : "");
document.getElementById("detailDesc").textContent = currentNovel.description || "";
const { data: chapters } = await supabaseClient
.from("chapters").select("*").eq("novel_id", id).order("chapter_number");
currentChapters = chapters || [];
const list = document.getElementById("chaptersList");
list.innerHTML = currentChapters.length
? currentChapters.map((c, i) => `
<div class="chapter-item" onclick="openChapter(${i})">
<span>الفصل ${c.chapter_number}: ${c.title}</span>
<span>➔</span>
</div>`).join("")
: `<p style="color:#94a3b8;">لا توجد فصول منشورة بعد.</p>`;
await updateFavButton();
document.getElementById("novelModal").classList.remove("hidden");
}
function closeNovel() { document.getElementById("novelModal").classList.add("hidden"); }
async function updateFavButton() {
const btn = document.getElementById("favBtn");
if (!currentUser) { btn.textContent = "☆ سجّل دخول لتفعيل المفضلة"; return; }
const { data } = await supabaseClient.from("favorites")
.select("*").eq("user_id", currentUser.id).eq("novel_id", currentNovel.id).maybeSingle();
btn.textContent = data ? "★ في المفضلة" : "☆ أضف للمفضلة";
}
async function toggleFavorite() {
if (!currentUser) { showAuth("login"); return; }
const { data } = await supabaseClient.from("favorites")
.select("*").eq("user_id", currentUser.id).eq("novel_id", currentNovel.id).maybeSingle();
if (data) {
await supabaseClient.from("favorites").delete().eq("user_id", currentUser.id).eq("novel_id", currentNovel.id);
} else {
await supabaseClient.from("favorites").insert({ user_id: currentUser.id, novel_id: currentNovel.id });
}
await updateFavButton();
}
async function openChapter(index) {
currentChIndex = index;
renderChapter();
document.getElementById("readerModal").classList.remove("hidden");
document.getElementById("novelModal").classList.add("hidden");
if (currentUser) {
await supabaseClient.from("reading_progress").upsert({
user_id: currentUser.id,
novel_id: currentNovel.id,
chapter_id: currentChapters[index].id,
updated_at: new Date().toISOString()
});
}
}
function renderChapter() {
const ch = currentChapters[currentChIndex];
document.getElementById("readerNovelTitle").textContent = currentNovel.title;
document.getElementById("readerChTitle").textContent = "الفصل " + ch.chapter_number + ": " + ch.title;
document.getElementById("readerChContent").textContent = ch.content;
const avatarImg = document.getElementById("readerAvatar");
if (currentUser && currentUser.avatar_url) {
avatarImg.src = currentUser.avatar_url;
avatarImg.style.display = "block";
} else {
avatarImg.style.display = "none";
}
const prevBtn = document.getElementById("prevChBtn");
const nextBtn = document.getElementById("nextChBtn");
prevBtn.classList.toggle("disabled", currentChIndex === 0);
prevBtn.onclick = currentChIndex > 0 ? () => { currentChIndex--; renderChapter(); } : null;
nextBtn.classList.toggle("disabled", currentChIndex === currentChapters.length - 1);
nextBtn.onclick = currentChIndex < currentChapters.length - 1 ? () => { currentChIndex++; renderChapter(); } : null;
const body = document.getElementById("readerBody");
requestAnimationFrame(() => {
const saved = localStorage.getItem("scrollpos_" + ch.id);
body.scrollTop = saved ? parseInt(saved, 10) : 0;
updateReadingProgress();
});
}
let readerScrollBound = false;
function bindReaderScroll() {
if (readerScrollBound) return;
readerScrollBound = true;
const body = document.getElementById("readerBody");
body.addEventListener("scroll", () => {
updateReadingProgress();
const ch = currentChapters[currentChIndex];
if (ch) localStorage.setItem("scrollpos_" + ch.id, body.scrollTop);
});
}
function updateReadingProgress() {
const body = document.getElementById("readerBody");
const max = body.scrollHeight - body.clientHeight;
const pct = max > 0 ? Math.min(100, (body.scrollTop / max) * 100) : 100;
document.getElementById("readingProgressBar").style.width = pct + "%";
}
function closeReader() { document.getElementById("readerModal").classList.add("hidden"); }
function setTheme(t) { document.getElementById("readerModal").className = "reader-modal " + t; }
function changeFontSize(delta) {
currentFontSize = Math.min(28, Math.max(12, currentFontSize + delta));
document.getElementById("readerChContent").style.fontSize = currentFontSize + "px";
}
function changeLineSpacing(delta) {
currentLineHeight = Math.min(3.2, Math.max(1.6, +(currentLineHeight + delta).toFixed(1)));
document.getElementById("readerChContent").style.lineHeight = currentLineHeight;
}
let newsSeenKey = "news_last_seen";
async function checkNewsDot() {
const { data } = await supabaseClient.from("news").select("created_at").order("created_at", { ascending: false }).limit(1);
const dot = document.getElementById("newsDot");
if (data && data.length) {
const lastSeen = localStorage.getItem(newsSeenKey);
dot.classList.toggle("hidden", !!lastSeen && lastSeen >= data[0].created_at);
} else {
dot.classList.add("hidden");
}
}
async function openNews() {
const { data } = await supabaseClient.from("news").select("*").order("created_at", { ascending: false });
const list = document.getElementById("newsList");
list.innerHTML = (data && data.length)
? data.map(n => `
<div class="chapter-item" style="cursor:default;flex-direction:column;align-items:flex-start;">
<strong style="color:#a78bfa;">${n.title}</strong>
<p style="color:#cbd5e1;font-size:0.85rem;margin-top:4px;">${n.content}</p>
<span style="color:#64748b;font-size:0.7rem;margin-top:6px;">${n.created_at ? n.created_at.slice(0,10) : ""}</span>
</div>`).join("")
: `<p style="color:#94a3b8;">لا توجد أخبار حالياً.</p>`;
if (data && data.length) localStorage.setItem(newsSeenKey, data[0].created_at);
document.getElementById("newsDot").classList.add("hidden");
document.getElementById("newsModal").classList.remove("hidden");
}
function closeNews() { document.getElementById("newsModal").classList.add("hidden"); }
