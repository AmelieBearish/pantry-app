import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const CATEGORIES = ["野菜", "肉・魚", "乳製品・卵", "調味料", "冷凍食品", "その他"];
const STATUS_OPTIONS = ["在庫あり", "残り少ない", "在庫なし"];
const STATUS_COLORS = {
  "在庫あり":   { bg: "#d4f5e2", text: "#1a7a45", dot: "#2ecc71" },
  "残り少ない": { bg: "#fff3cd", text: "#856404", dot: "#f0ad4e" },
  "在庫なし":   { bg: "#fde8e8", text: "#8b1a1a", dot: "#e74c3c" },
};
const COLORS = {
  bg: "#f4f7f0",
  white: "#ffffff",
  accent: "#5a9e3a",
  accentDark: "#3a6b28",
  text: "#3b2a1a",
  textLight: "#888",
  border: "#e0dbd2",
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: "", category: "野菜", status: "在庫あり", memo: "" });
  const [activeTab, setActiveTab] = useState("すべて");
  const [search, setSearch] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    const ref = collection(db, "users", user.uid, "pantry");
    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
    });
    return unsubscribe;
  }, [user]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = () => signOut(auth);

  const saveItem = async (itemData) => {
    const ref = editTarget
      ? doc(db, "users", user.uid, "pantry", editTarget)
      : doc(collection(db, "users", user.uid, "pantry"));
    await setDoc(ref, {
      ...itemData,
      updatedAt: new Date().toLocaleDateString("ja-JP"),
      updatedTimestamp: serverTimestamp(),
    });
  };

  const removeItem = async (id) => {
    await deleteDoc(doc(db, "users", user.uid, "pantry", id));
  };

  const cycleStatus = async (item) => {
    const idx = STATUS_OPTIONS.indexOf(item.status);
    const ref = doc(db, "users", user.uid, "pantry", item.id);
    await setDoc(ref, {
      ...item,
      status: STATUS_OPTIONS[(idx + 1) % 3],
      updatedAt: new Date().toLocaleDateString("ja-JP"),
      updatedTimestamp: serverTimestamp(),
    });
  };

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: "", category: "野菜", status: "在庫あり", memo: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditTarget(item.id);
    setForm({ name: item.name, category: item.category, status: item.status, memo: item.memo || "" });
    setShowModal(true);
  };

  const saveForm = async () => {
    if (!form.name.trim()) return;
    await saveItem(form);
    setShowModal(false);
  };

  const filtered = items.filter(item => {
    const matchCat = activeTab === "すべて" || item.category === activeTab;
    const q = search.trim();
    const matchSearch = !q || item.name.includes(q) || (item.memo || "").includes(q);
    return matchCat && matchSearch;
  });

  const statusCount = (s) => items.filter(i => i.status === s).length;

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textLight }}>
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <img src="/logo.png" alt="もぐポケ" style={{ height: 80, marginBottom: 8 }} />
        <div style={{ color: COLORS.textLight, fontSize: 14 }}>ログインしてください</div>
        <button onClick={login} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 24, padding: "12px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Googleでログイン
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif", background: COLORS.bg, minHeight: "100vh" }}>
      <div style={{ background: COLORS.white, borderBottom: `1px solid ${COLORS.border}`, padding: "12px 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 700, margin: "0 auto", position: "relative" }}>
          <div style={{ width: 40 }} />
          <img src="/logo.png" alt="もぐポケ" style={{ height: 64 }} />
          <div style={{ position: "relative", width: 40, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowMenu(v => !v)}
              style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: COLORS.textLight, padding: 4 }}
            >
              •••
            </button>
            {showMenu && (
              <div
                style={{ position: "absolute", top: 36, right: 0, background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.10)", minWidth: 160, zIndex: 20 }}
                onClick={() => setShowMenu(false)}
              >
                <button onClick={openAdd} style={{ display: "block", width: "100%", padding: "12px 20px", background: "none", border: "none", textAlign: "left", fontSize: 14, cursor: "pointer", color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>
                  ＋ 食材を追加
                </button>
                <button onClick={logout} style={{ display: "block", width: "100%", padding: "12px 20px", background: "none", border: "none", textAlign: "left", fontSize: 14, cursor: "pointer", color: COLORS.textLight }}>
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
        <div style={{ maxWidth: 700, margin: "12px auto 0", display: "flex", gap: 12 }}>
          {STATUS_OPTIONS.map(s => (
            <div key={s} style={{ flex: 1, background: COLORS.bg, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ color: STATUS_COLORS[s].dot, fontSize: 18, fontWeight: 700 }}>{statusCount(s)}</div>
              <div style={{ color: COLORS.textLight, fontSize: 10, marginTop: 1 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 16px 100px" }}>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.textLight, fontSize: 16 }}>🔍</span>
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="食材を検索..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 36px", border: `1.5px solid ${COLORS.border}`, borderRadius: 12, fontSize: 14, background: COLORS.white, outline: "none", color: COLORS.text }} />
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
          {["すべて", ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)} style={{ background: activeTab === cat ? COLORS.accentDark : COLORS.white, color: activeTab === cat ? "#fff" : "#666", border: "1.5px solid " + (activeTab === cat ? COLORS.accentDark : "#ddd"), borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: activeTab === cat ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              {cat}
            </button>
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
                <div key={item.id} style={{ background: COLORS.white, borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12, borderLeft: `4px solid ${sc.dot}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{item.name}</span>
                      <span style={{ fontSize: 11, background: COLORS.bg, color: COLORS.textLight, borderRadius: 8, padding: "2px 8px" }}>{item.category}</span>
                    </div>
                    {item.memo && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 3 }}>{item.memo}</div>}
                    <div style={{ fontSize: 11, color: "#ccc", marginTop: 4 }}>更新: {item.updatedAt}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <button onClick={() => cycleStatus(item)} style={{ background: sc.bg, color: sc.text, border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>● {item.status}</button>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(item)} style={{ background: COLORS.bg, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: COLORS.textLight }}>編集</button>
                      <button onClick={() => removeItem(item.id)} style={{ background: "#fde8e8", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#c0392b" }}>削除</button>
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
          <div style={{ background: COLORS.white, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 700, boxSizing: "border-box" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: COLORS.text }}>{editTarget ? "食材を編集" : "食材を追加"}</div>
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
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, border: `1.5px solid ${COLORS.border}`, borderRadius: 12, background: COLORS.white, fontSize: 14, cursor: "pointer", color: COLORS.text }}>キャンセル</button>
              <button onClick={saveForm} style={{ flex: 2, padding: 12, border: "none", borderRadius: 12, background: COLORS.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{editTarget ? "保存する" : "追加する"}</button>
            </div>
          </div>
        </div>
      )}

      {/* BottomNav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: COLORS.white, borderTop: `1px solid ${COLORS.border}`, display: "flex", zIndex: 10 }}>
        <button
          onClick={() => { searchRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: COLORS.textLight, fontSize: 10 }}
        >
          <span style={{ fontSize: 20 }}>🔍</span>
          探す
        </button>
        <button
          onClick={openAdd}
          style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: COLORS.accent, fontSize: 10 }}
        >
          <span style={{ fontSize: 20 }}>＋</span>
          追加
        </button>
        <button
          onClick={logout}
          style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: COLORS.textLight, fontSize: 10 }}
        >
          <span style={{ fontSize: 20 }}>👤</span>
          ログアウト
        </button>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, color: "#888", marginBottom: 4, marginTop: 12, fontWeight: 600 };
const inp = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1.5px solid #e0dbd2", borderRadius: 10, fontSize: 14, outline: "none", background: "#fafaf8", color: "#333" };
