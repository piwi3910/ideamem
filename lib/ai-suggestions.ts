import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

interface AIBookmarkSuggestion {
  title: string;
  url: string;
  contentType: string;
  reason: string;
  confidence: number;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  category: string;
}

interface UserProfile {
  searchHistory: string[];
  bookmarkedContent: string[];
  technologies: string[];
  complexityLevel: 'beginner' | 'intermediate' | 'advanced';
  interests: string[];
  commonPatterns: string[];
}

interface ContentAnalysis {
  isFoundational: boolean;
  isFrequentlyReferenced: boolean;
  difficulty: string;
  mainTopics: string[];
  useCase: string;
}

export class OllamaAISuggestions {
  private readonly ollamaUrl: string;
  private readonly model: string;

  constructor(ollamaUrl: string = 'http://localhost:11434', model: string = 'llama3.2') {
    this.ollamaUrl = ollamaUrl;
    this.model = model;
  }

  // Generate AI-powered bookmark suggestions
  async generateBookmarkSuggestions(
    userProfile: UserProfile,
    availableContent: any[],
    limit: number = 10
  ): Promise<AIBookmarkSuggestion[]> {
    try {
      console.log('Generating AI bookmark suggestions...');

      // First, analyze user patterns to understand their needs
      const userAnalysis = await this.analyzeUserProfile(userProfile);

      // Get content recommendations from AI
      const aiRecommendations = await this.getAIRecommendations(userProfile, userAnalysis);

      // Match AI recommendations with available content
      const matchedSuggestions = await this.matchContentWithRecommendations(
        aiRecommendations,
        availableContent
      );

      // Score and rank suggestions
      const scoredSuggestions = await this.scoreAndRankSuggestions(
        matchedSuggestions,
        userProfile,
        userAnalysis
      );

      return scoredSuggestions.slice(0, limit);
    } catch (error) {
      console.error('Error generating bookmark suggestions:', error);
      // Fallback to pattern-based suggestions
      return this.fallbackPatternSuggestions(userProfile, availableContent, limit);
    }
  }

  // Analyze user profile to understand their learning patterns and needs
  private async analyzeUserProfile(userProfile: UserProfile): Promise<any> {
    const prompt = `Analyze this developer's profile and learning patterns:

Search History: ${userProfile.searchHistory.slice(0, 20).join(', ')}
Technologies: ${userProfile.technologies.join(', ')}
Complexity Level: ${userProfile.complexityLevel}
Current Bookmarks: ${userProfile.bookmarkedContent.slice(0, 10).join(', ')}

Based on this profile, provide a JSON analysis with:
1. learningStage: "exploring", "implementing", "optimizing", "teaching"
2. primaryFocus: main technology/concept they're working with
3. knowledgeGaps: areas they might need to learn more about
4. workflowPatterns: common development workflows they seem to follow
5. recommendedTopics: 5 topics they should learn next
6. bookmarkingMotivation: why they would bookmark something ("reference", "tutorial", "troubleshooting", "inspiration")

Respond only with valid JSON.`;

    const response = await this.callOllama(prompt);

    try {
      return JSON.parse(response);
    } catch {
      // Fallback analysis
      return {
        learningStage: 'implementing',
        primaryFocus: userProfile.technologies[0] || 'web development',
        knowledgeGaps: ['best practices', 'performance optimization'],
        workflowPatterns: ['setup -> implement -> debug'],
        recommendedTopics: userProfile.technologies.slice(0, 5),
        bookmarkingMotivation: 'reference',
      };
    }
  }

  // Get AI recommendations for what content to bookmark
  private async getAIRecommendations(userProfile: UserProfile, userAnalysis: any): Promise<any[]> {
    const prompt = `As an expert developer mentor, recommend documentation that should be bookmarked.

User Context:
- Learning Stage: ${userAnalysis.learningStage}
- Primary Focus: ${userAnalysis.primaryFocus}
- Technologies: ${userProfile.technologies.join(', ')}
- Complexity Level: ${userProfile.complexityLevel}
- Knowledge Gaps: ${userAnalysis.knowledgeGaps?.join(', ') || 'unknown'}

Recent searches suggest they're interested in: ${userProfile.searchHistory.slice(0, 10).join(', ')}

Recommend 15 types of documentation they should bookmark. For each recommendation, provide:
{
  "title": "descriptive title",
  "contentType": "api|tutorial|guide|example|reference",
  "priority": "high|medium|low", 
  "reason": "why this would be valuable to bookmark",
  "keywords": ["relevant", "search", "terms"],
  "category": "foundation|workflow|troubleshooting|advanced|reference"
}

Focus on:
1. Foundation docs they'll reference repeatedly
2. Troubleshooting guides for their tech stack
3. Best practice guides for their complexity level
4. Quick reference materials
5. Advanced topics they're growing into

Respond with valid JSON array only.`;

    const response = await this.callOllama(prompt);

    try {
      const recommendations = JSON.parse(response);
      return Array.isArray(recommendations) ? recommendations : [recommendations];
    } catch {
      // Fallback recommendations
      return this.generateFallbackRecommendations(userProfile);
    }
  }

