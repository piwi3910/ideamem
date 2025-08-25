import { PrismaClient } from './generated/prisma';
import { OllamaAISuggestions } from './ai-suggestions';

const prisma = new PrismaClient();

interface Bookmark {
  id: string;
  title: string;
  url: string;
  contentType: string;
  tags: string[];
  folderId?: string;
  createdAt: Date;
  lastAccessed?: Date;
  accessCount: number;
  notes?: string;
  isAISuggested: boolean;
  aiReason?: string;
}

interface BookmarkFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  order: number;
  bookmarks: Bookmark[];
  createdAt: Date;
}

interface UserBookmarkProfile {
  sessionId: string;
  bookmarks: Bookmark[];
  folders: BookmarkFolder[];
  recentSearches: string[];
  technologies: string[];
  preferences: {
    autoOrganize: boolean;
    aiSuggestions: boolean;
    smartFolders: boolean;
  };
}

export class BookmarkManager {
  private aiSuggestions: OllamaAISuggestions;

  constructor() {
    this.aiSuggestions = new OllamaAISuggestions();
  }

  // Get user's bookmark profile
  async getUserBookmarkProfile(sessionId: string): Promise<UserBookmarkProfile> {
    try {
      // Get user's saved searches (as a proxy for bookmarks until we implement user system)
      const savedSearches = await prisma.savedSearch.findMany({
        where: { sessionId },
        orderBy: { lastUsed: 'desc' },
        take: 50,
      });

      // Get recent search history
      const recentSearches = await prisma.searchQuery.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      // Infer technologies from search patterns
      const technologies = this.inferTechnologiesFromSearches(recentSearches.map((s) => s.query));

      // Convert saved searches to bookmarks format
      const bookmarks: Bookmark[] = savedSearches.map((search) => ({
        id: search.id,
        title: search.name || search.query,
        url: `#search=${encodeURIComponent(search.query)}`,
        contentType: 'search',
        tags: this.extractTagsFromQuery(search.query),
        createdAt: search.createdAt,
        lastAccessed: search.lastUsed,
        accessCount: search.useCount,
        notes: undefined,
        isAISuggested: false,
      }));

      // Create default folders
      const folders: BookmarkFolder[] = [
        {
          id: 'quick-access',
          name: 'Quick Access',
          description: 'Frequently used documentation',
          color: 'blue',
          order: 1,
          bookmarks: bookmarks.slice(0, 5),
          createdAt: new Date(),
        },
        {
          id: 'learning',
          name: 'Learning Path',
          description: 'Tutorials and guides for learning',
          color: 'green',
          order: 2,
          bookmarks: bookmarks.filter((b) =>
            b.tags.some((tag) => ['tutorial', 'guide', 'learn'].includes(tag.toLowerCase()))
          ),
          createdAt: new Date(),
        },
        {
          id: 'reference',
          name: 'Reference',
          description: 'API docs and quick references',
          color: 'purple',
          order: 3,
          bookmarks: bookmarks.filter((b) =>
            b.tags.some((tag) => ['api', 'reference', 'docs'].includes(tag.toLowerCase()))
          ),
          createdAt: new Date(),
        },
      ];

      return {
        sessionId,
        bookmarks,
        folders,
        recentSearches: recentSearches.map((s) => s.query).slice(0, 10),
        technologies,
        preferences: {
          autoOrganize: true,
          aiSuggestions: true,
          smartFolders: true,
        },
      };
    } catch (error) {
      console.error('Error getting user bookmark profile:', error);
      return this.createEmptyProfile(sessionId);
    }
  }

  // Generate AI-powered bookmark suggestions
  async generateBookmarkSuggestions(sessionId: string): Promise<any[]> {
    try {
      const profile = await this.getUserBookmarkProfile(sessionId);

      // Get available content from search index
      const availableContent = await prisma.searchIndex.findMany({
        take: 200,
        orderBy: [{ popularity: 'desc' }, { freshness: 'desc' }],
      });

      const userProfile = {
        searchHistory: profile.recentSearches,
        bookmarkedContent: profile.bookmarks.map((b) => b.title),
        technologies: profile.technologies,
        complexityLevel: this.inferUserComplexity(profile.recentSearches) as any,
        interests: this.inferInterestsFromSearches(profile.recentSearches),
        commonPatterns: this.findSearchPatterns(profile.recentSearches),
      };

      const suggestions = await this.aiSuggestions.generateBookmarkSuggestions(
        userProfile,
        availableContent,
        10
      );

      // Store suggestions for future analysis
      await this.aiSuggestions.storeAISuggestions(sessionId, suggestions);

      return suggestions;
    } catch (error) {
      console.error('Error generating bookmark suggestions:', error);
      return [];
    }
  }

