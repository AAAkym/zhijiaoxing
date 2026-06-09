import requests
import json
import time

s = requests.Session()

r = s.post('http://localhost:5000/login', json={'username': 'teacher1', 'password': 'teacher123'})
print('Login status:', r.status_code)
print('Login response:', r.text[:300])

r = s.post('http://localhost:5000/api/resource-generation/personalized', json={
    'course_id': 1,
    'topic': 'Python基础',
    'student_profile': {'major': '', 'weaknesses': [], 'learning_needs': []},
    'resource_types': ['mindmap'],
}, timeout=180)
print('\nGenerate status:', r.status_code)
try:
    data = r.json()
    if 'error' in data:
        print('Error:', data['error'])
    elif 'resources' in data:
        resources = data['resources']
        print('Resource keys:', list(resources.keys()))
        if 'mindmap' in resources:
            mm = resources['mindmap']
            if isinstance(mm, dict):
                print('Mindmap keys:', list(mm.keys()))
                if 'root' in mm:
                    print('Root name:', mm['root'].get('name'))
                    print('Children count:', len(mm['root'].get('children', [])))
                else:
                    print('No root key. Preview:', json.dumps(mm, ensure_ascii=False)[:300])
        if data.get('errors'):
            print('Errors:', data['errors'])
        if data.get('completeness_report'):
            print('Completeness:', data['completeness_report'])
    else:
        print('Keys:', list(data.keys()) if isinstance(data, dict) else type(data))
except Exception as e:
    print('Parse error:', e)
    print('Response text:', r.text[:500])