  // Match AI recommendations with actual available content
  private async matchContentWithRecommendations(
    recommendations: any[],
    availableContent: any[]
  ): Promise<AIBookmarkSuggestion[]> {
    const suggestions: AIBookmarkSuggestion[] = [];

    for (const rec of recommendations) {
      // Find matching content using keyword matching and content type
      const matches = availableContent.filter((content) => {
        const titleMatch = rec.keywords?.some(
          (keyword: string) =>
            content.title?.toLowerCase().includes(keyword.toLowerCase()) ||
            content.content?.toLowerCase().includes(keyword.toLowerCase())
        );

        const typeMatch = !rec.contentType || content.metadata?.contentType === rec.contentType;
        const complexityMatch = this.isComplexityMatch(content, rec);

        return (titleMatch || typeMatch) && complexityMatch;
      });

      // Add the best matches
      for (const match of matches.slice(0, 2)) {
        suggestions.push({
          title: match.title || match.summary?.substring(0, 100) || 'Documentation',
          url: match.source?.url || match.source?.path || '',
          contentType: match.metadata?.contentType || rec.contentType || 'guide',
          reason: rec.reason || 'Recommended based on your interests',
          confidence: 0.8, // Will be adjusted in scoring
          tags: rec.keywords || [],
          priority: rec.priority || 'medium',
          category: rec.category || 'reference',
        });
      }
    }

    return suggestions;
  }

  // Score and rank suggestions based on user profile and content analysis
  private async scoreAndRankSuggestions(
    suggestions: AIBookmarkSuggestion[],
    userProfile: UserProfile,
    userAnalysis: any
  ): Promise<AIBookmarkSuggestion[]> {
    // Score each suggestion
    const scoredSuggestions = suggestions.map((suggestion) => {
      let score = suggestion.confidence;

      // Boost score based on user's complexity level
      if (suggestion.category === 'foundation' && userProfile.complexityLevel === 'beginner') {
        score += 0.3;
      }
      if (suggestion.category === 'advanced' && userProfile.complexityLevel === 'advanced') {
        score += 0.2;
      }

      // Boost score for primary focus area
      if (
        suggestion.tags.some((tag) =>
          tag.toLowerCase().includes(userAnalysis.primaryFocus?.toLowerCase())
        )
      ) {
        score += 0.25;
      }

      // Boost score for user's technologies
      if (
        suggestion.tags.some((tag) =>
          userProfile.technologies.some((tech) => tech.toLowerCase().includes(tag.toLowerCase()))
        )
      ) {
        score += 0.2;
      }

      // Priority weighting
      if (suggestion.priority === 'high') score += 0.15;
      else if (suggestion.priority === 'low') score -= 0.1;

      // Avoid duplicate bookmarks
      if (
        userProfile.bookmarkedContent.some((bookmark) =>
          bookmark.toLowerCase().includes(suggestion.title.toLowerCase())
        )
      ) {
        score -= 0.4;
      }

      return {
        ...suggestion,
        confidence: Math.min(Math.max(score, 0), 1), // Clamp between 0 and 1
      };
    });

    // Sort by confidence score
    return scoredSuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .filter((s) => s.confidence > 0.3); // Only return confident suggestions
  }

  // Analyze content to determine if it's worth bookmarking
  async analyzeContentValue(content: any, userProfile: UserProfile): Promise<ContentAnalysis> {
    const prompt = `Analyze this documentation content for bookmark-worthiness:

Title: ${content.title || 'Unknown'}
Content Type: ${content.metadata?.contentType || 'unknown'}
Content Preview: ${content.content?.substring(0, 500) || 'No content'}
Word Count: ${content.metadata?.wordCount || 0}
Complexity: ${content.metadata?.complexity || 'unknown'}

User Context:
- Technologies: ${userProfile.technologies.join(', ')}
- Level: ${userProfile.complexityLevel}
- Interests: ${userProfile.interests.join(', ')}

Analyze and respond with JSON:
{
  "isFoundational": boolean, // Is this foundational knowledge?
  "isFrequentlyReferenced": boolean, // Would users return to this often?
  "difficulty": "beginner|intermediate|advanced",
  "mainTopics": ["topic1", "topic2"], // 2-3 main topics covered
  "useCase": "reference|tutorial|troubleshooting|learning", // Primary use case
  "bookmarkScore": 0.0-1.0 // How valuable as a bookmark
}`;

    const response = await this.callOllama(prompt);

    try {
      return JSON.parse(response);
    } catch {
      // Fallback analysis
      return {
        isFoundational: content.metadata?.contentType === 'api',
        isFrequentlyReferenced: content.metadata?.popularity > 10,
        difficulty: content.metadata?.complexity || 'intermediate',
        mainTopics: [content.metadata?.contentType || 'documentation'],
        useCase: content.metadata?.contentType === 'tutorial' ? 'learning' : 'reference',
      };
    }
  }

