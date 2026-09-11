let allNovels = [];
let allCategories = [];
let currentCategory = "all";
let currentUser = null;
let currentNovel = null;
let currentChapters = [];
let currentChIndex = 0;
let currentFontSize = 16;
let currentLineHeight = 2.2;
const RANKS = [
{ threshold: 200, name: "قارب ملكي", img: "ranks/rank1.png" },
{ threshold: 1500, name: "قارئ إمبراطور", img: "ranks/rank2.png" },
{ threshold: 4500, name: "قارئ أسطوري", img: "ranks/rank3.png" },
{ threshold: 7500, name: "قارئ سلف", img: "ranks/rank4.png" },
{ threshold: 10500, name: "سيد الطائفة", img: "ranks/rank5.png" },
{ threshold: 13500, name: "الخالد", img: "ranks/rank6.png" },
{ threshold: 16500, name: "الوصي", img: "ranks/rank7.png" },
{ threshold: 19500, name: "العاهل الكوني", img: "ranks/rank8.png" },
{ threshold: 20000, name: "سيد الأكوان", img: "ranks/rank9.png" },
{ threshold: 30000, name: "الأصل الأول", img: "ranks/rank10.png" }
];
const FOUNDER_USERNAMES = ["adil", "gmzoro394"];
function getRank(count) {
let current = null;
for (const r of RANKS) { if (count >= r.threshold) current = r; }
return current;
}
function updateRankBadge() {
const badge = document.getElementById("userRankBadge");
if (!badge) return;
if (!currentUser) { badge.classList.add("hidden"); return; }
const uname = (currentUser.username || "").toLowerCase();
const img = document.getElementById("rankBadgeImg");
const avatarImg = document.getElementById("rankBadgeAvatar");
const nameEl = document.getElementById("rankBadgeName");
avatarImg.src = currentUser.avatar_url || "";
avatarImg.style.display = currentUser.avatar_url ? "block" : "none";
badge.classList.remove("founder-badge");
if (FOUNDER_USERNAMES.includes(uname)) {
img.src = "ranks/emperor.png";
img.style.display = "block";
nameEl.textContent = "أدمن";
badge.classList.add("founder-badge");
badge.classList.remove("hidden");
} else {
const rank = getRank(currentUser.chapters_read_count || 0);
if (rank) {
img.src = rank.img;
img.style.display = "block";
nameEl.textContent = rank.name;
badge.classList.remove("hidden");
} else {
badge.classList.add("hidden");
}
}
}
async function trackChapterRead(chapterId) {
if (!currentUser) return;
const { data } = await supabaseClient.from("read_chapters")
.upsert({ user_id: currentUser.id, chapter_id: chapterId }, { onConflict: "user_id,chapter_id", ignoreDuplicates: true })
.select();
if (data && data.length) {
currentUser.chapters_read_count = (currentUser.chapters_read_count || 0) + 1;
await supabaseClient.from("profiles").update({ chapters_read_count: currentUser.chapters_read_count }).eq("id", currentUser.id);
updateRankBadge();
}
}
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
document.getElementById("sbLoginBtn").classList.toggle("hidden", !!currentUser);
document.getElementById("sbSignupBtn").classList.toggle("hidden", !!currentUser);
document.getElementById("sbLogoutBtn").classList.toggle("hidden", !currentUser);
document.getElementById("sbSettingsLink").classList.toggle("hidden", !currentUser);
document.getElementById("sbAdminLink").classList.toggle("hidden", !currentUser);
const uname = currentUser ? (currentUser.username || "").toLowerCase() : "";
document.getElementById("sbAdminExtras").classList.toggle("hidden", !FOUNDER_USERNAMES.includes(uname));
const sidebarUser = document.getElementById("sidebarUser");
if (currentUser) {
sidebarUser.textContent = "مرحباً، " + currentUser.username + (currentUser.is_admin ? " (أدمن)" : "");
sidebarUser.classList.remove("hidden");
} else {
sidebarUser.classList.add("hidden");
}
updateRankBadge();
}
function toggleSidebar() {
document.getElementById("sidebar").classList.toggle("open");
document.getElementById("sidebarOverlay").classList.toggle("hidden");
}
function closeSidebar() {
document.getElementById("sidebar").classList.remove("open");
document.getElementById("sidebarOverlay").classList.add("hidden");
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
renderNovels();
}
async function logout() {
await supabaseClient.auth.signOut();
currentUser = null;
updateAuthUI();
renderNovels();
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
let favoriteIds = [];
function renderNovels() {
const grid = document.getElementById("novelsGrid");
const term = document.getElementById("searchInput").value.toLowerCase();
const isTrending = currentCategory === "trending";
const isFavorites = currentCategory === "favorites";
let filtered = allNovels.filter(n => {
let matchesCat;
if (isFavorites) matchesCat = favoriteIds.includes(n.id);
else if (isTrending) matchesCat = true;
else matchesCat = currentCategory === "all" || n.category_id === currentCategory;
const matchesSearch = n.title.toLowerCase().includes(term) || (n.author || "").toLowerCase().includes(term);
return matchesCat && matchesSearch;
});
if (isTrending) {
filtered = filtered.slice().sort((a, b) => (b.views || 0) - (a.views || 0));
}
if (filtered.length === 0) {
grid.innerHTML = `<p style="text-align:center;grid-column:1/-1;padding:40px;">${isFavorites ? "مفضلتك فارغة — أضف روايات من زر ☆ داخل صفحة الرواية" : "لا توجد روايات مطابقة بعد."}</p>`;
return;
}
const isAdmin = currentUser && currentUser.is_admin;
let html = "";
filtered.forEach((n) => {
const chapters = (n.chapters || []).slice().sort((a, b) => b.chapter_number - a.chapter_number).slice(0, 3);
html += `
<div class="novel-row" onclick="openNovel('${n.id}')">
<div class="novel-row-cover">
<img src="${n.cover_url || 'https://via.placeholder.com/300x400?text=No+Cover'}" alt="${n.title}">
${isAdmin ? `<button class="cover-edit-btn" onclick="event.stopPropagation(); triggerCoverFile('${n.id}')">+</button>` : ""}
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
let coverEditNovelId = null;
function triggerCoverFile(novelId) {
coverEditNovelId = novelId;
document.getElementById("coverFileInput").click();
}
async function handleCoverFileChange(e) {
const file = e.target.files[0];
if (!file || !coverEditNovelId) return;
const path = `${Date.now()}_${file.name}`;
const { error: upErr } = await supabaseClient.storage.from("covers").upload(path, file);
if (upErr) { alert("فشل رفع الصورة: " + upErr.message); e.target.value = ""; return; }
const { data: pub } = supabaseClient.storage.from("covers").getPublicUrl(path);
const { error } = await supabaseClient.from("novels").update({ cover_url: pub.publicUrl }).eq("id", coverEditNovelId);
e.target.value = "";
if (error) { alert("خطأ: " + error.message); return; }
await loadNovels();
}
function goHome() {
currentCategory = "all";
document.querySelectorAll(".categories button").forEach((b, i) => b.classList.toggle("active", i === 0));
renderNovels();
window.scrollTo({ top: 0, behavior: "smooth" });
}
function goAccount() {
if (currentUser) location.href = "settings.html";
else showAuth("login");
}
function comingSoon(name) {
alert(name + " قريباً 🚀");
}
async function openLibrary() {
if (!currentUser) { showAuth("login"); return; }
const { data } = await supabaseClient.from("favorites").select("novel_id").eq("user_id", currentUser.id);
favoriteIds = (data || []).map(f => f.novel_id);
currentCategory = "favorites";
document.querySelectorAll(".categories button").forEach(b => b.classList.remove("active"));
renderNovels();
window.scrollTo({ top: 0, behavior: "smooth" });
}
async function reportChapter() {
const reason = prompt("وش المشكلة بهذا الفصل؟ (خطأ بالنص، ترجمة سيئة، محتوى مخالف...)");
if (!reason) return;
const ch = currentChapters[currentChIndex];
await supabaseClient.from("reports").insert({
novel_id: currentNovel.id,
chapter_id: ch.id,
reason
});
alert("تم إرسال البلاغ، شكراً لك ✅");
}
async function loadComments(chapterId) {
const { data } = await supabaseClient.from("comments")
.select("*, profiles(username, avatar_url)")
.eq("chapter_id", chapterId)
.order("created_at", { ascending: false });
const list = document.getElementById("commentsList");
if (!list) return;
list.innerHTML = (data && data.length) ? data.map(c => `
<div class="comment-item">
${c.profiles?.avatar_url ? `<img class="comment-avatar" src="${c.profiles.avatar_url}">` : `<div class="comment-avatar-placeholder">👤</div>`}
<div class="comment-body">
<div class="comment-head">
<strong>${c.profiles?.username || "مستخدم"}</strong>
<span class="comment-time">${timeAgo(c.created_at)}</span>
</div>
<p>${c.content}</p>
</div>
</div>`).join("") : `<p style="color:#64748b;font-size:0.85rem;">لا توجد تعليقات بعد، كن أول من يعلّق!</p>`;
}
async function submitComment() {
if (!currentUser) { showAuth("login"); return; }
const input = document.getElementById("commentInput");
const content = input.value.trim();
if (!content) return;
const ch = currentChapters[currentChIndex];
const { error } = await supabaseClient.from("comments").insert({
chapter_id: ch.id, novel_id: currentNovel.id, user_id: currentUser.id, content, username: currentUser.username
});
if (error) { alert("خطأ: " + error.message); return; }
input.value = "";
await loadComments(ch.id);
}
let chapterContentCache = {};
async function openChapterDirect(novelId, chapterId) {
currentNovel = allNovels.find(n => n.id === novelId);
if (!currentNovel) return;
supabaseClient.rpc('increment_views', { target_id: novelId });
const { data: chapters } = await supabaseClient
.from("chapters").select("id, chapter_number, title").eq("novel_id", novelId).order("chapter_number");
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
.from("chapters").select("id, chapter_number, title").eq("novel_id", id).order("chapter_number");
currentChapters = chapters || [];
renderChaptersList();
await updateFavButton();
document.getElementById("novelModal").classList.remove("hidden");
}
function renderChaptersList() {
const list = document.getElementById("chaptersList");
if (!currentChapters.length) {
list.innerHTML = `<p style="color:#94a3b8;">لا توجد فصول منشورة بعد.</p>`;
return;
}
const groupSize = 150;
if (currentChapters.length <= groupSize) {
list.innerHTML = currentChapters.map((c, i) => `
<div class="chapter-item" onclick="openChapter(${i})">
<span>الفصل ${c.chapter_number}: ${c.title}</span>
<span>➔</span>
</div>`).join("");
return;
}
let html = "";
for (let g = 0; g < currentChapters.length; g += groupSize) {
const group = currentChapters.slice(g, g + groupSize);
const start = group[0].chapter_number;
const end = group[group.length - 1].chapter_number;
const gi = g / groupSize;
html += `
<div class="chapter-group">
<div class="chapter-group-header" onclick="toggleChapterGroup(${gi})">
<span>الفصول من ${start} إلى ${end}</span>
<span class="chevron" id="chevron-${gi}">▾</span>
</div>
<div class="chapter-group-body hidden" id="group-${gi}">
${group.map((c) => `
<div class="chapter-item" onclick="openChapter(${currentChapters.indexOf(c)})">
<span>الفصل ${c.chapter_number}: ${c.title}</span>
<span>➔</span>
</div>`).join("")}
</div>
</div>`;
}
list.innerHTML = html;
}
function toggleChapterGroup(gi) {
const body = document.getElementById("group-" + gi);
body.classList.toggle("hidden");
document.getElementById("chevron-" + gi).textContent = body.classList.contains("hidden") ? "▾" : "▴";
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
document.getElementById("readerModal").classList.remove("hidden");
document.getElementById("novelModal").classList.add("hidden");
await renderChapter();
if (currentUser) {
await supabaseClient.from("reading_progress").upsert({
user_id: currentUser.id,
novel_id: currentNovel.id,
chapter_id: currentChapters[index].id,
updated_at: new Date().toISOString()
});
trackChapterRead(currentChapters[index].id);
}
}
async function renderChapter() {
const ch = currentChapters[currentChIndex];
document.getElementById("readerNovelTitle").textContent = currentNovel.title;
document.getElementById("readerChTitle").textContent = "الفصل " + ch.chapter_number + ": " + ch.title;
document.getElementById("readerChContent").textContent = "جاري تحميل الفصل...";
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
if (!chapterContentCache[ch.id]) {
const { data } = await supabaseClient.from("chapters").select("content").eq("id", ch.id).single();
chapterContentCache[ch.id] = data?.content || "";
}
if (currentChapters[currentChIndex]?.id !== ch.id) return;
document.getElementById("readerChContent").textContent = chapterContentCache[ch.id];
loadComments(ch.id);
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
