import { YouTubeVideo } from '../types';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

export async function searchYouTubeVideos(query: string): Promise<YouTubeVideo[]> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("YouTube API key is not configured.");
        return [];
    }

    const url = new URL(`${YOUTUBE_API_BASE_URL}/search`);
    url.searchParams.append('part', 'snippet');
    url.searchParams.append('q', query);
    url.searchParams.append('type', 'video');
    url.searchParams.append('maxResults', '10');
    url.searchParams.append('key', apiKey);

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            const errorData = await response.json();
            console.error("YouTube API Error:", errorData.error.message);
            throw new Error(`YouTube API request failed with status ${response.status}`);
        }
        const data = await response.json();
        
        return data.items.map((item: any): YouTubeVideo => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            channelTitle: item.snippet.channelTitle,
            thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
        }));

    } catch (error) {
        console.error("Failed to fetch from YouTube API:", error);
        return [];
    }
}
