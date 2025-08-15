import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2] / "py"))
import ai_engine.tools.build_index as bi


def test_load_and_upsert_tags(tmp_path, monkeypatch):
    data = [{"state": "Punjab", "district": "Amritsar", "crop": "Wheat", "info": "x"}]
    file_path = tmp_path / "punjab_amritsar.json"
    file_path.write_text(str(data).replace("'", '"'))

    chunks = bi.load_and_chunk_json(file_path)
    assert chunks[0]["tags"] == {"state": "punjab", "district": "amritsar", "crop": "wheat"}

    captured = {}

    class DummyIndex:
        def upsert(self, vectors):
            captured["vectors"] = vectors

    monkeypatch.setattr(bi, "embed_query", lambda text: [0.0, 0.0])
    bi.embed_and_upsert(chunks, DummyIndex())

    meta = captured["vectors"][0]["metadata"]
    assert meta["state"] == "punjab"
    assert meta["district"] == "amritsar"
    assert meta["crop"] == "wheat"

