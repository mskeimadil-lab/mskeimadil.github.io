import re

def clean_text(content_box):
    if not content_box:
        return ""

    # 1. إزالة العناصر البرمجية والجداول والأزرار
    for junk in content_box.find_all(['script', 'style', 'iframe', 'form', 'table', 'button', 'ul', 'ol']):
        junk.decompose()

    # إزالة العناصر المحتوية على كلاسات الإعلانات والتبرعات
    for junk_class in content_box.find_all(class_=re.compile(r'ad|banner|donate|vip|app|notice|share|download', re.I)):
        junk_class.decompose()

    text = content_box.get_text(separator='\n')

    # 2. تنظيف النصوص الإعلانية والروابط ورسائل التبرع
    patterns_to_remove = [
        r'دعم .* لزيادة تنزيل الفصول.*',
        r'أنواع التبرعات المتوفرة.*',
        r'تنزيل \d+ فصول?.*',
        r'USD \d+\.\d+\$?',
        r'حمل التطبيق لقراءة أسرع.*',
        r'حمله من هنا من جوجل بلاي.*',
        r'Google Play',
        r'تجربة قراءة أفضل مع.*',
        r'تصفح الموقع والتطبيق بدون إعلانات.*',
        r'تحميل الفصول وقراءتها بدون إنترنت.*',
        r'قاموس شخصي ووضع التركيز.*',
        r'علامة التوثيق وبارج ذهبي.*',
        r'رفع \d+ صورة في التعليقات.*',
        r'تجميع الخبرة أسرع.*',
        r'هذا التطبيق يسرق من موقع.*',
        r'[a-f0-9]{8,12}',  # إزالة أكواد الحماية المائية
        r'المترجم\s*:.*',
        r'تاريخ النشر\s*:.*',
        r'عدد الكلمات\s*:.*',
        r'المجلد \d+\s*:.*'
    ]

    for pattern in patterns_to_remove:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)

    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return '\n\n'.join(lines)