  // Generate bookmark categories and organization suggestions
  async suggestBookmarkOrganization(bookmarks: any[]): Promise<any> {
    const prompt = `Organize these bookmarks into logical categories:

Bookmarks: ${bookmarks.map((b) => `"${b.title}" (${b.contentType})`).join(', ')}

Suggest a folder structure with:
{
  "folders": [
    {
      "name": "folder name",
      "description": "what goes here",
      "bookmarks": ["bookmark titles that belong here"],
      "priority": "high|medium|low"
    }
  ],
  "quickAccess": ["most important bookmark titles"],
  "learningPath": ["suggested reading order"]
}

Create 3-7 folders maximum. Focus on developer workflow and frequency of use.`;

    const response = await this.callOllama(prompt);

    try {
      return JSON.parse(response);
    } catch {
      return this.generateFallbackOrganization(bookmarks);
    }
  }

  // Call Ollama API
  private async callOllama(prompt: string): Promise<string> {
    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more consistent responses
          top_p: 0.9,
          max_tokens: 2000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  // Fallback pattern-based suggestions when AI fails
  private fallbackPatternSuggestions(
    userProfile: UserProfile,
    availableContent: any[],
    limit: number
  ): AIBookmarkSuggestion[] {
    const suggestions: AIBookmarkSuggestion[] = [];

    // Pattern 1: High popularity content in user's tech stack
    const popularInTechStack = availableContent
      .filter(
        (content) =>
          userProfile.technologies.some((tech) =>
            content.metadata?.language?.toLowerCase().includes(tech.toLowerCase())
          ) && (content.metadata?.popularity || 0) > 5
      )
      .slice(0, 5);

    for (const content of popularInTechStack) {
      suggestions.push({
        title: content.title || 'Popular Documentation',
        url: content.source?.url || '',
        contentType: content.metadata?.contentType || 'guide',
        reason: 'Popular content in your technology stack',
        confidence: 0.7,
        tags: [content.metadata?.language || ''],
        priority: 'medium',
        category: 'reference',
      });
    }

    // Pattern 2: API references (always useful to bookmark)
    const apiRefs = availableContent
      .filter((content) => content.metadata?.contentType === 'api')
      .slice(0, 3);

    for (const content of apiRefs) {
      suggestions.push({
        title: content.title || 'API Reference',
        url: content.source?.url || '',
        contentType: 'api',
        reason: 'API references are frequently needed for development',
        confidence: 0.8,
        tags: ['api', 'reference'],
        priority: 'high',
        category: 'reference',
      });
    }

    return suggestions.slice(0, limit);
  }

  private generateFallbackRecommendations(userProfile: UserProfile): any[] {
    return [
      {
        title: 'Getting Started Guide',
        contentType: 'tutorial',
        priority: 'high',
        reason: 'Essential foundation for getting started',
        keywords: ['getting started', 'introduction', 'setup'],
        category: 'foundation',
      },
      {
        title: 'API Reference',
        contentType: 'api',
        priority: 'high',
        reason: 'Quick reference for development',
        keywords: ['api', 'reference', 'documentation'],
        category: 'reference',
      },
    ];
  }

  private generateFallbackOrganization(bookmarks: any[]): any {
    return {
      folders: [
        {
          name: 'Quick Reference',
          description: 'Frequently accessed API docs and references',
          bookmarks: bookmarks.filter((b) => b.contentType === 'api').map((b) => b.title),
          priority: 'high',
        },
        {
          name: 'Tutorials & Guides',
          description: 'Learning materials and how-to guides',
          bookmarks: bookmarks
            .filter((b) => ['tutorial', 'guide'].includes(b.contentType))
            .map((b) => b.title),
          priority: 'medium',
        },
      ],
      quickAccess: bookmarks.slice(0, 5).map((b) => b.title),
      learningPath: bookmarks.slice(0, 3).map((b) => b.title),
    };
  }

  private isComplexityMatch(content: any, recommendation: any): boolean {
    if (!content.metadata?.complexity) return true;

    const contentComplexity = content.metadata.complexity;
    const userLevel = recommendation.userLevel || 'intermediate';

    // Beginners can handle beginner and some intermediate content
    if (userLevel === 'beginner') {
      return ['beginner', 'intermediate'].includes(contentComplexity);
    }

    // Advanced users can handle all levels
    if (userLevel === 'advanced') {
      return true;
    }

    // Intermediate users can handle beginner and intermediate
    return ['beginner', 'intermediate'].includes(contentComplexity);
  }

  // Store AI suggestions in database for future reference
  async storeAISuggestions(sessionId: string, suggestions: AIBookmarkSuggestion[]): Promise<void> {
    try {
      for (const suggestion of suggestions) {
        await prisma.searchSuggestion.upsert({
          where: { suggestion: suggestion.title },
          update: {
            searchCount: { increment: 1 },
            lastUsed: new Date(),
            relatedTo: `AI:${sessionId}`,
          },
          create: {
            suggestion: suggestion.title,
            category: 'ai_bookmark',
            searchCount: 1,
            relatedTo: `AI:${sessionId}`,
          },
        });
      }
    } catch (error) {
      console.error('Error storing AI suggestions:', error);
    }
  }
}
