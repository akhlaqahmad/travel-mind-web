// FIX: Add import for React to use React.ReactNode type.
import React from 'react';
import { GroundingChunk } from "@google/genai";

export enum View {
  Chats = 'CHATS',
  Explore = 'EXPLORE',
  Saved = 'SAVED',
  Trips = 'TRIPS',
  Updates = 'UPDATES',
  Inspiration = 'INSPIRATION',
  Create = 'CREATE',
  // Below are old views that can be removed or repurposed later
  VisualCreator = 'VISUAL_CREATOR',
  ContentAnalyzer = 'CONTENT_ANALYZER',
  LiveAssistant = 'LIVE_ASSISTANT',
  LocationExplorer = 'LOCATION_EXPLORER',
  LatestNews = 'LATEST_NEWS',
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface Restaurant {
  placeId: string;
  name: string;
  rating: number;
  reviewCount: number;
  vicinity: string;
  location: { lat: number, lng: number };
  imageUrl?: string;
  types?: string[];
  distance?: number; // in km
}


export interface LiveSessionCallbacks {
  onopen: () => void;
  onmessage: (message: any) => void;
  onerror: (e: ErrorEvent) => void;
  onclose: (e: CloseEvent) => void;
}

export interface TranscriptionEntry {
  speaker: 'user' | 'model';
  text: string;
}

// --- NEW TYPES FOR STRUCTURED CONTENT ---

export interface Activity {
    time: string;
    description: string;
    type: 'flight' | 'hotel' | 'dining' | 'activity' | 'travel';
}

export interface Day {
    day: number;
    title: string;
    summary: string;
    activities: Activity[];
}

export interface Itinerary {
    destination: string;
    duration: string;
    budget: string;
    itinerary: Day[];
}

export interface NewsArticle {
    title: string;
    source: string;
    url: string;
    snippet: string;
}

export type StructuredContent = Itinerary | NewsArticle[] | string;
export type ContentType = 'itinerary' | 'news' | 'text';

export interface ChatMessage {
  role: 'user' | 'model';
  content: StructuredContent;
  contentType: ContentType;
  groundingChunks?: GroundingChunk[];
}

export interface YouTubeVideo {
    videoId: string;
    title: string;
    description: string;
    channelTitle: string;
    thumbnailUrl: string;
}

// --- TYPES FOR EXPLORE VIEW ---
export interface ContentCardData {
  title: string;
  subtitle: string;
  imageUrl: string;
  icon?: React.ReactNode;
  url?: string;
}

export interface ContentCarouselData {
  title: string;
  location?: string;
  showMapButton?: boolean;
  seeAllLink?: boolean;
  cards: ContentCardData[];
}