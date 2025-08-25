'use client';

import React, { useState } from 'react';
import {
  ChartBarIcon,
  InformationCircleIcon,
  LightBulbIcon,
  StarIcon,
  ClockIcon,
  EyeIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  LinkIcon,
  BoltIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowTrendingUpIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid, BoltIcon as BoltIconSolid } from '@heroicons/react/24/solid';
import {
  SearchResultVisualization,
  ScoreComponent,
  RelevanceFactor,
  ScoreExplanation,
} from '../lib/search-visualization';

interface SearchResultVisualizationProps {
  result: SearchResultVisualization;
  query: string;
  showDetailedScoring?: boolean;
  highlightKeywords?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

export default function SearchResultVisualizationComponent({
  result,
  query,
  showDetailedScoring = true,
  highlightKeywords = true,
  onSelect,
  compact = false,
}: SearchResultVisualizationProps) {
  const [expandedScoring, setExpandedScoring] = useState(false);
  const [expandedExplanations, setExpandedExplanations] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-blue-600';
    if (score >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBarColor = (score: number): string => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-blue-500';
    if (score >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getIconForComponent = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      brain: AcademicCapIcon,
      'magnifying-glass': MagnifyingGlassIcon,
      star: StarIcon,
      clock: ClockIcon,
      'academic-cap': AcademicCapIcon,
      link: LinkIcon,
    };
    return iconMap[iconName] || InformationCircleIcon;
  };

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!highlightKeywords || !query) return text;

    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    let highlightedText = text;

