import os, time
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
t = time.time()
from fastembed import TextEmbedding
emb = TextEmbedding(model_name="BAAI/bge-small-zh-v1.5")
print("MODEL_OK", round(time.time()-t, 1))
vecs = list(emb.embed(["函数的可变参数默认值陷阱", "课程是 Python 程序设计", "列表排序 sort 用法"]))
print("DIM", len(vecs[0]))
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
c = QdrantClient(path="./.qdrant-test")
c.recreate_collection("t", vectors_config=VectorParams(size=len(vecs[0]), distance=Distance.COSINE))
c.upsert("t", [PointStruct(id=i, vector=v.tolist()) for i, v in enumerate(vecs)])
q = list(emb.embed(["为什么函数默认值会累积变化"]))[0]
for p in c.query_points("t", query=q.tolist(), limit=3).points:
    print("HIT", p.id, round(p.score, 4))
