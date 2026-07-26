import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForInitializationOnly",
  authDomain: "seion-daftar.firebaseapp.com",
  projectId: "seion-daftar",
  storageBucket: "seion-daftar.firebasestorage.app",
  messagingSenderId: "1057404177439",
  appId: "1:1057404177439:web:9e1bc707b1d9df8b46617a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearData() {
  console.log("Fetching documents...");
  const colRef = collection(db, 'artifacts', 'seion-lomba-hutri81', 'public', 'data', 'registrations');
  const snapshot = await getDocs(colRef);
  console.log(`Found ${snapshot.docs.length} documents.`);
  for (const d of snapshot.docs) {
    console.log(`Deleting ${d.id}...`);
    await deleteDoc(doc(db, 'artifacts', 'seion-lomba-hutri81', 'public', 'data', 'registrations', d.id));
  }
  console.log("All Firestore documents cleared!");
  process.exit(0);
}

clearData().catch(err => {
  console.error("Error clearing data:", err);
  process.exit(1);
});