  // Save a bookmark
  async saveBookmark(
    sessionId: string,
    bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'accessCount'>
  ): Promise<Bookmark> {
    try {
      // For now, store as saved search
      const savedSearch = await prisma.savedSearch.create({
        data: {
          sessionId,
          query: bookmark.title,
          name: bookmark.title,
          filters: JSON.stringify({
            url: bookmark.url,
            contentType: bookmark.contentType,
            tags: bookmark.tags,
          }),
          useCount: 1,
        },
      });

      return {
        id: savedSearch.id,
        title: bookmark.title,
        url: bookmark.url,
        contentType: bookmark.contentType,
        tags: bookmark.tags,
        folderId: bookmark.folderId,
        createdAt: savedSearch.createdAt,
        lastAccessed: savedSearch.lastUsed,
        accessCount: savedSearch.useCount,
        notes: bookmark.notes,
        isAISuggested: bookmark.isAISuggested,
        aiReason: bookmark.aiReason,
      };
    } catch (error) {
      console.error('Error saving bookmark:', error);
      throw new Error('Failed to save bookmark');
    }
  }

  // Organize bookmarks using AI
  async organizeBookmarks(sessionId: string): Promise<BookmarkFolder[]> {
    try {
      const profile = await this.getUserBookmarkProfile(sessionId);

      if (profile.bookmarks.length === 0) {
        return profile.folders;
      }

      // Get AI suggestions for organization
      const organization = await this.aiSuggestions.suggestBookmarkOrganization(profile.bookmarks);

      // Update folder structure based on AI suggestions
      const updatedFolders = await this.applyOrganizationSuggestions(
        profile.folders,
        organization,
        profile.bookmarks
      );

      return updatedFolders;
    } catch (error) {
      console.error('Error organizing bookmarks:', error);
      return [];
    }
  }

  // Track bookmark usage for AI learning
  async trackBookmarkUsage(sessionId: string, bookmarkId: string): Promise<void> {
    try {
      await prisma.savedSearch.update({
        where: { id: bookmarkId },
        data: {
          useCount: { increment: 1 },
          lastUsed: new Date(),
        },
      });
    } catch (error) {
      console.error('Error tracking bookmark usage:', error);
    }
  }

  // Get bookmark analytics for AI improvement
  async getBookmarkAnalytics(sessionId: string): Promise<any> {
    try {
      const profile = await this.getUserBookmarkProfile(sessionId);

      return {
        totalBookmarks: profile.bookmarks.length,
        mostUsed: profile.bookmarks.sort((a, b) => b.accessCount - a.accessCount).slice(0, 5),
        leastUsed: profile.bookmarks.filter((b) => b.accessCount === 0).slice(0, 5),
        bookmarksByType: this.groupBookmarksByType(profile.bookmarks),
        bookmarkTrends: await this.getBookmarkTrends(sessionId),
        aiSuggestionAccuracy: await this.getAISuggestionAccuracy(sessionId),
      };
    } catch (error) {
      console.error('Error getting bookmark analytics:', error);
      return null;
    }
  }

  // Smart bookmark recommendations based on current context
  async getContextualBookmarks(
    sessionId: string,
    currentQuery?: string,
    currentContent?: string
  ): Promise<Bookmark[]> {
    try {
      const profile = await this.getUserBookmarkProfile(sessionId);

      if (!currentQuery && !currentContent) {
        return profile.bookmarks.slice(0, 5);
      }

      // Use AI to find contextually relevant bookmarks
      const relevantBookmarks = profile.bookmarks.filter((bookmark) => {
        if (currentQuery) {
          return (
            bookmark.tags.some((tag) => currentQuery.toLowerCase().includes(tag.toLowerCase())) ||
            bookmark.title.toLowerCase().includes(currentQuery.toLowerCase())
          );
        }
        return false;
      });

      return relevantBookmarks.slice(0, 8);
    } catch (error) {
      console.error('Error getting contextual bookmarks:', error);
      return [];
    }
  }

  // Private helper methods
  private createEmptyProfile(sessionId: string): UserBookmarkProfile {
    return {
      sessionId,
      bookmarks: [],
      folders: [],
      recentSearches: [],
      technologies: [],
      preferences: {
        autoOrganize: true,
        aiSuggestions: true,
        smartFolders: true,
      },
    };
  }

  private inferTechnologiesFromSearches(searches: string[]): string[] {
    const techKeywords = [
      'javascript',
      'typescript',
      'python',
      'java',
      'go',
      'rust',
      'php',
      'react',
      'vue',
      'angular',
      'nodejs',
      'nextjs',
      'express',
      'docker',
      'kubernetes',
      'aws',
      'azure',
      'gcp',
      'mongodb',
      'postgresql',
      'mysql',
      'redis',
    ];

    const found = new Set<string>();

    searches.forEach((search) => {
      techKeywords.forEach((tech) => {
        if (search.toLowerCase().includes(tech)) {
          found.add(tech);
        }
      });
    });

    return Array.from(found).slice(0, 10);
  }

