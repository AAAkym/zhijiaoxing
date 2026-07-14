import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.models.user import db
from src.models.course import TeachingContent
from flask import Flask
from src.config import get_config

app = Flask(__name__)
app.config.from_object(get_config())
db.init_app(app)

with app.app_context():
    items = TeachingContent.query.filter_by(content_type='ppt').all()
    if not items:
        print("No PPT records found")
    for t in items:
        meta = json.loads(t.content) if t.content else {}
        print(f"id={t.id} title={t.title}")
        print(f"  file_name={meta.get('file_name', 'MISSING')}")
        url = meta.get('original_ppt_url', '')
        print(f"  original_ppt_url={url[:100] if url else 'MISSING'}")
        print()
