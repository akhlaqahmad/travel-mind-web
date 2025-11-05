import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, ChatMessage, AspectRatio, TranscriptionEntry, Restaurant, Itinerary, Activity, NewsArticle, ContentCarouselData, ContentCardData, StructuredContent, ContentType } from './types';
import { 
    ChatsIcon, ExploreIcon, SavedIcon, TripsIcon, UpdatesIcon, InspirationIcon, CreateIcon, MoreIcon,
    LocationIcon, MapIcon, ChevronLeftIcon, ChevronRightIcon, SendIcon, BedIcon, FlightIcon, RestaurantIcon,
    ActivityIcon, BrainIcon
} from './components/icons';
import { exploreData } from './mockData';
import * as gemini from './services/gemini';
import { GenerateContentResponse, GroundingChunk, LiveServerMessage, LiveSession, Modality, GenerateVideosOperation, Blob } from '@google/genai';


// --- MAIN APP ---

const App: React.FC = () => {
    const [view, setView] = useState<View>(View.Explore);

    const navItems = [
        { id: View.Chats, icon: <ChatsIcon />, label: 'Chats' },
        { id: View.Explore, icon: <ExploreIcon />, label: 'Explore' },
        { id: View.Saved, icon: <SavedIcon />, label: 'Saved' },
        { id: View.Trips, icon: <TripsIcon />, label: 'Trips' },
        { id: View.Updates, icon: <UpdatesIcon />, label: 'Updates' },
        { id: View.Inspiration, icon: <InspirationIcon />, label: 'Inspiration' },
        { id: View.Create, icon: <CreateIcon />, label: 'Create' },
    ];

    const renderView = () => {
        switch (view) {
            case View.Chats: return <ChatView />;
            case View.Explore:
            default:
                return <ExploreView setView={setView} />;
        }
    };

    return (
        <div className="flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200">
            <nav className="w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-8 px-2">
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">mindtrip.</h1>
                    </div>
                    <ul className="space-y-1">
                        {navItems.map(item => (
                            <li key={item.id}>
                                <button
                                    onClick={() => setView(item.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                        view === item.id 
                                        ? 'bg-slate-100 dark:bg-slate-800 font-semibold' 
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {React.cloneElement(item.icon, { className: 'w-5 h-5' })}
                                    <span className="">{item.label}</span>
                                    {item.id === View.Chats && <span className="ml-auto text-xs bg-slate-200 dark:bg-slate-700 rounded-full px-2 py-0.5">1</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                     <button
                        onClick={() => setView(View.Chats)}
                        className="w-full text-left bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors font-semibold p-3 rounded-lg mt-6"
                    >
                        New chat
                    </button>
                </div>
                 
                <div>
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-center mb-4">
                        <h4 className="font-bold">Mindtrip for iOS</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 my-1">Personalized recs, real-time answers and location smarts.</p>
                        <a href="#" className="text-sm font-semibold text-sky-600 hover:underline">Learn more</a>
                    </div>
                    <div className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-200"></div>
                            <span className="font-semibold">Traveler</span>
                        </div>
                        <button className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                            <MoreIcon />
                        </button>
                    </div>
                    <div className="text-xs text-slate-400 p-2 flex gap-2">
                       <a href="#" className="hover:underline">Company</a>
                       <a href="#" className="hover:underline">Contact</a>
                       <a href="#" className="hover:underline">Help</a>
                       <a href="#" className="hover:underline">Terms</a>
                       <a href="#" className="hover:underline">Privacy</a>
                    </div>
                     <p className="text-xs text-slate-400 px-2">&copy; 2025 Mindtrip, Inc.</p>
                </div>
            </nav>
            <main className="flex-1 overflow-y-auto">
                {renderView()}
            </main>
        </div>
    );
};

// --- VIEWS / FEATURE COMPONENTS ---

const ExploreView: React.FC<{ setView: (view: View) => void }> = ({ setView }) => {
    const [carouselData, setCarouselData] = useState<ContentCarouselData[]>(exploreData);
    const [isLocationLoading, setIsLocationLoading] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);

    const getCityFromVicinity = (vicinity: string): string => {
        const parts = vicinity.split(',').map(p => p.trim());
        for (let i = parts.length - 2; i >= 0; i--) {
            if (isNaN(parseInt(parts[i], 10)) && parts[i].length > 2) {
                 return parts[i];
            }
        }
        return parts.length > 1 ? parts[parts.length - 2] : vicinity;
    };

    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser.");
            setIsLocationLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const places = await gemini.getNearbyRestaurants("popular restaurants, hotels, attractions", latitude, longitude);
                    
                    if (places.length > 0) {
                        const nearbyCards: ContentCardData[] = places.slice(0, 10).map(p => ({
                            title: p.name,
                            subtitle: p.vicinity.split(',')[0],
                            imageUrl: p.imageUrl || `https://source.unsplash.com/random/400x400?${encodeURIComponent(p.name)}`,
                            icon: p.name.toLowerCase().includes('hotel') 
                                ? React.createElement(BedIcon, { className: "w-4 h-4 text-white" })
                                : React.createElement(RestaurantIcon, { className: "w-4 h-4 text-white" })
                        }));

                        const locationName = getCityFromVicinity(places[0].vicinity);

                        const nearbyCarousel: ContentCarouselData = {
                            title: 'For you in',
                            location: locationName,
                            showMapButton: true,
                            cards: nearbyCards,
                        };
                        
                        setCarouselData(prevData => [nearbyCarousel, ...prevData.slice(1)]);
                    } else {
                        setLocationError("Couldn't find any places nearby. Showing default recommendations.");
                    }
                } catch (apiError) {
                    console.error("Failed to fetch nearby places:", apiError);
                    setLocationError("Could not fetch nearby places. Showing default recommendations.");
                } finally {
                    setIsLocationLoading(false);
                }
            },
            (geoError) => {
                console.error("Geolocation error:", geoError);
                if (geoError.code === geoError.PERMISSION_DENIED) {
                    setLocationError("Enable location services to see local recommendations.");
                } else {
                    setLocationError("Could not access your location. Showing default recommendations.");
                }
                setIsLocationLoading(false);
            }
        );
    }, []);

    const LocationCarouselPlaceholder = () => (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-baseline gap-2">
                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div>
                </div>
            </div>
            <div className="flex gap-4 overflow-x-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-72 h-96 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse"></div>
                ))}
            </div>
        </div>
    );
    
    return (
        <div className="p-8 max-w-full">
             <div className="flex items-center gap-2 mb-8">
                <button className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full text-sm font-semibold hover:border-slate-400 dark:hover:border-slate-500">Where</button>
                <button className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full text-sm font-semibold hover:border-slate-400 dark:hover:border-slate-500">When</button>
                <button className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full text-sm font-semibold hover:border-slate-400 dark:hover:border-slate-500">2 travelers</button>
                <button className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full text-sm font-semibold hover:border-slate-400 dark:hover:border-slate-500">Budget</button>
            </div>
            <div className="space-y-10">
                {isLocationLoading ? (
                    <LocationCarouselPlaceholder />
                ) : (
                    <ContentCarousel carousel={carouselData[0]} />
                )}

                {locationError && !isLocationLoading && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center -mt-6">{locationError}</p>
                )}

                {carouselData.slice(1).map((carousel, index) => (
                    <ContentCarousel key={index + 1} carousel={carousel} />
                ))}
            </div>
        </div>
    );
};

