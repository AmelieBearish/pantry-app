import { useState, useEffect, useRef } from "react";
import { Search, Plus, LogOut, ShoppingCart } from "lucide-react";
import { auth, db, subscribeShoppingList, addShoppingItem, updateShoppingItemChecked, deleteShoppingItem, updateShoppingItem } from "./firebase";
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "firebase/auth";
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
  const [form, setForm] = useState({ name: "", category: "野菜", status: "在庫あり", memos: [""], expiryDate: "", frozen: false });
  const [activeTab, setActiveTab] = useState("すべて");
  const [search, setSearch] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [sortKey, setSortKey] = useState("updatedAt");
  const [isPC, setIsPC] = useState(window.innerWidth >= 768);
  const searchRef = useRef(null);
  const [page, setPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("page") === "shopping" ? "shopping" : "pantry";
  });
  const [shoppingList, setShoppingList] = useState([]);
  const [showAddShoppingModal, setShowAddShoppingModal] = useState(false);
  const [shoppingForm, setShoppingForm] = useState({ name: "", amount: "", registerToPantry: false, category: "野菜" });
  const [editShoppingTarget, setEditShoppingTarget] = useState(null);
  const [editShoppingForm, setEditShoppingForm] = useState({ amount: "", memo: "" });
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSettings, setExportSettings] = useState(() => {
  try {
    const saved = localStorage.getItem("exportSettings");
    return saved ? JSON.parse(saved) : { people: "2人", unit: "あり", mood: "何でも", time: "こだわらない" };
  } catch {
    return { people: "2人", unit: "あり", mood: "何でも", time: "こだわらない" };
  }
});
  const [showEditShoppingModal, setShowEditShoppingModal] = useState(false);


  useEffect(() => {
    const handleResize = () => setIsPC(window.innerWidth >= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    getRedirectResult(auth).then((result) => {
      console.log("redirectResult:", result);
    }).catch((err) => {
      console.error("redirectError:", err);
    });
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

  useEffect(() => {
    if (!user) { setShoppingList([]); return; }
    const unsubscribe = subscribeShoppingList(user.uid, setShoppingList);
    return unsubscribe;
  }, [user]);
  useEffect(() => {
    localStorage.setItem("exportSettings", JSON.stringify(exportSettings));
  }, [exportSettings]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === "auth/popup-blocked") {
        await signInWithRedirect(auth, provider);
      }
    }
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
    if (!window.confirm("この食材を削除しますか？")) return;
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

  const toggleFrozen = async (item) => {
    const ref = doc(db, "users", user.uid, "pantry", item.id);
    await setDoc(ref, {
      ...item,
      frozen: !item.frozen,
      updatedAt: new Date().toLocaleDateString("ja-JP"),
      updatedTimestamp: serverTimestamp(),
    });
  };

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: "", category: "野菜", status: "在庫あり", memos: [""], expiryDate: "", frozen: false });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditTarget(item.id);
    const rawMemo = item.memo;
    const memos = Array.isArray(rawMemo) ? rawMemo : (rawMemo ? [rawMemo] : [""]);
    setForm({ name: item.name, category: item.category, status: item.status, memos: memos.length > 0 ? memos : [""], expiryDate: item.expiryDate || "", frozen: item.frozen || false });
    setShowModal(true);
  };

  const saveForm = async () => {
    if (!form.name.trim()) return;
    const filteredMemos = form.memos.filter(m => m.trim() !== "");
    await saveItem({ ...form, memo: filteredMemos });
    setShowModal(false);
  };

  const filtered = items.filter(item => {
    const matchCat = activeTab === "すべて" || item.category === activeTab;
    const q = search.trim();
    const matchSearch = !q || item.name.includes(q) || (item.memo || "").includes(q);
    return matchCat && matchSearch;
  }).sort((a, b) => {
    const aOut = a.status === "在庫なし";
    const bOut = b.status === "在庫なし";
    if (aOut !== bOut) return aOut ? 1 : -1;
    if (sortKey === "updatedAt") {
      const aTs = a.updatedTimestamp?.seconds ?? 0;
      const bTs = b.updatedTimestamp?.seconds ?? 0;
      return bTs - aTs;
    }
    if (sortKey === "expiryDate") {
      const aD = a.expiryDate || "9999-99-99";
      const bD = b.expiryDate || "9999-99-99";
      return aD < bD ? -1 : aD > bD ? 1 : 0;
    }
    if (sortKey === "name") {
      return a.name.localeCompare(b.name, "ja");
    }
    return 0;
  });

  const statusCount = (s) => items.filter(i => i.status === s).length;

  const getExpiryInfo = (expiryDate) => {
    if (!expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { type: "expired", label: "期限切れ" };
    if (diffDays === 0) return { type: "danger", label: "今日まで" };
    if (diffDays === 1) return { type: "danger", label: "明日まで" };
    if (diffDays <= 3) return { type: "warning", label: `あと${diffDays}日` };
    return { type: "normal", label: expiryDate };
  };

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

  const outOfStockItems = items.filter(i => i.status === "在庫なし");
  const shoppingListIds = new Set(
    shoppingList
      .filter(s => s.recipeId === null && outOfStockItems.some(o => o.name === s.name))
      .map(s => s.name)
  );

  const getPantryStatus = (name) => {
    const found = items.find(i => i.name.includes(name) || name.includes(i.name));
    return found ? found.status : null;
  };

  const handleAddToShoppingList = async (item) => {
    await addShoppingItem(user.uid, { name: item.name, amount: "", recipeId: null, recipeName: null });
  };

  const handleToggleChecked = async (item) => {
    await updateShoppingItemChecked(user.uid, item.id, !item.checked);
  };

  const handleDeleteShoppingItem = async (id) => {
    await deleteShoppingItem(user.uid, id);
  };

  const handlePurchaseComplete = async () => {
    const checkedItems = shoppingList.filter(i => i.checked);
    if (checkedItems.length === 0) return;
    if (!window.confirm(`チェックした${checkedItems.length}件を購入済みにしますか？`)) return;
    for (const item of checkedItems) {
      await deleteShoppingItem(user.uid, item.id);
      const pantryItem = items.find(i => i.name.includes(item.name) || item.name.includes(i.name));
      if (pantryItem) {
        const ref = doc(db, "users", user.uid, "pantry", pantryItem.id);
        await setDoc(ref, {
          ...pantryItem,
          status: "在庫あり",
          updatedAt: new Date().toLocaleDateString("ja-JP"),
          updatedTimestamp: serverTimestamp(),
        });
      } else if (item.registerToPantry && item.category) {
        const newRef = doc(collection(db, "users", user.uid, "pantry"));
        await setDoc(newRef, {
          name: item.name,
          category: item.category,
          status: "在庫あり",
          memo: "",
          expiryDate: "",
          updatedAt: new Date().toLocaleDateString("ja-JP"),
          updatedTimestamp: serverTimestamp(),
        });
      }
    }
  };

  const handleOpenEditShopping = (item) => {
    setEditShoppingTarget(item.id);
    setEditShoppingForm({ amount: item.amount || "", memo: item.memo || "" });
    setShowEditShoppingModal(true);
  };

  const handleSaveEditShopping = async () => {
    if (!editShoppingTarget) return;
    await updateShoppingItem(user.uid, editShoppingTarget, {
      amount: editShoppingForm.amount,
      memo: editShoppingForm.memo,
    });
    setShowEditShoppingModal(false);
    setEditShoppingTarget(null);
  };

  const handleAddToShoppingFromCard = async (item) => {
    const already = shoppingList.some(s => s.name === item.name);
    if (already) {
      window.alert(`「${item.name}」はすでにリストに追加されています`);
      return;
    }
    await addShoppingItem(user.uid, { name: item.name, amount: "", recipeId: null, recipeName: null });
  };
    const buildExportText = () => {
    const unitText = exportSettings.unit === "あり" ? "大さじ小さじ表記あり" : "大さじ小さじ表記なし";
    const moodText = exportSettings.mood === "何でも" ? "今日は何でも良い気分です" : `今日は${exportSettings.mood}気分です`;
    const timeText = exportSettings.time === "こだわらない" ? "" : `調理時間は${exportSettings.time}でお願いします。`;
    const header = `${exportSettings.people}分、${unitText}、${moodText}。\n以下の食材を使ったレシピを提案してください。${timeText ? "\n" + timeText : ""}`;
    const activeItems = items.filter(i => i.status !== "在庫なし");
    const lines = CATEGORIES.map(cat => {
      const catItems = activeItems.filter(i => i.category === cat);
      if (catItems.length === 0) return null;
      const names = catItems.map(i => i.frozen ? `${i.name}（冷凍）` : i.name).join("、");
      return `【${cat}】\n・${names}`;
    }).filter(Boolean);
    return header + "\n" + lines.join("\n");
  };
  const handleAddShoppingManual = async () => {
    if (!shoppingForm.name.trim()) return;
    await addShoppingItem(user.uid, {
      name: shoppingForm.name,
      amount: shoppingForm.amount,
      recipeId: null,
      recipeName: null,
      registerToPantry: shoppingForm.registerToPantry,
      category: shoppingForm.registerToPantry ? shoppingForm.category : null,
    });
    setShoppingForm({ name: "", amount: "", registerToPantry: false, category: "野菜" });
    setShowAddShoppingModal(false);
  };

  if (page === "shopping") {
    const checkedCount = shoppingList.filter(i => i.checked).length;
    return (
    <div style={{ fontFamily: "'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif", background: COLORS.bg, minHeight: "100vh" }}>
      <style>{`
        @media (min-width: 768px) { .bottom-nav { display: none !important; } }
        @media (max-width: 767px) { .pc-menu { display: none !important; } }
      `}</style>
      <div style={{ background: COLORS.white, borderBottom: `1px solid ${COLORS.border}`, padding: "12px 24px", position: "sticky", top: 0, zIndex: 10 }}>
         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 700, margin: "0 auto", position: "relative" }}>
            <div style={{ width: 40 }} />
            <img src="/logo.png" alt="もぐポケ" onClick={() => setPage("pantry")} style={{ height: 100, cursor: "pointer" }} />
            <div style={{ position: "relative", width: 40, display: "flex", justifyContent: "flex-end" }}>
              <div className="pc-menu" style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
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
                    <button onClick={() => { setPage("shopping"); setShowMenu(false); }} style={{ display: "block", width: "100%", padding: "12px 20px", background: "none", border: "none", textAlign: "left", fontSize: 14, cursor: "pointer", color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>
                      🛒 買い物リスト
                    </button>
                    <button onClick={logout} style={{ display: "block", width: "100%", padding: "12px 20px", background: "none", border: "none", textAlign: "left", fontSize: 14, cursor: "pointer", color: COLORS.textLight }}>
                      ログアウト
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 16px 100px" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text, marginBottom: 16 }}>🛒 買い物リスト</div>

          {/* 在庫なしエリア */}
          {outOfStockItems.length > 0 && (
            <div style={{ background: COLORS.white, borderRadius: 14, padding: "14px 16px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>🧊 在庫なしの食材</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {outOfStockItems.map(item => {
                  const added = shoppingListIds.has(item.name);
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: added ? "#f5f5f5" : COLORS.bg, borderRadius: 10 }}>
                      <span style={{ fontSize: 14, color: added ? COLORS.textLight : COLORS.text }}>{item.name}</span>
                      {added ? (
                        <span style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700 }}>追加済み ✓</span>
                      ) : (
                        <button onClick={() => handleAddToShoppingList(item)} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>＋ リストに追加</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 買い物リスト本体 */}
          <div style={{ background: COLORS.white, borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>📋 リスト</div>
            {shoppingList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#bbb", fontSize: 13 }}>リストはまだ空です</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {shoppingList.map(item => {
                  const status = getPantryStatus(item.name);
                  const borderColor = status === "在庫あり" ? "#2ecc71" : status === "残り少ない" ? "#f0ad4e" : "#e74c3c";
                  const bgColor = status === "在庫あり" ? "#d4f5e2" : status === "残り少ない" ? "#fff3cd" : "#fde8e8";
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: item.checked ? "#f5f5f5" : bgColor, borderRadius: 10, borderLeft: `4px solid ${item.checked ? "#ccc" : borderColor}` }}>
                      <input type="checkbox" checked={item.checked} onChange={() => handleToggleChecked(item)} style={{ width: 18, height: 18, cursor: "pointer", accentColor: COLORS.accent, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: item.checked ? COLORS.textLight : COLORS.text, textDecoration: item.checked ? "line-through" : "none" }}>
                          {item.name}{item.amount ? `　${item.amount}` : ""}
                        </div>
                        {item.recipeName && (
                          <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>📖 {item.recipeName}</div>
                        )}
                        {item.registerToPantry && (
                          <div style={{ fontSize: 11, color: COLORS.accent, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                            📦
                            <select
                              value={item.category || "その他"}
                              onChange={e => updateShoppingItem(user.uid, item.id, { category: e.target.value })}
                              style={{ fontSize: 11, color: COLORS.accent, border: "none", background: "transparent", fontWeight: 700, cursor: "pointer", padding: 0, outline: "none" }}
                            >
                              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                            ・購入後に在庫登録
                          </div>
                        )}
                        {item.memo && (
                          <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>📝 {item.memo}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => handleOpenEditShopping(item)} style={{ background: COLORS.bg, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: COLORS.textLight }}>編集</button>
                        <button onClick={() => handleDeleteShoppingItem(item.id)} style={{ background: "#fde8e8", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#c0392b" }}>削除</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={() => setShowAddShoppingModal(true)} style={{ width: "100%", marginTop: 14, padding: "10px 0", background: COLORS.bg, border: `1.5px dashed ${COLORS.border}`, borderRadius: 10, fontSize: 13, color: COLORS.textLight, cursor: "pointer" }}>
              ＋ 手動で追加
            </button>

            {checkedCount > 0 && (
              <button onClick={handlePurchaseComplete} style={{ width: "100%", marginTop: 10, padding: "12px 0", background: COLORS.accent, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                購入完了（{checkedCount}件）→
              </button>
            )}
          </div>
        </div>

       {/* 編集モーダル */}
        {showEditShoppingModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={e => e.target === e.currentTarget && setShowEditShoppingModal(false)}>
            <div style={{ background: COLORS.white, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 700, boxSizing: "border-box" }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: COLORS.text }}>アイテムを編集</div>
              <label style={lbl}>数量（任意）</label>
              <input value={editShoppingForm.amount} onChange={e => setEditShoppingForm({ ...editShoppingForm, amount: e.target.value })} placeholder="例：2個" style={inp} />
              <label style={lbl}>メモ（任意）</label>
              <input value={editShoppingForm.memo} onChange={e => setEditShoppingForm({...editShoppingForm, memo: e.target.value})} placeholder="例：安い方を買う" style={inp} />
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setShowEditShoppingModal(false)} style={{ flex: 1, padding: 12, border: `1.5px solid ${COLORS.border}`, borderRadius: 12, background: COLORS.white, fontSize: 14, cursor: "pointer", color: COLORS.text }}>キャンセル</button>
                <button onClick={handleSaveEditShopping} style={{ flex: 2, padding: 12, border: "none", borderRadius: 12, background: COLORS.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>保存する</button>
              </div>
            </div>
          </div>
        )}

        {/* 食材追加モーダル */}
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
              <label style={lbl}>期限（任意）</label>
              <input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} style={inp} />
              <label style={lbl}>メモ（任意）</label>
              <input value={form.memo} onChange={e => setForm({...form, memo: e.target.value})} placeholder="例：冷凍中、コストコで買う" style={inp} />
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, border: `1.5px solid ${COLORS.border}`, borderRadius: 12, background: COLORS.white, fontSize: 14, cursor: "pointer", color: COLORS.text }}>キャンセル</button>
                <button onClick={saveForm} style={{ flex: 2, padding: 12, border: "none", borderRadius: 12, background: COLORS.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{editTarget ? "保存する" : "追加する"}</button>
              </div>
            </div>
          </div>
        )}

        {/* 手動追加モーダル */}
        {showAddShoppingModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={e => e.target === e.currentTarget && setShowAddShoppingModal(false)}>
            <div style={{ background: COLORS.white, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 700, boxSizing: "border-box" }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: COLORS.text }}>アイテムを追加</div>
              <label style={lbl}>アイテム名</label>
              <input value={shoppingForm.name} onChange={e => setShoppingForm({ ...shoppingForm, name: e.target.value })} placeholder="例：トイレットペーパー" style={inp} />
              <label style={lbl}>数量（任意）</label>
              <input value={shoppingForm.amount} onChange={e => setShoppingForm({ ...shoppingForm, amount: e.target.value })} placeholder="例：1袋" style={inp} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "12px 14px", background: COLORS.bg, borderRadius: 10 }}>
                <input type="checkbox" id="registerToPantry" checked={shoppingForm.registerToPantry} onChange={e => setShoppingForm({ ...shoppingForm, registerToPantry: e.target.checked })} style={{ width: 18, height: 18, cursor: "pointer", accentColor: COLORS.accent, flexShrink: 0 }} />
                <label htmlFor="registerToPantry" style={{ fontSize: 13, color: COLORS.text, cursor: "pointer", fontWeight: 600 }}>もぐポケに登録する</label>
              </div>
              {shoppingForm.registerToPantry && (
                <div>
                  <label style={lbl}>カテゴリ</label>
                  <select value={shoppingForm.category} onChange={e => setShoppingForm({ ...shoppingForm, category: e.target.value })} style={inp}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setShowAddShoppingModal(false)} style={{ flex: 1, padding: 12, border: `1.5px solid ${COLORS.border}`, borderRadius: 12, background: COLORS.white, fontSize: 14, cursor: "pointer", color: COLORS.text }}>キャンセル</button>
                <button onClick={handleAddShoppingManual} style={{ flex: 2, padding: 12, border: "none", borderRadius: 12, background: COLORS.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>追加する</button>
              </div>
          </div>
        </div>
      )}

     {/* BottomNav */}
      <div className="bottom-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: COLORS.white, borderTop: `1px solid ${COLORS.border}`, display: "flex", zIndex: 10 }}>
        <button
          onClick={() => { setPage("pantry"); searchRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: page === "pantry" ? COLORS.accent : COLORS.textLight, fontSize: 10 }}
        >
          <Search size={20} color={page === "pantry" ? COLORS.accent : COLORS.textLight} />
            探す
          </button>
          <button
            onClick={openAdd}
            style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: COLORS.textLight, fontSize: 10 }}
          >
            <Plus size={20} color={COLORS.textLight} />
            追加
          </button>
          <button
            onClick={() => setPage("shopping")}
            style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: COLORS.accent, fontSize: 10 }}
          >
            <ShoppingCart size={20} color={COLORS.accent} />
            買い物
          </button>
          <button
            onClick={logout}
            style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: COLORS.textLight, fontSize: 10 }}
          >
            <LogOut size={20} color={COLORS.textLight} />
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif", background: COLORS.bg, minHeight: "100vh" }}>
      <style>{`
        @media (min-width: 768px) { .bottom-nav { display: none !important; } }
        @media (max-width: 767px) { .pc-menu { display: none !important; } }
      `}</style>
      <div style={{ background: COLORS.white, borderBottom: `1px solid ${COLORS.border}`, padding: "12px 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 700, margin: "0 auto", position: "relative" }}>
          <div style={{ width: 40 }} />
          <img src="/logo.png" alt="もぐポケ" onClick={() => setPage("pantry")} style={{ height: 100, cursor: "pointer" }} />
          <div style={{ position: "relative", width: 40, display: "flex", justifyContent: "flex-end" }}>
            <div className="pc-menu" style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
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
                <button onClick={() => { setPage("shopping"); setShowMenu(false); }} style={{ display: "block", width: "100%", padding: "12px 20px", background: "none", border: "none", textAlign: "left", fontSize: 14, cursor: "pointer", color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>
                  🛒 買い物リスト
                </button>
                <button onClick={logout} style={{ display: "block", width: "100%", padding: "12px 20px", background: "none", border: "none", textAlign: "left", fontSize: 14, cursor: "pointer", color: COLORS.textLight }}>
                  ログアウト
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 700, margin: "12px auto 0", display: "flex", gap: 12, alignItems: "center" }}>
          {STATUS_OPTIONS.map(s => (
            <div key={s} style={{ flex: 1, background: COLORS.bg, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ color: STATUS_COLORS[s].dot, fontSize: 18, fontWeight: 700 }}>{statusCount(s)}</div>
              <div style={{ color: COLORS.textLight, fontSize: 10, marginTop: 1 }}>{s}</div>
            </div>
          ))}
          <button
            onClick={() => setShowExportModal(true)}
            style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            📤 レシピ相談
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 16px 100px" }}>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.textLight, fontSize: 16 }}>🔍</span>
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="食材を検索..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 36px", border: `1.5px solid ${COLORS.border}`, borderRadius: 12, fontSize: 14, background: COLORS.white, outline: "none", color: COLORS.text }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, flex: 1 }}>
          {["すべて", ...CATEGORIES].map(cat => {
            const count = cat === "すべて"
              ? items.filter(i => i.status === "在庫あり" || i.status === "残り少ない").length
              : items.filter(i => i.category === cat && (i.status === "在庫あり" || i.status === "残り少ない")).length;
            const label = count > 0 ? `${cat} (${count})` : cat;
            return (
              <button key={cat} onClick={() => setActiveTab(cat)} style={{ background: activeTab === cat ? COLORS.accentDark : COLORS.white, color: activeTab === cat ? "#fff" : "#666", border: "1.5px solid " + (activeTab === cat ? COLORS.accentDark : "#ddd"), borderRadius: 20, padding: "6px 10px", fontSize: 12, fontWeight: activeTab === cat ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                {label}
              </button>
            );
          })}
        </div>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            style={{ background: "#fff", border: "1.5px solid #e0dbd2", borderRadius: 8, padding: "4px 8px", fontSize: 11, color: "#5a9e3a", fontWeight: 700, cursor: "pointer", flexShrink: 0, outline: "none" }}
          >
            <option value="updatedAt">更新日順</option>
            <option value="expiryDate">期限順</option>
            <option value="name">名前順</option>
          </select>
        </div>

        {(() => {
          const alertItems = items.filter(item => {
            const exp = getExpiryInfo(item.expiryDate);
            return exp && (exp.type === "expired" || exp.type === "danger");
          });
          if (alertItems.length === 0) return null;
          return (
            <div style={{ background: "#fff5f5", border: "0.5px solid #f5c6c6", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#c0392b", marginBottom: 8 }}>⚠️ 要確認</div>
              {alertItems.map(item => {
                const exp = getExpiryInfo(item.expiryDate);
                const sc = STATUS_COLORS[item.status];
                const isExpired = exp.type === "expired";
                return (
                  <div key={item.id} style={{ background: isExpired ? "#f0f0f0" : COLORS.white, borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: `3px solid ${isExpired ? "#ccc" : "#e74c3c"}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isExpired ? "#aaa" : COLORS.text }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: isExpired ? "#aaa" : "#e74c3c", fontWeight: isExpired ? 400 : 700 }}>{isExpired ? "期限切れ" : `● ${exp.label}`}</div>
                    </div>
                    <div style={{ fontSize: 11, background: isExpired ? "#eee" : sc.bg, color: isExpired ? "#aaa" : sc.text, borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>● {item.status}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}

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
                <div key={item.id} style={{ background: getExpiryInfo(item.expiryDate)?.type === "expired" ? "#f0f0f0" : COLORS.white, borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12, borderLeft: `4px solid ${sc.dot}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: getExpiryInfo(item.expiryDate)?.type === "expired" ? "#aaa" : COLORS.text }}>{item.name}</span>
                      <span style={{ fontSize: 11, background: COLORS.bg, color: COLORS.textLight, borderRadius: 8, padding: "2px 8px" }}>{item.category}</span>
                    </div>
                    {(() => {
                      const memoArr = Array.isArray(item.memo) ? item.memo : (item.memo ? [item.memo] : []);
                      const memoText = memoArr.filter(m => m.trim() !== "").join("、");
                      return memoText ? <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 3 }}>{memoText}</div> : null;
                    })()}
                    {(() => {
                      const exp = getExpiryInfo(item.expiryDate);
                      if (!exp) return null;
                      const color = exp.type === "expired" ? "#aaa" : exp.type === "danger" ? "#e74c3c" : exp.type === "warning" ? "#f0ad4e" : COLORS.textLight;
                      const dot = exp.type === "expired" ? "" : exp.type === "danger" ? "● " : exp.type === "warning" ? "● " : "";
                      return <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: exp.type === "danger" ? 700 : 400 }}>{dot}期限: {exp.label}</div>;
                    })()}
                    <div style={{ fontSize: 11, color: "#ccc", marginTop: 4 }}>更新: {item.updatedAt}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button onClick={() => toggleFrozen(item)} style={{ background: item.frozen ? "#2980b9" : COLORS.bg, color: item.frozen ? "#fff" : COLORS.textLight, border: "none", borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🧊</button>
                      <button onClick={() => cycleStatus(item)} style={{ background: sc.bg, color: sc.text, border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>● {item.status}</button>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(item)} style={{ background: COLORS.bg, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: COLORS.textLight }}>編集</button>
                      <button onClick={() => removeItem(item.id)} style={{ background: "#fde8e8", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#c0392b" }}>削除</button>
                      {(item.status === "在庫なし" || item.status === "残り少ない") && (
                        <button onClick={() => handleAddToShoppingFromCard(item)} style={{ background: "#e8f4fd", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#2980b9" }}>🛒</button>
                      )}
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
            <label style={lbl}>期限（任意）</label>
            <input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} style={inp} />
            <label style={lbl}>メモ（任意）</label>
              {form.memos.map((memo, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: idx === 0 ? 0 : 6 }}>
                  <input
                    value={memo}
                    onChange={e => {
                      const next = [...form.memos];
                      next[idx] = e.target.value;
                      setForm({...form, memos: next});
                    }}
                    placeholder="例：冷凍3個"
                    style={{ ...inp, marginTop: 0, flex: 1 }}
                  />
                  {idx === form.memos.length - 1 && (
                    <button
                      onClick={() => setForm({...form, memos: [...form.memos, ""]})}
                      style={{ background: COLORS.bg, border: `1.5px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 16, cursor: "pointer", color: COLORS.textLight, flexShrink: 0 }}
                    >＋</button>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "12px 14px", background: COLORS.bg, borderRadius: 10 }}>
                <input type="checkbox" id="frozen" checked={form.frozen || false} onChange={e => setForm({...form, frozen: e.target.checked})} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#2980b9", flexShrink: 0 }} />
                <label htmlFor="frozen" style={{ fontSize: 13, color: COLORS.text, cursor: "pointer", fontWeight: 600 }}>🧊 冷凍中</label>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, border: `1.5px solid ${COLORS.border}`, borderRadius: 12, background: COLORS.white, fontSize: 14, cursor: "pointer", color: COLORS.text }}>キャンセル</button>
                <button onClick={saveForm} style={{ flex: 2, padding: 12, border: "none", borderRadius: 12, background: COLORS.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{editTarget ? "保存する" : "追加する"}</button>
              </div>
          </div>
        </div>
      )}

     {/* BottomNav */}
      <div className="bottom-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: COLORS.white, borderTop: `1px solid ${COLORS.border}`, display: "flex", zIndex: 10 }}>
        <button
          onClick={() => { setPage("pantry"); searchRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: page === "pantry" ? COLORS.accent : COLORS.textLight, fontSize: 10 }}
        >
          <Search size={20} color={page === "pantry" ? COLORS.accent : COLORS.textLight} />
          探す
        </button>
        <button
          onClick={openAdd}
          style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: COLORS.textLight, fontSize: 10 }}
        >
          <Plus size={20} color={COLORS.textLight} />
          追加
        </button>
        <button
          onClick={() => setPage("shopping")}
          style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: page === "shopping" ? COLORS.accent : COLORS.textLight, fontSize: 10 }}
        >
          <ShoppingCart size={20} color={page === "shopping" ? COLORS.accent : COLORS.textLight} />
          買い物
        </button>
        <button
          onClick={logout}
          style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: COLORS.textLight, fontSize: 10 }}
        >
          <LogOut size={20} color={COLORS.textLight} />
          ログアウト
        </button>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, color: "#888", marginBottom: 4, marginTop: 12, fontWeight: 600 };
const inp = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1.5px solid #e0dbd2", borderRadius: 10, fontSize: 14, outline: "none", background: "#fafaf8", color: "#333" };
