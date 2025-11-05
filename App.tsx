import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, ChatMessage, AspectRatio, TranscriptionEntry, Restaurant, Itinerary, Activity, NewsArticle } from './types';
import { 
    HomeIcon, ChatIcon, VisualsIcon, AnalyzeIcon, LiveIcon, LocationIcon, NewsIcon, 
    SparklesIcon, WandIcon, VideoIcon, BrainIcon, SoundIcon, StarIcon,
    FlightIcon, BedIcon, RestaurantIcon, ActivityIcon
} from './components/icons';
import * as gemini from './services/gemini';
import { GenerateContentResponse, GroundingChunk, LiveServerMessage, LiveSession, Modality, GenerateVideosOperation, Blob } from '@google/genai';

// --- UTILITY FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
}

// Haversine formula for distance calculation
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// --- UI COMPONENTS ---

const LoadingSpinner = ({ small = false }: { small?: boolean }) => (
    <div className={`animate-spin rounded-full border-b-2 border-slate-500 ${small ? 'h-5 w-5' : 'h-8 w-8'}`}></div>
);

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
}
const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, onClick }) => (
    <button
        onClick={onClick}
        className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow text-left flex flex-col items-start h-full transform hover:-translate-y-1"
    >
        <div className="bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 rounded-lg p-3 mb-4">
            {icon}
        </div>
        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm flex-grow">{description}</p>
    </button>
);


// --- MAIN APP ---