    terms.forEach((term) => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(
        regex,
        `<mark class="bg-yellow-200 px-1 rounded">$1</mark>`
      );
    });

    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
  };

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 ${
        onSelect ? 'cursor-pointer' : ''
      } ${compact ? 'p-4' : 'p-6'}`}
      onClick={onSelect}
    >
      {/* Header with title and confidence indicator */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
            {highlightText(result.title, query)}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <span className="inline-flex items-center gap-1">
              <DocumentTextIcon className="h-4 w-4" />
              {result.metadata.contentType}
            </span>
            {result.metadata.language && (
              <span className="inline-flex items-center gap-1">
                <CodeBracketIcon className="h-4 w-4" />
                {result.metadata.language}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="h-4 w-4" />
              Rank #{result.scores.rank}
            </span>
          </div>
        </div>

        {/* Confidence indicator */}
        <div
          className={`px-3 py-1 rounded-full border text-xs font-medium ${getConfidenceColor(result.visualization.confidenceLevel)}`}
        >
          <div className="flex items-center gap-1">
            {result.visualization.confidenceLevel === 'high' ? (
              <CheckCircleIcon className="h-3 w-3" />
            ) : result.visualization.confidenceLevel === 'medium' ? (
              <InformationCircleIcon className="h-3 w-3" />
            ) : (
              <ExclamationCircleIcon className="h-3 w-3" />
            )}
            {result.visualization.confidenceLevel} confidence
          </div>
        </div>
      </div>

      {/* Content preview */}
      <div className="mb-4">
        <p className="text-gray-700 line-clamp-3 text-sm leading-relaxed">
          {result.summary
            ? highlightText(result.summary, query)
            : highlightText(result.content.substring(0, 200) + '...', query)}
        </p>
      </div>

      {/* Quick score overview */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Relevance Score</span>
          <span className={`text-lg font-bold ${getScoreColor(result.scores.combined)}`}>
            {(result.scores.combined * 100).toFixed(0)}%
          </span>
        </div>

        {/* Score bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${getScoreBarColor(result.scores.combined)}`}
            style={{ width: `${result.scores.combined * 100}%` }}
          />
        </div>

        {/* Top 3 scoring factors */}
        <div className="flex gap-2 flex-wrap">
          {result.visualization.scoreBreakdown
            .sort((a, b) => b.contribution - a.contribution)
            .slice(0, 3)
            .map((component, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                title={component.explanation}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: component.color }}
                />
                {component.label}: {(component.value * 100).toFixed(0)}%
              </span>
            ))}
        </div>
      </div>

      {/* Detailed scoring breakdown (expandable) */}
      {showDetailedScoring && !compact && (
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedScoring(!expandedScoring);
            }}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 mb-2"
          >
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-4 w-4" />
              Score Breakdown
            </div>
            {expandedScoring ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </button>

          {expandedScoring && (
            <div className="space-y-3">
              {result.visualization.scoreBreakdown.map((component, index) => (
                <ScoreComponentDisplay key={index} component={component} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Relevance factors */}
      {result.visualization.relevanceFactors.length > 0 && !compact && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <BoltIcon className="h-4 w-4" />
            Key Factors
          </h4>
          <div className="space-y-2">
            {result.visualization.relevanceFactors
              .slice(0, expandedScoring ? undefined : 3)
              .map((factor, index) => (
                <RelevanceFactorDisplay key={index} factor={factor} />
              ))}
          </div>
        </div>
      )}

      {/* Explanations (expandable) */}
      {result.visualization.explanations.length > 0 && !compact && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedExplanations(!expandedExplanations);
            }}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 mb-2"
          >
            <div className="flex items-center gap-2">
              <InformationCircleIcon className="h-4 w-4" />
              Why this result? ({result.visualization.explanations.length})
            </div>
            {expandedExplanations ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </button>

          {expandedExplanations && (
            <div className="space-y-2">
              {result.visualization.explanations.map((explanation, index) => (
                <ExplanationDisplay key={index} explanation={explanation} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Improvement suggestions */}
      {result.visualization.improvements.length > 0 && !compact && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSuggestions(!showSuggestions);
            }}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 mb-2"
          >
            <div className="flex items-center gap-2">
              <LightBulbIcon className="h-4 w-4" />
              Suggestions
            </div>
            {showSuggestions ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </button>

          {showSuggestions && (
            <div className="space-y-2">
              {result.visualization.improvements.map((suggestion, index) => (
                <SuggestionDisplay key={index} suggestion={suggestion} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer with metadata */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ClockIcon className="h-3 w-3" />
            {result.metadata.lastUpdated.toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <EyeIcon className="h-3 w-3" />
            {result.metadata.popularity} views
          </span>
          <span className="flex items-center gap-1">
            <DocumentTextIcon className="h-3 w-3" />
            {result.metadata.wordCount.toLocaleString()} words
          </span>
        </div>

        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
          >
            View source
            <LinkIcon className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// Individual score component display
function ScoreComponentDisplay({ component }: { component: ScoreComponent }) {
  const IconComponent =
    component.name === 'semantic'
      ? AcademicCapIcon
      : component.name === 'keyword'
        ? MagnifyingGlassIcon
        : component.name === 'popularity'
          ? StarIcon
          : component.name === 'freshness'
            ? ClockIcon
            : component.name === 'quality'
              ? CheckCircleIcon
              : LinkIcon;

  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
      <div className="flex items-center gap-2 flex-1">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: component.color }} />
        <IconComponent className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-700">{component.label}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>{(component.value * 100).toFixed(0)}%</span>
          <span className="text-gray-400">×</span>
          <span>{(component.weight * 100).toFixed(0)}%</span>
        </div>
        <div className="w-16 bg-gray-200 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: `${component.value * 100}%`,
              backgroundColor: component.color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Relevance factor display
function RelevanceFactorDisplay({ factor }: { factor: RelevanceFactor }) {
  const getFactorIcon = (impact: string) => {
    switch (impact) {
      case 'positive':
        return <ArrowTrendingUpIcon className="h-3 w-3 text-green-600" />;
      case 'negative':
        return <ExclamationCircleIcon className="h-3 w-3 text-red-600" />;
      default:
        return <InformationCircleIcon className="h-3 w-3 text-gray-600" />;
    }
  };

  const getFactorColor = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'negative':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded border text-xs ${getFactorColor(factor.impact)}`}
    >
      {getFactorIcon(factor.impact)}
      <span className="font-medium">{factor.factor}</span>
      <span className="flex-1">{factor.description}</span>
      <span className="font-medium">{(factor.strength * 100).toFixed(0)}%</span>
    </div>
  );
}

// Explanation display
function ExplanationDisplay({ explanation }: { explanation: ScoreExplanation }) {
  const getExplanationIcon = (type: string) => {
    switch (type) {
      case 'strength':
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case 'weakness':
        return <ExclamationCircleIcon className="h-4 w-4 text-red-600" />;
      default:
        return <InformationCircleIcon className="h-4 w-4 text-blue-600" />;
    }
  };

  const getExplanationColor = (type: string) => {
    switch (type) {
      case 'strength':
        return 'border-green-200 bg-green-50';
      case 'weakness':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <div className={`p-3 rounded border ${getExplanationColor(explanation.type)}`}>
      <div className="flex items-center gap-2 mb-1">
        {getExplanationIcon(explanation.type)}
        <span className="font-medium text-sm">{explanation.title}</span>
        <span className="text-xs text-gray-500">({(explanation.score * 100).toFixed(0)}%)</span>
      </div>
      <p className="text-sm text-gray-700 mb-2">{explanation.description}</p>
      {explanation.suggestions && explanation.suggestions.length > 0 && (
        <ul className="text-xs text-gray-600 space-y-1">
          {explanation.suggestions.map((suggestion, index) => (
            <li key={index} className="flex items-center gap-1">
              <span className="w-1 h-1 bg-gray-400 rounded-full" />
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Suggestion display
function SuggestionDisplay({ suggestion }: { suggestion: any }) {
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'query':
        return <MagnifyingGlassIcon className="h-4 w-4 text-blue-600" />;
      case 'filter':
        return <BoltIcon className="h-4 w-4 text-purple-600" />;
      case 'related':
        return <LinkIcon className="h-4 w-4 text-green-600" />;
      default:
        return <SparklesIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="flex items-start gap-3 p-2 bg-purple-50 rounded border border-purple-200">
      {getSuggestionIcon(suggestion.type)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-purple-900 mb-1">{suggestion.action}</p>
        <p className="text-xs text-purple-700 mb-1">{suggestion.description}</p>
        <p className="text-xs text-purple-600 italic">{suggestion.impact}</p>
      </div>
    </div>
  );
}
