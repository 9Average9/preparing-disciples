import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Sermon, SermonOutline, Slide, SlideTheme } from "@/types";

const COLLECTION = "sermons";

function sermonFromFirestore(
  id: string,
  data: Record<string, unknown>
): Sermon {
  return {
    id,
    userId: data.userId as string,
    title: data.title as string,
    createdAt: (data.createdAt as Timestamp).toDate(),
    updatedAt: (data.updatedAt as Timestamp).toDate(),
    status: data.status as Sermon["status"],
    outline: data.outline as SermonOutline,
    presentation: data.presentation as Sermon["presentation"] | undefined,
  };
}

export async function createSermon(
  userId: string,
  title: string,
  outline: SermonOutline
): Promise<Sermon> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTION), {
    userId,
    title,
    status: "draft",
    outline,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: docRef.id,
    userId,
    title,
    status: "draft",
    outline,
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
  };
}

export async function getSermon(id: string): Promise<Sermon | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return sermonFromFirestore(snap.id, snap.data() as Record<string, unknown>);
}

export async function updateSermon(
  id: string,
  updates: Partial<Omit<Sermon, "id" | "userId" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteSermon(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function savePresentation(
  sermonId: string,
  slides: Slide[],
  theme: SlideTheme
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, sermonId), {
    presentation: { slides, theme },
    updatedAt: Timestamp.now(),
  });
}

export async function getUserSermons(userId: string): Promise<Sermon[]> {
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    sermonFromFirestore(d.id, d.data() as Record<string, unknown>)
  );
}
