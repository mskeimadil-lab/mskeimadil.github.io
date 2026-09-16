ef fetch_auto_novels():
    """جلب كافة الروايات تلقائياً مع خيار احتياطي في حال عدم التحميل"""
    url = "https://cenele.com/cont/"
    novels = []
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        for a in soup.find_all('a', href=True):
            href = a['href'].strip()
            full_url = href if href.startswith('http') else f"https://cenele.com{href}"
            full_url = full_url.rstrip('/')
            
            # التقاط أي رابط رواية فرعي داخل /cont/
            if '/cont/' in full_url and full_url != 'https://cenele.com/cont':
                n_id = str(uuid.uuid5(uuid.NAMESPACE_URL, full_url))
                if not any(n['url'] == full_url for n in novels):
                    novels.append({'id': n_id, 'url': full_url})
    except Exception as e:
        print(f"⚠️ خطأ أثناء الفحص التلقائي: {e}")

    # قائمة احتياطية للروايات في حال كانت الصفحات تعتمد كلياً على الجافاسكريبت
    if not novels:
        print("⚠️ جاري تفعيل القائمة الأساسية للروايات...")
        fallback_urls = [
            "https://cenele.com/cont/book-eating-magician",
            "https://cenele.com/levels"
        ]
        for u in fallback_urls:
            novels.append({'id': str(uuid.uuid5(uuid.NAMESPACE_URL, u)), 'url': u})

    return novels

