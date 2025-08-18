import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2] / "py"))
from ai_engine.tools import rag_search as rs


def test_rag_search_builds_filter(monkeypatch):
    called = {}

    class DummyIndex:
        def query(self, **kwargs):
            called['kwargs'] = kwargs
            return {'matches': []}

    class DummyPinecone:
        def __init__(self, api_key, environment):
            called['api_key'] = api_key
            called['environment'] = environment
        def Index(self, name):
            called['index_name'] = name
            return DummyIndex()

    monkeypatch.setattr(rs, "Pinecone", DummyPinecone)
    monkeypatch.setattr(rs, "embed_query", lambda q: [0.1, 0.2])
    rs.PINECONE_API_KEY = "test-key"
    rs.PINECONE_ENV = "test-env"

    args = {
        "query": "hello",
        "state": "Karnataka",
        "district": "Mysore",
        "crop": "Rice",
    }
    result = rs.rag_search(args)
    assert called['kwargs']["filter"] == {
        "state": "karnataka",
        "district": "mysore",
        "crop": "rice",
    }
    assert result == {"data": [], "source_stamp": "pinecone_rag"}