const App: React.FC = () => {
    const [view, setView] = useState<View>(View.Home);

    const navItems = [
        { id: View.Home, icon: <HomeIcon />, label: 'Home' },
        { id: View.Chat, icon: <ChatIcon />, label: 'Plan' },
        { id: View.VisualCreator, icon: <VisualsIcon />, label: 'Create' },
        { id: View.ContentAnalyzer, icon: <AnalyzeIcon />, label: 'Analyze' },
        { id: View.LiveAssistant, icon: <LiveIcon />, label: 'Live' },
        { id: View.LocationExplorer, icon: <LocationIcon />, label: 'Explore' },
        { id: View.LatestNews, icon: <NewsIcon />, label: 'News' },
    ];

    const renderView = () => {
        switch (view) {
            case View.Chat: return <ChatPlanner />;
            case View.VisualCreator: return <VisualCreator />;
            case View.ContentAnalyzer: return <ContentAnalyzer />;
            case View.LiveAssistant: return <LiveAssistant />;
            case View.LocationExplorer: return <LocationExplorer />;
            case View.LatestNews: return <LatestNews />;
            case View.Home:
            default:
                return <HomeView setView={setView} />;
        }
    };

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <nav className="w-20 lg:w-64 bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-8 px-2">
                        <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v2/gemini_sparkle_blue_2_light.svg" alt="TravelMind Logo" className="w-8 h-8"/>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 hidden lg:block">TravelMind</h1>
                    </div>
                    <ul className="space-y-2">
                        {navItems.map(item => (
                            <li key={item.id}>
                                <button
                                    onClick={() => setView(item.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                        view === item.id 
                                        ? 'bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300' 
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {item.icon}
                                    <span className="font-semibold hidden lg:block">{item.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                 <div className="text-center text-xs text-slate-400 p-2 hidden lg:block">
                    Powered by Gemini
                </div>
            </nav>
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                {renderView()}
            </main>
        </div>
    );
};

// --- VIEWS / FEATURE COMPONENTS ---

const HomeView: React.FC<{ setView: (view: View) => void }> = ({ setView }) => (
    <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Welcome to TravelMind</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8">Your AI travel companion. How can I help you explore the world today?</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <FeatureCard icon={<ChatIcon />} title="Trip Planner" description="Chat to plan your next adventure, from itinerary creation to booking suggestions." onClick={() => setView(View.Chat)} />
            <FeatureCard icon={<VisualsIcon />} title="Visual Creator" description="Generate images, edit photos, and create stunning videos for your destinations." onClick={() => setView(View.VisualCreator)} />
            <FeatureCard icon={<AnalyzeIcon />} title="Content Analyzer" description="Analyze photos for landmarks, get video summaries, and transcribe audio notes." onClick={() => setView(View.ContentAnalyzer)} />
            <FeatureCard icon={<LiveIcon />} title="Live Assistant" description="Talk to your AI assistant in real-time for hands-free help on the go." onClick={() => setView(View.LiveAssistant)} />
            <FeatureCard icon={<LocationIcon />} title="Location Explorer" description="Find nearby points of interest with up-to-date information from Google Maps." onClick={() => setView(View.LocationExplorer)} />
            <FeatureCard icon={<NewsIcon />} title="Latest News & Events" description="Get the latest travel advisories, news, and events for your destination." onClick={() => setView(View.LatestNews)} />
        </div>
    </div>
);

// --- STRUCTURED VIEW COMPONENTS ---

const ItineraryActivity: React.FC<{ activity: Activity }> = ({ activity }) => {
    const icons: { [key: string]: React.ReactNode } = {
        flight: <FlightIcon className="w-5 h-5 text-sky-500" />,
        hotel: <BedIcon className="w-5 h-5 text-indigo-500" />,
        dining: <RestaurantIcon className="w-5 h-5 text-amber-500" />,
        activity: <ActivityIcon className="w-5 h-5 text-emerald-500" />,
        travel: <LocationIcon className="w-5 h-5 text-slate-500" />,
    };

    return (
        <div className="flex gap-4 items-start relative">
            <div className="flex flex-col items-center z-10">
                <div className="bg-slate-200 dark:bg-slate-600 rounded-full p-2">
                    {icons[activity.type] || <ActivityIcon className="w-5 h-5 text-emerald-500" />}
                </div>
            </div>
            <div className="pt-1">
                <p className="font-semibold text-sm text-slate-500 dark:text-slate-400">{activity.time}</p>
                <p className="text-slate-700 dark:text-slate-300">{activity.description}</p>
            </div>
        </div>
    );
};


const ItineraryView: React.FC<{ data: Itinerary }> = ({ data }) => (
    <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{data.destination}</h3>
        <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-300 mt-1 mb-4">
            <span>Duration: {data.duration}</span>
            <span>Budget: {data.budget}</span>
        </div>
        <div className="space-y-4">
            {data.itinerary.map((day) => (
                <details key={day.day} className="bg-white dark:bg-slate-800 rounded-lg p-4 group" open={day.day === 1}>
                    <summary className="font-bold text-lg cursor-pointer list-none flex justify-between items-center">
                        <span>Day {day.day}: {day.title}</span>
                        <span className="transform transition-transform group-open:rotate-180 text-slate-500">▼</span>
                    </summary>
                    <p className="mt-2 mb-4 text-slate-600 dark:text-slate-400">{day.summary}</p>
                    <div className="space-y-[-2px] border-l-2 border-slate-300 dark:border-slate-600 ml-5 pl-5 relative">
                        {day.activities.map((act, index) => (
                          <div key={index} className="relative py-2">
                             <div className="absolute -left-[30px] top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-400 rounded-full"></div>
                             <ItineraryActivity activity={act} />
                          </div>
                        ))}
                    </div>
                </details>
            ))}
        </div>
    </div>
);


const ArticleCard: React.FC<{ article: NewsArticle }> = ({ article }) => (
    <a href={article.url} target="_blank" rel="noopener noreferrer" className="block bg-slate-100 dark:bg-slate-800 p-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
        <h4 className="font-bold text-sky-600 dark:text-sky-400">{article.title}</h4>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase my-1">{article.source}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{article.snippet}</p>
    </a>
);


const ChatPlanner = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: input, contentType: 'text' };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        try {
            const response = await gemini.generateChatResponse(messages, currentInput);
            const parsed = JSON.parse(response.text);

            let modelMessage: ChatMessage;

            if (parsed.contentType === 'itinerary' && parsed.itineraryPayload) {
                modelMessage = { role: 'model', content: parsed.itineraryPayload as Itinerary, contentType: 'itinerary' };
            } else {
                modelMessage = { role: 'model', content: parsed.textPayload, contentType: 'text' };
            }

            setMessages(prev => [...prev, modelMessage]);

        } catch (error) {
            console.error("Error generating response:", error);
            const errorMessage: ChatMessage = { role: 'model', content: "Sorry, I encountered an error. Please try again.", contentType: 'text' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const renderMessageContent = (message: ChatMessage) => {
        if (message.contentType === 'itinerary') {
            return <ItineraryView data={message.content as Itinerary} />;
        }
        if (typeof message.content === 'string') {
             return <p>{message.content}</p>;
        }
        return <p>{JSON.stringify(message.content)}</p>;
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Trip Planner</h2>
            <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-4 pb-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xl p-4 rounded-lg ${
                            msg.role === 'user' 
                            ? 'bg-sky-500 text-white' 
                            : 'bg-white dark:bg-slate-700'
                        }`}>
                            {renderMessageContent(msg)}
                        </div>
                    </div>
                ))}
                 {isLoading && (
                    <div className="flex justify-start">
                        <div className="max-w-xl p-4 rounded-lg bg-white dark:bg-slate-700">
                           <LoadingSpinner />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="mt-auto border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-700 rounded-lg p-2 shadow-sm">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="e.g., 'Plan a 10 day trip to Japan'"
                        className="w-full bg-transparent focus:outline-none p-2"
                        disabled={isLoading}
                    />
                    <button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-sky-500 text-white rounded-md p-2 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

const StarRating = ({ rating }: { rating: number }) => {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  
    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => <StarIcon key={`full-${i}`} className="w-4 h-4 text-amber-400" />)}
        {/* Fix: Removed unnecessary and problematic 'key' prop */}
        {halfStar && <StarIcon className="w-4 h-4 text-amber-400" />}
        {[...Array(emptyStars)].map((_, i) => <StarIcon key={`empty-${i}`} className="w-4 h-4 text-slate-300" filled={false} />)}
      </div>
    );
};
  
// Fix: Changed to React.FC to correctly type the component and allow the 'key' prop.
const RestaurantCard: React.FC<{ restaurant: Restaurant }> = ({ restaurant }) => (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform">
        <div className="h-40 bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            {restaurant.imageUrl ? (
                <img src={restaurant.imageUrl} alt={restaurant.name} className="w-full h-full object-cover" />
            ) : (
                <RestaurantIcon className="w-12 h-12 text-slate-400" />
            )}
        </div>
        <div className="p-4">
            <h3 className="font-bold text-lg truncate">{restaurant.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{restaurant.vicinity}</p>
            <div className="flex items-center gap-2 mt-2">
                <StarRating rating={restaurant.rating} />
                <span className="text-xs text-slate-500 dark:text-slate-400">({restaurant.reviewCount} reviews)</span>
            </div>
             {restaurant.distance !== undefined && (
                <p className="text-sm font-semibold text-sky-600 dark:text-sky-400 mt-2">
                    {restaurant.distance.toFixed(1)} km away
                </p>
            )}
        </div>
    </div>
);

const LocationExplorer = () => {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('delicious food');
    const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');
    const [minRating, setMinRating] = useState(0);

    const handleSearch = useCallback(async (currentQuery: string, location: { latitude: number, longitude: number }) => {
        if (!location) {
            setError("Location is not available. Please grant permission to access your location.");
            return;
        }
        if (!currentQuery.trim()) {
            setError("Please enter a search query.");
            return;
        }

        setIsLoading(true);
        setError(null);
        
        try {
            const results = await gemini.getNearbyRestaurants(currentQuery, location.latitude, location.longitude);
            const resultsWithDistance = results.map(r => ({
                ...r,
                distance: getDistance(location.latitude, location.longitude, r.location.lat, r.location.lng)
            }));
            setRestaurants(resultsWithDistance);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                setUserLocation(location);
                handleSearch(query, location);
            },
            (err) => {
                setError(`Could not get location: ${err.message}. Please enable location services.`);
                setIsLoading(false);
            }
        );
    }, [handleSearch]);

    const sortedAndFilteredRestaurants = useMemo(() => {
        return restaurants
            .filter(r => r.rating >= minRating)
            .sort((a, b) => {
                if (sortBy === 'distance') {
                    return (a.distance ?? Infinity) - (b.distance ?? Infinity);
                } else { // 'rating'
                    return b.rating - a.rating;
                }
            });
    }, [restaurants, sortBy, minRating]);
    
    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-4 flex-shrink-0">Location Explorer</h2>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md mb-6 sticky top-0 z-10 flex-shrink-0">
                <form onSubmit={(e) => { e.preventDefault(); if (userLocation) handleSearch(query, userLocation); }} className="flex flex-col md:flex-row gap-4">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g., 'sushi', 'pizza', 'cafe'"
                        className="w-full bg-slate-100 dark:bg-slate-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button type="submit" disabled={isLoading || !userLocation} className="bg-sky-500 text-white rounded-md px-4 py-2 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed flex-shrink-0">
                        {isLoading ? <LoadingSpinner small /> : 'Search'}
                    </button>
                </form>
                <div className="flex flex-col md:flex-row gap-4 mt-4 items-center">
                    <div className="flex items-center gap-4">
                        <span className="font-semibold text-sm">Sort by:</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="sort" value="distance" checked={sortBy === 'distance'} onChange={() => setSortBy('distance')} className="form-radio text-sky-500 focus:ring-sky-500" />
                            Distance
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="sort" value="rating" checked={sortBy === 'rating'} onChange={() => setSortBy('rating')} className="form-radio text-sky-500 focus:ring-sky-500" />
                            Rating
                        </label>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Min rating:</span>
                         <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="bg-slate-100 dark:bg-slate-700 rounded-md p-1 focus:outline-none text-sm focus:ring-2 focus:ring-sky-500">
                             <option value={0}>Any</option>
                             <option value={3}>3+ stars</option>
                             <option value={4}>4+ stars</option>
                             <option value={4.5}>4.5+ stars</option>
                         </select>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
                {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md text-center">{error}</p>}
                {isLoading && restaurants.length === 0 && (
                    <div className="flex justify-center items-center h-full">
                        <LoadingSpinner />
                    </div>
                )}
                {!isLoading && !error && !userLocation && <p className="text-center text-slate-500 dark:text-slate-400">Waiting for location...</p>}
                {!isLoading && sortedAndFilteredRestaurants.length === 0 && restaurants.length > 0 && (
                    <p className="text-center mt-8 text-slate-500 dark:text-slate-400">No restaurants match your filters. Try adjusting the minimum rating.</p>
                )}
                {!isLoading && sortedAndFilteredRestaurants.length === 0 && restaurants.length === 0 && !error && userLocation && (
                    <p className="text-center mt-8 text-slate-500 dark:text-slate-400">No restaurants found for your search. Try a different query!</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedAndFilteredRestaurants.map(r => <RestaurantCard key={r.placeId} restaurant={r} />)}
                </div>
            </div>
        </div>
    );
};

const LatestNews = () => {
    const [query, setQuery] = useState('travel news');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState('');
    const [articles, setArticles] = useState<NewsArticle[]>([]);
     const [chunks, setChunks] = useState<GroundingChunk[]>([]);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setError(null);
        setSummary('');
        setArticles([]);
        setChunks([]);

        try {
            const response = await gemini.groundWithSearch(query);
            const parsed = JSON.parse(response.text);
            setSummary(parsed.summary || "No summary available.");
            setArticles(parsed.articles || []);
            if (response.candidates && response.candidates[0].groundingMetadata) {
                setChunks(response.candidates[0].groundingMetadata.groundingChunks);
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to parse news data. The format might be unexpected.");
        } finally {
            setIsLoading(false);
        }
    }, [query]);
    
    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Latest News & Events</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex items-center gap-2 mb-6">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for news..."
                    className="w-full bg-white dark:bg-slate-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading} className="bg-sky-500 text-white rounded-md px-4 py-2 hover:bg-sky-600 disabled:bg-sky-300">
                    {isLoading ? <LoadingSpinner small /> : 'Search'}
                </button>
            </form>
            
            {error && <p className="text-red-500 text-center">{error}</p>}
            {isLoading && <div className="flex justify-center"><LoadingSpinner /></div>}
            
            {!isLoading && !error && (
                <div>
                    {summary && (
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg mb-6 shadow-sm">
                            <h3 className="font-bold text-lg mb-2">Summary</h3>
                            <p className="text-slate-600 dark:text-slate-300">{summary}</p>
                        </div>
                    )}
                    {articles.length > 0 && (
                         <div className="space-y-4">
                            {articles.map((article, index) => (
                                <ArticleCard key={index} article={article} />
                            ))}
                        </div>
                    )}
                    {chunks.length > 0 && (
                        <div className="mt-6">
                            <h4 className="font-semibold text-sm text-slate-500 dark:text-slate-400">Sources:</h4>
                            <ul className="flex flex-wrap gap-2 mt-2">
                                {chunks.map((chunk, index) => chunk.web && (
                                    <li key={index}>
                                        <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-slate-200 dark:bg-slate-700 text-sky-700 dark:text-sky-300 px-2 py-1 rounded-full hover:underline">
                                           {chunk.web.title || new URL(chunk.web.uri).hostname}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


const VisualCreator = () => <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg"><h2 className="text-2xl font-bold mb-2">Visual Creator</h2><p>This feature is under construction.</p></div>;
const ContentAnalyzer = () => <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg"><h2 className="text-2xl font-bold mb-2">Content Analyzer</h2><p>This feature is under construction.</p></div>;
const LiveAssistant = () => <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg"><h2 className="text-2xl font-bold mb-2">Live Assistant</h2><p>This feature is under construction.</p></div>;

export default App;
