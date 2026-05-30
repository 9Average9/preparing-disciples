export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
}

export interface VerseRef {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
}

export interface MainPoint {
  id: string;
  title: string;
  subPoints: string[];
  verses: VerseRef[];
  notes: string;
  illustration: string;
}

export interface SermonOutline {
  introduction: string;
  mainPoints: MainPoint[];
  conclusion: string;
  scriptureRef: string;
  theme: string;
  illustrations: string[];
}

export type SermonStatus = "draft" | "complete";

export interface Sermon {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  status: SermonStatus;
  outline: SermonOutline;
}

export interface SlideContent {
  heading?: string;
  body?: string;
  verseRef?: string;
  verseText?: string;
  imagePrompt?: string;
}

export type SlideType =
  | "title"
  | "scripture"
  | "point"
  | "illustration"
  | "quote"
  | "custom";

export interface Slide {
  id: string;
  type: SlideType;
  content: SlideContent;
  backgroundImage?: string;
  aiModified?: boolean;
  originalContent?: string;
}

export interface SlideTheme {
  id: string;
  name: string;
  description: string;
  preview: string;
  style: Record<string, string>;
}

export interface SlidePresentation {
  id: string;
  sermonId: string;
  theme: SlideTheme;
  slides: Slide[];
  createdAt: Date;
}

export interface GrammarChange {
  slideId: string;
  original: string;
  suggested: string;
  reason: string;
  accepted: boolean;
}
