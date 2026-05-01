import { useState } from "react";

const CATEGORIES = ["野菜", "肉・魚", "乳製品・卵", "調味料", "冷凍食品", "その他"];
const STATUS_OPTIONS = ["在庫あり", "残り少ない", "在庫なし"];
const STATUS_COLORS = {
  "在庫あり":   { bg: "#d4f5e2", text: "#1a7a45", dot: "#2ecc71" },
  "残り少ない": { bg: "#fff3cd", text: "#856404", dot: "#f0ad4e" },
  "在庫なし":   { bg: "#fde8e8", text: "#8b1a1a", dot: "#e74c3c" },
};

const INITIAL_ITEMS = [
  { id: 1, name: "新玉ねぎ", category: "野菜", status: "残り少ない", memo: "半玉残り", updatedAt: new Date().toLocaleDateString("ja-JP") },
  { id: 2, name: "豚ロース薄切り", category: "肉・魚", status: "在庫なし", memo: "次回コストコで補充予定", updatedAt: new Date().toLocaleDateString("ja-JP") },
];

export default function App() {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem("pantry-items");
    return saved ? JSON.parse(saved) : INITIAL_ITEMS;
  });
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: "", category: "野菜", status: "在庫あり", memo: "" });
  const [nextId, setNextId] = useState(() => {
    const saved = localStorage.getItem("pantry-items");
    return saved ? Math.max(...JSON.parse(saved).map(i => i.id)) + 1 : 3;
  });
  const [activeTab, setActiveTab] = useState("すべて");
  const [search, setSearch] = useState("");

  const save = (newItems) => {
    setItems(newItems);
    localStorage.setItem("pantry-items", JSON.stringify(newItems));
  };

  const filtered = items.filter(item => {
    const matchCat = activeTab === "すべて" || item.category === activeTab;
    const matchSearch = item.name.includes(search) || item.memo.includes(search);
    return matchCat && matchSearch;
  });

  const statusCount = (s) => items.filter(i => i.status === s).length;

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: "", category: "野菜", status: "在庫あり", memo: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditTarget(item.id);
    setForm({ name: item.name, category: item.category, status: item.status, memo: item.memo });
    setShowModal(true);
  };

  const saveForm = () => {
    if (!form.name.trim()) return;
    const today = new Date().toLocaleDateString("ja-JP");
    let newItems;
    if (editTarget) {
      newItems = items.map(i => i.id === editTarget ? { ...i, ...form, updatedAt: today } : i);
    } else {
      newItems = [...items, { id: nextId, ...form, updatedAt: today }];
      setNextId(nextId + 1);
    }
    save(newItems);
    setShowModal(false);
  };

  const remove = (id) => save(items.filter(i => i.id !== id));

  const cycleStatus = (id) => {
    save(items.map(i => {
      if (i.id !== id) return i;
      const idx = STATUS_OPTIONS.indexOf(i.status);
      return { ...i, status: STATUS_OPTIONS[(idx + 1) % 3], updatedAt: new Date().toLocaleDateString("ja-JP") };
    }));
  };

  return (
    <div style={{ fontFamily: "'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif", background: "#f7f5f0", minHeight: "100vh" }}>
      <div style={{ background: "#2d2926", padding: "20px 24px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 700, margin: "0 auto" }}>
          <div>
            <div style={{ color: "#c8b99a", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>Kitchen Stock</div>
            <div style={{ color: "#f5f0e8", fontSize: 22, fontWeight: 700 }}>食材在庫管理</div>
          </div>
          <button onClick={openAdd} style={{ background: "#e8a838", color: "#fff", border: "none", borderRadius: 24, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>＋ 追加</button>
        </div>
        <div style={{ maxWidth: 700, margin: "14px auto 0", display: "flex", gap: 12 }}>
          {STATUS_OPTIONS.map(s => (
            <div key={s} style={{ flex: 1, background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ color: STATUS_COLORS[s].dot, fontSize: 18, fontWeight: 700 }}>{statusCount(s)}</div>
              <div style={{ color: "#c8b99a", fontSize: 10, marginTop: 1 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 16px 80px" }}>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="食材を検索..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 36px", border: "1.5px solid #e0dbd2", borderRadius: 12, fontSize: 14, background: "#fff", outline: "none", color: "#333" }} />
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
          {["すべて", ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)} style={{ background: activeTab === cat ? "#2d2926" : "#fff", color: activeTab === cat ? "#f5f0e8" : "#666", border: "1.5px solid " + (activeTab === cat ? "#2d2926" : "#ddd"), borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: activeTab === cat ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{cat}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#bbb", fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🥬</div>
            食材が登録されていません
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(item => {
              const sc = STATUS_COLORS[item.status];
              return (
                <div key={item.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12, borderLeft: `4px solid ${sc.dot}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#2d2926" }}>{item.name}</span>
                      <span style={{ fontSize: 11, background: "#f0ede8", color: "#888", borderRadius: 8, padding: "2px 8px" }}>{item.category}</span>
                    </div>
                    {item.memo && <div style={{ fontSize: 12, color: "#999", marginTop: 3 }}>{item.memo}</div>}
                    <div style={{ fontSize: 11, color: "#ccc", marginTop: 4 }}>更新: {item.updatedAt}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <button onClick={() => cycleStatus(item.id)} style={{ background: sc.bg, color: sc.text, border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>● {item.status}</button>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(item)} style={{ background: "#f5f0e8", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#666" }}>編集</button>
                      <button onClick={() => remove(item.id)} style={{ background: "#fde8e8", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#c0392b" }}>削除</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 700, boxSizing: "border-box" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: "#2d2926" }}>{editTarget ? "食材を編集" : "食材を追加"}</div>
            <label style={lbl}>食材名</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="例：キャベツ" style={inp} />
            <label style={lbl}>カテゴリ</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={inp}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <label style={lbl}>ステータス</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} style={inp}>
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <label style={lbl}>メモ（任意）</label>
            <input value={form.memo} onChange={e => setForm({...form, memo: e.target.value})} placeholder="例：冷凍中、コストコで買う" style={inp} />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, border: "1.5px solid #ddd", borderRadius: 12, background: "#fff", fontSize: 14, cursor: "pointer" }}>キャンセル</button>
              <button onClick={saveForm} style={{ flex: 2, padding: 12, border: "none", borderRadius: 12, background: "#2d2926", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{editTarget ? "保存する" : "追加する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, color: "#888", marginBottom: 4, marginTop: 12, fontWeight: 600 };
const inp = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1.5px solid #e0dbd2", borderRadius: 10, fontSize: 14, outline: "none", background: "#fafaf8", color: "#333" };
