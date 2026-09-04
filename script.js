const defaultNovels = [
    {
        id: '1',
        title: 'رواية تجريبية',
        author: 'الكاتب',
        desc: 'وصف للرواية التجريبية الأولى.',
        chapters: [
            { id: 'c1', title: 'الفصل الأول: البداية', content: 'هذا هو نص الفصل الأول من الرواية.' }
        ]
    }
];

let novels = JSON.parse(localStorage.getItem('app_novels_data')) || defaultNovels;
let apiKey = localStorage.getItem('app_gemini_key') || '';
let currentNovelId = null;

function saveNovels() {
    localStorage.setItem('app_novels_data', JSON.stringify(novels));
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewName + 'View').classList.remove('hidden');
    if (viewName === 'home') renderNovels();
}

function openApiKeyModal() {
    const key = prompt('أدخل مفتاح Gemini API الخاص بك:', apiKey);
    if (key !== null) {
        apiKey = key.trim();
        localStorage.setItem('app_gemini_key', apiKey);
        alert('تم حفظ المفتاح بنجاح!');
    }
}

function renderNovels() {
    const grid = document.getElementById('novelsGrid');
    grid.innerHTML = novels.map(n => `
        <div class="card" onclick="openNovelDetail('${n.id}')">
            <h3>${n.title}</h3>
            <p class="author">بقلم: ${n.author}</p>
            <p>${n.desc.substring(0, 60)}...</p>
        </div>
    `).join('');
}

document.getElementById('novelForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const newNovel = {
        id: Date.now().toString(),
        title: document.getElementById('novelTitle').value,
        author: document.getElementById('novelAuthor').value,
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

    document.getElementById('detailTitle').innerText = novel.title;
    document.getElementById('detailAuthor').innerText = 'بقلم: ' + novel.author;
    document.getElementById('detailDesc').innerText = novel.desc;

    const chaptersList = document.getElementById('chaptersList');
    chaptersList.innerHTML = novel.chapters.length ? novel.chapters.map(c => `
        <div class="chapter-item" onclick="openReader('${c.id}')">${c.title}</div>
    `).join('') : '<p>لا توجد فصول بعد.</p>';

    switchView('detail');
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

async function generateChapterWithAI() {
    if (!apiKey) {
        alert('يرجى إضافة مفتاح Gemini API أولاً من الزر في الأعلى!');
        return;
    }

    const chapterTitle = document.getElementById('chapterTitle').value || 'فصل جديد';
    const promptText = document.getElementById('aiPrompt').value;
    const novel = novels.find(n => n.id === currentNovelId);

    if (!promptText) {
        alert('يرجى كتابة وصف أو أفكار للفصل!');
        return;
    }

    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.innerText = 'جاري التوليد بواسطة Gemini...';

    try {
        const systemPrompt = `أنت كاتب روايات محترف. اكتب فصلاً ليكون جزءاً من رواية بعنوان "${novel.title}". وصف الفصل المطلوب: ${promptText}. اكتب أحداثاً مشوقة ومفصلة باللغة العربية.`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
            })
        });

        const data = await response.json();
        const aiContent = data.candidates[0].content.parts[0].text;

        novel.chapters.push({
            id: Date.now().toString(),
            title: chapterTitle,
            content: aiContent
        });

        saveNovels();
        alert('تم توليد الفصل وإضافته بنجاح!');
        document.getElementById('chapterTitle').value = '';
        document.getElementById('aiPrompt').value = '';
        openNovelDetail(currentNovelId);
    } catch (err) {
        alert('حدث خطأ أثناء التوليد: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'توليد الفصل بالذكاء الاصطناعي';
    }
}

renderNovels();
