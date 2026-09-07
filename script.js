let allNovels = [];
let allCategories = [];
let currentCategory = "all";
let currentUser = null;
let currentNovel = null;
let currentChapters = [];
let currentChIndex = 0;
let currentFontSize = 16;
let currentLineHeight = 2.2;
let currentTheme = "theme-dark";
const marginWidths = [600, 750, 950];
let currentMarginIndex = 1;
let authMode = "login";
document.addEventListener("DOMContentLoaded", async () => {
showSplashOnce();
await checkSession();
await loadCategories();
await loadNovels();
document.getElementById("searchInput").addEventListener("input", renderNovels);
loadReaderPrefs();
document.getElementById("readerBody").addEventListener("scroll", onReaderScroll);
});
function loadReaderPrefs() {
const savedTheme = localStorage.getItem("reader_theme");
if (savedTheme) setTheme(savedTheme);
const savedFont = localStorage.getItem("reader_font_size");
if (savedFont) {
currentFontSize = parseInt(savedFont);
document.getElementById("readerChContent").style.fontSize = currentFontSize + "px";
}
const savedLH = localStorage.getItem("reader_line_height");
if (savedLH) {
currentLineHeight = parseFloat(savedLH);
document.getElementById("readerChContent").style.lineHeight = currentLineHeight;
}
const savedMargin = localStorage.getItem("reader_margin_index");
if (savedMargin !== null && marginWidths[savedMargin]) {
currentMarginIndex = parseInt(savedMargin);
document.getElementById("readerBody").style.maxWidth = marginWidths[currentMarginIndex] + "px";
}
}
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
.select("*, categories(name), chapters(count)")
.order("updated_at", { ascending: false });
if (error) {
document.getElementById("novelsGrid").innerHTML = `<p style="text-align:center;grid-column:1/-1;">تعذر تحميل الروايات</p>`;
return;
}
allNovels = data || [];
renderBanner();
renderNovels();
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
filtered.forEach((n, i) => {
const chCount = n.chapters?.[0]?.count || 0;
html += `
<article class="card" onclick="openNovel('${n.id}')">
<div class="card-img-wrapper">
<img src="${n.cover_url || 'https://via.placeholder.com/300x400?text=No+Cover'}" class="card-img" alt="${n.title}">
</div>
<div class="card-content">
<span class="tag">${n.categories?.name || ""}</span>
<h3>${n.title}</h3>
<p class="author">✍️ ${n.author || "غير معروف"}</p>
<div class="card-footer">
<span>${chCount} فصل</span>
<span>👁 ${n.views || 0}</span>
</div>
</div>
</article>`;
});
grid.innerHTML = html;
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
await loadRatings();
document.getElementById("novelModal").classList.remove("hidden");
}
async function loadRatings() {
const { data } = await supabaseClient.from("ratings").select("stars, user_id").eq("novel_id", currentNovel.id);
const ratings = data || [];
const avg = ratings.length ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length : 0;
const full = Math.round(avg);
document.getElementById("ratingAvg").textContent = "★".repeat(full) + "☆".repeat(5 - full) + " (" + ratings.length + ")";
let myRating = 0;
if (currentUser) {
const mine = ratings.find(r => r.user_id === currentUser.id);
if (mine) myRating = mine.stars;
}
document.querySelectorAll("#ratingStars .star").forEach(el => {
el.classList.toggle("active", parseInt(el.dataset.star) <= myRating);
});
}
async function submitRating(stars) {
if (!currentUser) { showAuth("login"); return; }
await supabaseClient.from("ratings").upsert({
novel_id: currentNovel.id, user_id: currentUser.id, stars
}, { onConflict: "novel_id,user_id" });
await loadRatings();
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
const prevBtn = document.getElementById("prevChBtn");
const nextBtn = document.getElementById("nextChBtn");
prevBtn.classList.toggle("disabled", currentChIndex === 0);
prevBtn.onclick = currentChIndex > 0 ? () => { currentChIndex--; renderChapter(); } : null;
nextBtn.classList.toggle("disabled", currentChIndex === currentChapters.length - 1);
nextBtn.onclick = currentChIndex < currentChapters.length - 1 ? () => { currentChIndex++; renderChapter(); } : null;
const readerBody = document.getElementById("readerBody");
const savedPos = localStorage.getItem("read_pos_" + ch.id);
requestAnimationFrame(() => {
if (savedPos && parseFloat(savedPos) > 0.01) {
const max = readerBody.scrollHeight - readerBody.clientHeight;
readerBody.scrollTop = max * parseFloat(savedPos);
} else {
readerBody.scrollTop = 0;
}
onReaderScroll();
});
loadComments(ch.id);
document.getElementById("commentForm").classList.toggle("hidden", !currentUser);
document.getElementById("commentLoginMsg").classList.toggle("hidden", !!currentUser);
}
async function loadComments(chapterId) {
const { data } = await supabaseClient.from("comments").select("*").eq("chapter_id", chapterId).order("created_at", { ascending: false });
const list = document.getElementById("commentsList");
const comments = data || [];
list.innerHTML = comments.length
? comments.map(c => `
<div class="comment-item">
<span class="comment-author">${c.username}</span>
<span class="comment-date">${c.created_at ? c.created_at.slice(0,10) : ""}</span>
<div class="comment-content"></div>
</div>`).join("")
: `<p class="comment-empty">لا توجد تعليقات بعد — كن أول من يعلّق!</p>`;
list.querySelectorAll(".comment-content").forEach((el, i) => { el.textContent = comments[i].content; });
document.getElementById("commentInput").value = "";
}
async function submitComment() {
if (!currentUser) { showAuth("login"); return; }
const input = document.getElementById("commentInput");
const content = input.value.trim();
if (!content) return;
const ch = currentChapters[currentChIndex];
await supabaseClient.from("comments").insert({
chapter_id: ch.id, novel_id: currentNovel.id, user_id: currentUser.id,
username: currentUser.username, content
});
await loadComments(ch.id);
}
function openReportModal() {
if (!currentUser) { showAuth("login"); return; }
document.getElementById("reportMsg").textContent = "";
document.getElementById("reportNote").value = "";
document.getElementById("reportModal").classList.remove("hidden");
}
function closeReportModal() { document.getElementById("reportModal").classList.add("hidden"); }
async function submitReport() {
const reason = document.getElementById("reportReason").value;
const note = document.getElementById("reportNote").value.trim();
const ch = currentChapters[currentChIndex];
const msg = document.getElementById("reportMsg");
const { error } = await supabaseClient.from("reports").insert({
chapter_id: ch.id, novel_id: currentNovel.id, user_id: currentUser.id,
username: currentUser.username, reason, note: note || null
});
if (error) { msg.style.color = "#f87171"; msg.textContent = "تعذر إرسال البلاغ، حاول مرة ثانية"; return; }
msg.style.color = "#4ade80";
msg.textContent = "تم إرسال البلاغ، شكراً لك";
setTimeout(closeReportModal, 1200);
}
function onReaderScroll() {
const el = document.getElementById("readerBody");
const max = el.scrollHeight - el.clientHeight;
const percent = max > 0 ? Math.min(1, el.scrollTop / max) : 0;
const bar = document.getElementById("readerProgressBar");
if (bar) bar.style.width = (percent * 100) + "%";
if (currentChapters.length && currentChapters[currentChIndex]) {
localStorage.setItem("read_pos_" + currentChapters[currentChIndex].id, percent.toFixed(4));
}
}
function closeReader() { document.getElementById("readerModal").classList.add("hidden"); }
function setTheme(t) {
currentTheme = t;
const modal = document.getElementById("readerModal");
const wasFocus = modal.classList.contains("focus-mode");
modal.className = "reader-modal " + t + (wasFocus ? " focus-mode" : "");
localStorage.setItem("reader_theme", t);
}
function changeFontSize(delta) {
currentFontSize = Math.min(28, Math.max(12, currentFontSize + delta));
document.getElementById("readerChContent").style.fontSize = currentFontSize + "px";
localStorage.setItem("reader_font_size", currentFontSize);
}
function changeLineHeight(delta) {
currentLineHeight = Math.min(3.0, Math.max(1.4, +(currentLineHeight + delta).toFixed(1)));
document.getElementById("readerChContent").style.lineHeight = currentLineHeight;
localStorage.setItem("reader_line_height", currentLineHeight);
}
function cycleMargin() {
currentMarginIndex = (currentMarginIndex + 1) % marginWidths.length;
document.getElementById("readerBody").style.maxWidth = marginWidths[currentMarginIndex] + "px";
localStorage.setItem("reader_margin_index", currentMarginIndex);
}
function toggleFocusMode() {
document.getElementById("readerModal").classList.toggle("focus-mode");
}
function handleReaderTap(event) {
if (event.target.closest(".reader-ad") || event.target.closest(".reader-toolbar")) return;
if (window.getSelection().toString().length > 0) return;
toggleFocusMode();
}
