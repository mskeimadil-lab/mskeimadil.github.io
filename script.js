let allArticles = [];
let currentCategory = 'الكل';

async function loadNews() {
    try {
        const response = await fetch('news.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error("File missing");
        const data = await response.json();
        
        allArticles = data.articles || [];
        document.getElementById('lastUpdate').innerText = 'آخر تحديث أوتوماتيكي: ' + (data.updated_at || 'الآن');
        renderArticles();
    } catch (err) {
        document.getElementById('newsGrid').innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 40px;">جاري استدعاء الأخبار والوسائط...</p>';
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
        grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 40px;">لا توجد أخبار مطابقة.</p>';
        return;
    }

    let html = '';
    filtered.forEach((item, index) => {
        html += `
            <article class="card" onclick="openArticle('${item.id}')">
                <div class="card-img-wrapper">
                    <img src="${item.image}" alt="${item.title}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800'">
                    ${item.is_video ? '<span class="video-badge">🎬 تقرير مصور</span>' : ''}
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <span class="tag">${item.category}</span>
                        <span class="source">${item.source}</span>
                    </div>
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                    <div class="card-footer">
                        <span class="date">${item.date}</span>
                        <span class="read-more">عرض التقرير الكامل 👁️</span>
                    </div>
                </div>
            </article>
        `;

        // إدراج الإعلان المباشر بعد كل 3 أخبار
        if ((index + 1) % 3 === 0) {
            html += `
                <div class="ad-card">
                    <span class="ad-tag">إعلان إخباري</span>
                    <script async="async" data-cfasync="false" src="https://pl31174834.profitableratecpmnetwork.com/16862be26721288d37d8fc1d7d7cfba0/invoke.js"></script>
                    <div id="container-16862be26721288d37d8fc1d7d7cfba0"></div>
                </div>
            `;
        }
    });

    grid.innerHTML = html;
}

function openArticle(id) {
    const article = allArticles.find(a => a.id === id);
    if (!article) return;

    document.getElementById('modalCategory').innerText = article.category;
    document.getElementById('modalSource').innerText = article.source;
    document.getElementById('modalTitle').innerText = article.title;
    document.getElementById('modalDate').innerText = 'تاريخ التقرير: ' + article.date;
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
