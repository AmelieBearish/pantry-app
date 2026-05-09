import { useState, useEffect } from "react";
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

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: "", category: "野菜", status: "在庫あり", memo: "" });
  const [activeTab, setActiveTab] = useState("すべて");
  const [search, setSearch] = useState("");

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
    const
