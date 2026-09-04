import urllib.request
import xml.etree.ElementTree as ET
import json
import re
from datetime import datetime

FEEDS = {
    "عاجل وعالمي": "https://news.google.com/rss?hl=ar&gl=MA&ceid=MA:ar",
    "تكنولوجيا": "https://news.google.com/rss/search?q=%D8%AA%D9%83%D9%86%D9%88%D9%8D%D9%88%D8%AC%D9%8A%D8%A7&hl=ar&gl=MA&ceid=MA:ar",
    "رياضة": "https://news.google.com/rss/search?q=%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9&hl=ar&gl=MA&ceid=MA:ar",
    "اقتصاد": "https://news.google.com/rss/search?q=%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF&hl=ar&gl=MA&ceid=MA:ar"
}

def clean_html(raw_html):
    cleanr = re.compile('<.*?>')
    return re.sub(cleanr, '', raw_html)

all_news = []
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

for category, url in FEEDS.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            root = ET.fromstring(xml_data)
            
            for item in root.findall('.//item')[:12]:
                title = item.find('title').text if item.find('title') is not None else ""
                link = item.find('link').text if item.find('link') is not None else "#"
                pubDate = item.find('pubDate').text if item.find('pubDate') is not None else ""
                desc = item.find('description').text if item.find('description') is not None else ""
                source = item.find('source').text if item.find('source') is not None else "مصدر إخباري"
                
                clean_desc = clean_html(desc) if desc else ""
                
                all_news.append({
                    "id": str(abs(hash(title))),
                    "title": title,
                    "link": link,
                    "date": pubDate[:16] if pubDate else "",
                    "source": source,
                    "description": clean_desc[:180] + "..." if len(clean_desc) > 180 else clean_desc,
                    "category": category
                })
    except Exception as e:
        print(f"Error fetching {category}: {e}")

output = {
    "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    "articles": all_news
}

with open("news.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"تم جلب وحفظ {len(all_news)} خبر بنجاح!")
