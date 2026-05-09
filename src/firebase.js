import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const db = getFirestore(app)
export const auth = getAuth(app)

// 買い物リスト：リアルタイム購読
export function subscribeShoppingList(uid, callback) {
  const ref = collection(db, 'users', uid, 'shoppingList')
  const q = query(ref, orderBy('addedAt', 'asc'))
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

// 買い物リスト：アイテム追加
export async function addShoppingItem(uid, item) {
  const ref = collection(db, 'users', uid, 'shoppingList')
  await addDoc(ref, {
    name: item.name,
    amount: item.amount ?? '',
    recipeId: item.recipeId ?? null,
    recipeName: item.recipeName ?? null,
    registerToPantry: item.registerToPantry ?? false,
    category: item.category ?? null,
    checked: false,
    addedAt: serverTimestamp(),
  })
}
// 買い物リスト：チェック状態の更新
export async function updateShoppingItemChecked(uid, itemId, checked) {
  const ref = doc(db, 'users', uid, 'shoppingList', itemId)
  await updateDoc(ref, { checked })
}

// 買い物リスト：アイテム削除
export async function deleteShoppingItem(uid, itemId) {
  const ref = doc(db, 'users', uid, 'shoppingList', itemId)
  await deleteDoc(ref)
}
