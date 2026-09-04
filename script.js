const defaultNovels = [
    {
        id: '1',
        title: 'رواية تجريبية',
        author: 'الكاتب',
        cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500',
        desc: 'هذه رواية تجريبية لعرض التنسيق وتجربة إضافة الفصول والصور.',
        chapters: [
            { id: 'c1', title: 'الفصل الأول: البداية', content: 'هذا هو نص الفصل الأول من الرواية.' }
        ]
    }
];

let novels = JSON.parse(localStorage.getItem('app_novels_data')) || defaultNovels;
let currentNovelId = null;

function saveNovels() {
    localStorage.setItem('app_novels_data', JSON.stringify(novels));
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewName + 'View').classList.remove('hidden');
    if (viewName === 'home') renderNovels();
}

function renderNovels() {
    const grid = document.getElementById('novelsGrid');
    grid.innerHTML = novels.map(n => `
        <div class="card" onclick="openNovelDetail('${n.id}')">
            <img src="${n.cover || 'https://via.placeholder.com/200x280?text=No+Cover'}" alt="${n.title}" class="card-img" onerror="this.src='https://via.placeholder.com/200x280?text=No+Cover'">
            <div class="card-content">
                <h3>${n.title}</h3>
                <p class="author">بقلم: ${n.author}</p>
                <p>${n.desc.substring(0, 50)}...</p>
            </div>
        </div>
    `).join('');
}

document.getElementById('novelForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const newNovel = {
        id: Date.now().toString(),
        title: document.getElementById('novelTitle').value,
        author: document.getElementById('novelAuthor').value,
        cover: document.getElementById('novelCover').value,
        desc: document.getElementById('novelDesc').value,
        chapters: []
    };
    novels.push(newNovel);
    saveNovels();
    e.target.reset();
    switchView('home');
});

function openNovelDetail(id) {
    currentNovelId = id;
    const novel = novels.find(n => n.id === id);
    if (!novel) return;

    document.getElementById('detailCover').src = novel.cover || 'https://via.placeholder.com/200x280?text=No+Cover';
    document.getElementById('detailTitle').innerText = novel.title;
    document.getElementById('detailAuthor').innerText = 'بقلم: ' + novel.author;
    document.getElementById('detailDesc').innerText = novel.desc;

    // ربط زر حذف الرواية
    const deleteNovelBtn = document.getElementById('deleteNovelBtn');
    deleteNovelBtn.onclick = () => deleteNovel(id);

    const chaptersList = document.getElementById('chaptersList');
    chaptersList.innerHTML = novel.chapters.length ? novel.chapters.map(c => `
        <div class="chapter-item" onclick="openReader('${c.id}')">
            <span>${c.title}</span>
            <button class="btn-danger-sm" onclick="deleteChapter('${c.id}', event)">حذف 🗑️</button>
        </div>
    `).join('') : '<p>لا توجد فصول مضافة بعد.</p>';

    switchView('detail');
}

function deleteNovel(id) {
    if (confirm('هل أنت تأكد من رغبتك في حذف هذه الرواية بالكامل؟')) {
        novels = novels.filter(n => n.id !== id);
        saveNovels();
        switchView('home');
    }
}

function deleteChapter(chapterId, event) {
    event.stopPropagation(); // منع فتح الفصل عند الضغط على زر الحذف
    if (confirm('هل أنت تأكد من حذف هذا الفصل؟')) {
        const novel = novels.find(n => n.id === currentNovelId);
        if (novel) {
            novel.chapters = novel.chapters.filter(c => c.id !== chapterId);
            saveNovels();
            openNovelDetail(currentNovelId);
        }
    }
}

function addChapterManually() {
    const title = document.getElementById('chapterTitle').value.trim();
    const content = document.getElementById('chapterContent').value.trim();
    const novel = novels.find(n => n.id === currentNovelId);

    if (!title || !content) {
        alert('يرجى كتابة عنوان الفصل ونصه!');
        return;
    }

    novel.chapters.push({
        id: Date.now().toString(),
        title: title,
        content: content
    });

    saveNovels();
    document.getElementById('chapterTitle').value = '';
    document.getElementById('chapterContent').value = '';
    alert('تم حفظ الفصل بنجاح!');
    openNovelDetail(currentNovelId);
}

function openReader(chapterId) {
    const novel = novels.find(n => n.id === currentNovelId);
    const chapter = novel.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    document.getElementById('readerChapterTitle').innerText = chapter.title;
    document.getElementById('readerContent').innerText = chapter.content;
    switchView('reader');
}

let currentFontSize = 18;
function changeFontSize(delta) {
    currentFontSize += delta;
    document.getElementById('readerContent').style.fontSize = currentFontSize + 'px';
}

renderNovels();
