const defaultNews = [
    {
        id: "1",
        title: "إطلاق تحديثات جديدة في عالم التكنولوجيا والذكاء الاصطناعي",
        link: "https://news.google.com",
        date: "اليوم",
        source: "أخبار التكنولوجيا",
        description: "شهد العالم اليوم إعلانات متسارعة حول تطورات تقنيات الذكاء الاصطناعي وتطبيقاتها الجديدة في مختلف المجالات.",
        category: "تكنولوجيا"
    },
    {
        id: "2",
        title: "استعدادات مكثفة للمنافسات الرياضية العالمية المقبلة",
        link: "https://news.google.com",
        date: "اليوم",
        source: "الرياضة اليوم",
        description: "تواصل الفرق والمنتخبات استعداداتها الفنية والبدنية لخوض المباريات القادمة وسط تطلعات كبيرة للجماهير.",
        category: "رياضة"
    },
    {
        id: "3",
        title: "أسواق المال العالمية تشهد تحركات إيجابية في التداولات الأسبوعية",
        link: "https://news.google.com",
        date: "اليوم",
        source: "الاقتصاد اليوم",
        description: "سجلت المؤشرات الاقتصادية ارتفاعاً ملحوظاً مع نهاية التداولات الأسبوعية وسط تفاعلات إيجابية من المستثمرين.",
        category: "اقتصاد"
    },
    {
        id: "4",
        title: "مستجدات الأحداث العالمية والتطورات الميدانية الأخيرة",
        link: "https://news.google.com",
        date: "اليوم",
        source: "الأنباء العالمية",
        description: "متابعة مستمرة لأبرز الأحداث والتطورات على الساحة الدولية والتغطيات المباشرة لأهم الأنباء العاجلة.",
        category: "عاجل وعالمي"
    }
];

let allArticles = [];
let currentCategory = 'الكل';

async function loadNews() {
    try {
        const response = await fetch('news.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error("File not found");
        const data = await response.json();
        
        if (data.articles && data.articles.length > 0) {
            allArticles = data.articles;
            document.getElementById('lastUpdate').innerText = 'آخر تحديث تلقائي: ' + (data.updated_at || 'الآن');
        } else {
            throw new Error("No articles");
        }
    } catch (err) {
        allArticles = defaultNews;
        document.getElementById('lastUpdate').innerText = 'آخر تحديث: مباشر';
    }
    renderArticles();
}

function renderArticles() {
    const grid = document.getElementById('newsGrid');
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

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
        <article class="card">
            <div>
                <div class="card-header">
                    <span class="tag">${item.category}</span>
                    <span class="source">${item.source}</span>
                </div>
                <h3>${item.title}</h3>
                <p>${item.description}</p>
            </div>
            <div class="card-footer">
                <span class="date">${item.date}</span>
                <a href="${item.link}" target="_blank" class="read-link">قراءة الخبر الكامل ↗</a>
            </div>
        </article>
    `).join('');
}

function filterCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.categories button').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.includes(cat) || (cat === 'الكل' && btn.innerText === 'الكل'));
    });
    renderArticles();
}

if (document.getElementById('searchInput')) {
    document.getElementById('searchInput').addEventListener('input', renderArticles);
}

loadNews();