  private inferUserComplexity(searches: string[]): string {
    const beginnerKeywords = ['tutorial', 'getting started', 'how to', 'basics', 'introduction'];
    const advancedKeywords = ['optimization', 'performance', 'architecture', 'scaling', 'advanced'];

    let beginnerCount = 0;
    let advancedCount = 0;

    searches.forEach((search) => {
      const lower = search.toLowerCase();
      beginnerKeywords.forEach((keyword) => {
        if (lower.includes(keyword)) beginnerCount++;
      });
      advancedKeywords.forEach((keyword) => {
        if (lower.includes(keyword)) advancedCount++;
      });
    });

    if (beginnerCount > advancedCount * 2) return 'beginner';
    if (advancedCount > beginnerCount) return 'advanced';
    return 'intermediate';
  }

  private inferInterestsFromSearches(searches: string[]): string[] {
    const interests = new Set<string>();

    searches.forEach((search) => {
      // Simple keyword extraction - in real implementation would use more sophisticated NLP
      const words = search.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        if (word.length > 3 && !['what', 'how', 'why', 'when', 'where'].includes(word)) {
          interests.add(word);
        }
      });
    });

    return Array.from(interests).slice(0, 10);
  }

  private findSearchPatterns(searches: string[]): string[] {
    // Analyze common search patterns
    const patterns: string[] = [];

    if (searches.some((s) => s.includes('error') || s.includes('fix'))) {
      patterns.push('troubleshooting');
    }
    if (searches.some((s) => s.includes('tutorial') || s.includes('how to'))) {
      patterns.push('learning');
    }
    if (searches.some((s) => s.includes('api') || s.includes('reference'))) {
      patterns.push('reference-seeking');
    }

    return patterns;
  }

  private extractTagsFromQuery(query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'how',
      'what',
      'why',
      'when',
      'where',
    ]);

    return words.filter((word) => word.length > 2 && !stopWords.has(word)).slice(0, 5);
  }

  private groupBookmarksByType(bookmarks: Bookmark[]): Record<string, number> {
    const groups: Record<string, number> = {};

    bookmarks.forEach((bookmark) => {
      groups[bookmark.contentType] = (groups[bookmark.contentType] || 0) + 1;
    });

    return groups;
  }

  private async getBookmarkTrends(sessionId: string): Promise<any> {
    // Analyze bookmark creation trends over time
    try {
      const searches = await prisma.savedSearch.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });

      // Group by week
      const weeklyTrends = new Map<string, number>();
      searches.forEach((search) => {
        const weekStart = new Date(search.createdAt);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        weeklyTrends.set(weekKey, (weeklyTrends.get(weekKey) || 0) + 1);
      });

      return Array.from(weeklyTrends.entries()).map(([week, count]) => ({
        week,
        count,
      }));
    } catch (error) {
      return [];
    }
  }

  private async getAISuggestionAccuracy(sessionId: string): Promise<number> {
    try {
      // Check how many AI suggestions were actually bookmarked
      const aiSuggestions = await prisma.searchSuggestion.findMany({
        where: {
          category: 'ai_bookmark',
          relatedTo: { startsWith: `AI:${sessionId}` },
        },
      });

      const acceptedSuggestions = await prisma.savedSearch.findMany({
        where: {
          sessionId,
          name: { in: aiSuggestions.map((s) => s.suggestion) },
        },
      });

      if (aiSuggestions.length === 0) return 0;

      return acceptedSuggestions.length / aiSuggestions.length;
    } catch (error) {
      return 0;
    }
  }

  private async applyOrganizationSuggestions(
    currentFolders: BookmarkFolder[],
    organization: any,
    bookmarks: Bookmark[]
  ): Promise<BookmarkFolder[]> {
    // Apply AI organization suggestions to folder structure
    const updatedFolders: BookmarkFolder[] = [];

    if (organization.folders) {
      organization.folders.forEach((folderSuggestion: any, index: number) => {
        const matchingBookmarks = bookmarks.filter((bookmark) =>
          folderSuggestion.bookmarks.includes(bookmark.title)
        );

        updatedFolders.push({
          id: folderSuggestion.name.toLowerCase().replace(/\s+/g, '-'),
          name: folderSuggestion.name,
          description: folderSuggestion.description,
          color: this.getRandomColor(index),
          order: index + 1,
          bookmarks: matchingBookmarks,
          createdAt: new Date(),
        });
      });
    }

    return updatedFolders.length > 0 ? updatedFolders : currentFolders;
  }

  private getRandomColor(index: number): string {
    const colors = ['blue', 'green', 'purple', 'red', 'yellow', 'indigo', 'pink'];
    return colors[index % colors.length];
  }
}