const ContentCarousel: React.FC<{ carousel: ContentCarouselData }> = ({ carousel }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = direction === 'left' ? -300 : 300;
            scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-xl font-bold">{carousel.title}</h2>
                    {carousel.location && <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1"><LocationIcon className="w-4 h-4"/>{carousel.location}</p>}
                    {carousel.showMapButton && <button className="ml-2 flex items-center gap-1 px-3 py-1 border border-slate-300 dark:border-slate-700 rounded-full text-sm font-semibold hover:border-slate-400 dark:hover:border-slate-500"><MapIcon className="w-4 h-4" />Map</button>}
                </div>
                <div className="flex items-center gap-2">
                    {carousel.seeAllLink && <a href="#" className="text-sm font-semibold hover:underline">See all</a>}
                     <button onClick={() => scroll('left')} className="p-1 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50">
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => scroll('right')} className="p-1 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50">
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mb-2">
                {carousel.cards.map((card, index) => (
                    <ContentCard key={index} card={card} />
                ))}
            </div>
        </div>
    )
};

const ContentCard: React.FC<{ card: ContentCardData }> = ({ card }) => {
    const cardWidth = card.subtitle ? 'w-72' : 'w-96';
    return (
        <div className={`flex-shrink-0 ${cardWidth} h-96 rounded-2xl overflow-hidden relative group cursor-pointer`}>
            <img src={card.imageUrl} alt={card.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-5 text-white">
                <h3 className="text-xl font-bold">{card.title}</h3>
                {card.subtitle && (
                  <div className="flex items-center gap-2 mt-1">
                    {card.icon}
                    <p className="text-sm font-medium">{card.subtitle}</p>
                  </div>
                )}
            </div>
        </div>
    )
}

// --- CHAT COMPONENTS ---

const getActivityIcon = (type: Activity['type']) => {
    const iconProps = { className: "w-5 h-5 text-slate-500 dark:text-slate-400" };
    switch (type) {
        case 'flight': return <FlightIcon {...iconProps} />;
        case 'hotel': return <BedIcon {...iconProps} />;
        case 'dining': return <RestaurantIcon {...iconProps} />;
        case 'activity': return <ActivityIcon {...iconProps} />;
        case 'travel': return <LocationIcon {...iconProps} />;
        default: return null;
    }
};

const ItineraryView: React.FC<{ data: Itinerary }> = ({ data }) => (
    <div className="p-1">
        <h2 className="text-xl font-bold mb-1">{data.destination}</h2>
        <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-400 mb-4">
            <span>{data.duration}</span>
            <span>&bull;</span>
            <span>{data.budget}</span>
        </div>
        <div className="space-y-4">
            {data.itinerary.map((day, index) => (
                <div key={index}>
                    <h3 className="font-bold text-lg mb-2">{`Day ${day.day}: ${day.title}`}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{day.summary}</p>
                    <ul className="space-y-3 border-l-2 border-slate-200 dark:border-slate-700 ml-2 pl-6">
                        {day.activities.map((activity, actIndex) => (
                            <li key={actIndex} className="relative">
                                <div className="absolute -left-[34px] top-1 w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded-full border-4 border-white dark:border-slate-900"></div>
                                <div className="flex items-start gap-3">
                                    {getActivityIcon(activity.type)}
                                    <div>
                                        <p className="font-semibold">{activity.time}</p>
                                        <p className="text-slate-600 dark:text-slate-400">{activity.description}</p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    </div>
);

const MessageContentView: React.FC<{ content: StructuredContent, contentType: ContentType }> = ({ content, contentType }) => {
    if (contentType === 'itinerary' && typeof content === 'object' && content && 'destination' in content) {
        return <ItineraryView data={content as Itinerary} />;
    }
    const textContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    return <p className="whitespace-pre-wrap">{textContent}</p>;
};

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.role === 'user';
    return (
        <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl p-4 rounded-2xl ${isUser ? 'bg-sky-500 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-bl-none'}`}>
                 <MessageContentView content={message.content} contentType={message.contentType} />
            </div>
        </div>
    );
};

const ChatView = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;
        }
    }, [inputMessage]);

    const handleSend = async () => {
        const trimmedMessage = inputMessage.trim();
        if (!trimmedMessage || isLoading) return;

        const userMessage: ChatMessage = {
            role: 'user', content: trimmedMessage, contentType: 'text',
        };
        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await gemini.generateChatResponse(messages, trimmedMessage);
            const responseText = response.text.trim();
            const parsedResponse = JSON.parse(responseText);
            
            const { contentType, itineraryPayload, textPayload } = parsedResponse;

            let finalContent: StructuredContent;
            let finalContentType: ContentType;

            if (contentType === 'itinerary' && itineraryPayload) {
                finalContent = itineraryPayload;
                finalContentType = 'itinerary';
            } else {
                finalContent = textPayload || "Sorry, I was unable to generate a response. Please try again.";
                finalContentType = 'text';
            }

            const modelMessage: ChatMessage = {
                role: 'model',
                content: finalContent,
                contentType: finalContentType,
            };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Failed to get response from Gemini:", error);
            const errorMessage: ChatMessage = {
                role: 'model',
                content: 'Sorry, something went wrong. Please try again.',
                contentType: 'text',
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-950">
            <header className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-semibold">New chat</h2>
            </header>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {messages.length === 0 && !isLoading ? (
                    <div className="flex flex-col h-full items-center justify-center text-center -mt-16">
                        <div className="w-24 h-24 mx-auto mb-4">
                           <img src="https://i.imgur.com/3Z2fJcy.png" alt="Travel graphic" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Where to today?</h2>
                        <p className="text-slate-600 dark:text-slate-400">Ask for a 5-day trip to Paris, or what to do in Tokyo.</p>
                    </div>
                ) : (
                    messages.map((msg, index) => <MessageBubble key={index} message={msg} />)
                )}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="flex items-center gap-3 max-w-2xl p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 rounded-bl-none">
                            <BrainIcon className="w-6 h-6 animate-pulse text-sky-500" />
                            <span className="text-slate-600 dark:text-slate-400">Mindtrip is thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <div className="relative">
                     <textarea
                        ref={textareaRef}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Ask anything..."
                        className="w-full bg-slate-100 dark:bg-slate-800 rounded-2xl py-3 pl-5 pr-14 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 max-h-40"
                        rows={1}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isLoading || !inputMessage.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-sky-500 text-white hover:bg-sky-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 transition-colors"
                        aria-label="Send message"
                    >
                       <SendIcon className="w-5 h-5" />
                    </button>
                </div>
                 <p className="text-xs text-center text-slate-400 mt-2">Mindtrip can make mistakes. Check important info.</p>
            </div>
        </div>
    );
};

export default App;