let allArticles = [];
let currentCategory = 'الكل';

async function loadNews() {
    try {
        const response = await fetch('news.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error("File missing");
        const data = await response.json();
        
        allArticles = data.articles || [];
        document.getElementById('lastUpdate').innerText = 'آخر تحديث تلقائي: ' + (data.updated_at || 'الآن');
        renderArticles();
    } catch (err) {
        document.getElementById('newsGrid').innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 40px;">جاري إعداد وتحميل الأخبار...</p>';
    }
}

function renderArticles() {
    const grid = document.getElementById('newsGrid');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    const filtered = allArticles.filter(item => {
        const matchesCategory = (currentCategory === 'الكل' || item.category === currentCategory);
        const matchesSearch = item.title.toLowerCase().includes(searchTerm) || item.description.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 40px;">لا توجد أخبار مطابقة للبحث حالياً.</p>';
        return;
    }

    grid.innerHTML = filtered.map(item => `
        <article class="card" onclick="openArticle('${item.id}')">
            <div class="card-img-wrapper">
                <img src="${item.image}" alt="${item.title}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800'">
            </div>
            <div class="card-content">
                <div class="card-header">
                    <span class="tag">${item.category}</span>
                    <span class="source">${item.source}</span>
                </div>
                <h3>${item.title}</h3>
                <p>${item.description.substring(0, 90)}...</p>
                <div class="card-footer">
                    <span class="date">${item.date}</span>
                    <span class="read-more">اقرأ الخبر 📄</span>
                </div>
            </div>
        </article>
    `).join('');
}

function openArticle(id) {
    const article = allArticles.find(a => a.id === id);
    if (!article) return;

    document.getElementById('modalCategory').innerText = article.category;
    document.getElementById('modalSource').innerText = article.source;
    document.getElementById('modalTitle').innerText = article.title;
    document.getElementById('modalDate').innerText = 'تاريخ النشر: ' + article.date;
    document.getElementById('modalImage').src = article.image;
    document.getElementById('modalDesc').innerText = article.description;
    document.getElementById('modalSourceLink').href = article.link;

    document.getElementById('articleModal').classList.remove('hidden');
}

function closeArticle() {
    document.getElementById('articleModal').classList.add('hidden');
}

function filterCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.categories button').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.includes(cat) || (cat === 'الكل' && btn.innerText === 'الكل'));
    });
    renderArticles();
}

document.getElementById('searchInput').addEventListener('input', renderArticles);

loadNews();
