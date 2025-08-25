'use client';

import React, { useState } from 'react';
import {
  ChartBarIcon,
  PresentationChartBarIcon,
  AdjustmentsHorizontalIcon,
  InformationCircleIcon,
  SparklesIcon,
  EyeIcon,
  ClockIcon,
  StarIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { SearchResultVisualization } from '../lib/search-visualization';

interface SearchResultsDashboardProps {
  results: SearchResultVisualization[];
  query: string;
  searchTime: number;
  totalResults: number;
  summary: any;
  onGroupingChange?: (grouping: 'none' | 'score' | 'type' | 'confidence') => void;
  onVisualizationToggle?: (setting: string, enabled: boolean) => void;
}

export default function SearchResultsDashboard({
  results,
  query,
  searchTime,
  totalResults,
  summary,
  onGroupingChange,
  onVisualizationToggle,
}: SearchResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'scores' | 'factors' | 'quality'>(
    'overview'
  );
  const [showSettings, setShowSettings] = useState(false);

  const getQualityStatusColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-700 bg-green-100';
      case 'good':
        return 'text-blue-700 bg-blue-100';
      case 'moderate':
        return 'text-yellow-700 bg-yellow-100';
      case 'poor':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return <TrophyIcon className="h-5 w-5" />;
      case 'good':
        return <CheckCircleIcon className="h-5 w-5" />;
      case 'moderate':
        return <InformationCircleIcon className="h-5 w-5" />;
      case 'poor':
        return <ExclamationTriangleIcon className="h-5 w-5" />;
      default:
        return <InformationCircleIcon className="h-5 w-5" />;
    }
  };

  const scoreDistribution = React.useMemo(() => {
    const bins = [
      { range: '90-100%', min: 0.9, count: 0, color: '#10b981' },
      { range: '80-89%', min: 0.8, count: 0, color: '#3b82f6' },
      { range: '70-79%', min: 0.7, count: 0, color: '#8b5cf6' },
      { range: '60-69%', min: 0.6, count: 0, color: '#f59e0b' },
      { range: '50-59%', min: 0.5, count: 0, color: '#ef4444' },
      { range: '<50%', min: 0, count: 0, color: '#6b7280' },
    ];

    results.forEach((result) => {
      const score = result.scores.combined;
      const bin = bins.find((b) => score >= b.min) || bins[bins.length - 1];
      bin.count++;
    });

    return bins.filter((bin) => bin.count > 0);
  }, [results]);

  const contentTypeDistribution = React.useMemo(() => {
    const types = new Map<string, number>();
    results.forEach((result) => {
      const type = result.metadata.contentType;
      types.set(type, (types.get(type) || 0) + 1);
    });

    return Array.from(types.entries())
      .map(([type, count]) => ({ type, count, percentage: (count / results.length) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [results]);

  const averageScores = React.useMemo(() => {
    if (results.length === 0) return {
      semantic: 0,
      keyword: 0,
      popularity: 0,
      freshness: 0,
      quality: 0,
      combined: 0,
    };

    const totals = {
      semantic: 0,
      keyword: 0,
      popularity: 0,
      freshness: 0,
      quality: 0,
      combined: 0,
    };

    results.forEach((result) => {
      totals.semantic += result.scores.semantic;
      totals.keyword += result.scores.keyword;
      totals.popularity += result.scores.popularity;
      totals.freshness += result.scores.freshness;
      totals.quality += result.scores.quality;
      totals.combined += result.scores.combined;
    });

    Object.keys(totals).forEach((key) => {
      (totals as any)[key] = (totals as any)[key] / results.length;
    });

    return totals;
  }, [results]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <PresentationChartBarIcon className="h-6 w-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Search Analytics</h2>
            </div>

            {/* Quick stats */}
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center space-x-1">
                <EyeIcon className="h-4 w-4" />
                <span>{results.length} results</span>
              </span>
              <span className="flex items-center space-x-1">
                <ClockIcon className="h-4 w-4" />
                <span>{searchTime}ms</span>
              </span>
              <span className="flex items-center space-x-1">
                <StarIcon className="h-4 w-4" />
                <span>{(averageScores.combined * 100).toFixed(0)}% avg</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search quality indicator */}
            {summary?.searchQuality && (
              <div
                className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getQualityStatusColor(summary.searchQuality)}`}
              >
                {getQualityIcon(summary.searchQuality)}
                <span className="capitalize">{summary.searchQuality} Results</span>
              </div>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Visualization settings"
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex space-x-1 mt-4">
          {[
            { id: 'overview', label: 'Overview', icon: ChartBarIcon },
            { id: 'scores', label: 'Score Analysis', icon: PresentationChartBarIcon },
            { id: 'factors', label: 'Top Factors', icon: SparklesIcon },
            { id: 'quality', label: 'Quality Insights', icon: CheckCircleIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Results By
              </label>
              <select
                onChange={(e) => onGroupingChange?.(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="none">No Grouping</option>
                <option value="score">Score Range</option>
                <option value="type">Content Type</option>
                <option value="confidence">Confidence Level</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Display Options</label>
              {[
                { id: 'showScoreBreakdown', label: 'Score Breakdown' },
                { id: 'showRelevanceFactors', label: 'Relevance Factors' },
                { id: 'highlightKeywords', label: 'Highlight Keywords' },
              ].map((option) => (
                <label key={option.id} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    onChange={(e) => onVisualizationToggle?.(option.id, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score Distribution */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Score Distribution</h3>
              <div className="space-y-3">
                {scoreDistribution.map((bin) => (
                  <div key={bin.range} className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-600 w-16">{bin.range}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                      <div
                        className="h-4 rounded-full transition-all duration-500"
                        style={{
                          width: `${(bin.count / results.length) * 100}%`,
                          backgroundColor: bin.color,
                        }}
                      />
                      <span className="absolute right-2 top-0 h-4 flex items-center text-xs font-medium text-gray-700">
                        {bin.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Type Distribution */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Content Types</h3>
              <div className="space-y-3">
                {contentTypeDistribution.map((item, index) => (
                  <div key={item.type} className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-600 w-20 capitalize">
                      {item.type}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className="h-3 rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-16 text-right">
                      {item.count} ({item.percentage.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scores' && (
          <div className="space-y-6">
            {/* Average Scores Breakdown */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Average Score Components</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { key: 'semantic', label: 'Semantic', icon: '🧠', color: '#3b82f6' },
                  { key: 'keyword', label: 'Keyword', icon: '🔍', color: '#10b981' },
                  { key: 'popularity', label: 'Popular', icon: '⭐', color: '#f59e0b' },
                  { key: 'freshness', label: 'Fresh', icon: '🕒', color: '#06b6d4' },
                  { key: 'quality', label: 'Quality', icon: '✅', color: '#8b5cf6' },
                  { key: 'combined', label: 'Combined', icon: '🎯', color: '#ef4444' },
                ].map((score) => (
                  <div key={score.key} className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-2">{score.icon}</div>
                    <div className="text-2xl font-bold mb-1" style={{ color: score.color }}>
                      {((averageScores as any)[score.key] * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-600">{score.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Score Trends */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Score Trends (Top 10 Results)
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Rank</span>
                  <span>Combined Score</span>
                </div>
                <div className="space-y-2">
                  {results.slice(0, 10).map((result, index) => (
                    <div key={result.id} className="flex items-center justify-between">
                      <span className="text-sm font-medium">#{index + 1}</span>
                      <div className="flex items-center space-x-2 flex-1 mx-4">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                            style={{ width: `${result.scores.combined * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {(result.scores.combined * 100).toFixed(0)}%
                      </span>
                      {index > 0 && (
                        <div className="ml-2">
                          {result.scores.combined > results[index - 1].scores.combined ? (
                            <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                          ) : result.scores.combined < results[index - 1].scores.combined ? (
                            <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'factors' && summary?.topFactors && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Most Common Relevance Factors
            </h3>
            <div className="space-y-3">
              {summary.topFactors.map((factor: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">{factor.factor}</div>
                      <div className="text-sm text-gray-600">
                        Found in {factor.count} of {results.length} results
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">
                      {factor.percentage.toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-500">prevalence</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-6">
            {/* Confidence Distribution */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Result Confidence Levels</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    level: 'high',
                    label: 'High Confidence',
                    color: 'bg-green-500',
                    count: summary?.confidenceLevels?.high || 0,
                  },
                  {
                    level: 'medium',
                    label: 'Medium Confidence',
                    color: 'bg-yellow-500',
                    count: summary?.confidenceLevels?.medium || 0,
                  },
                  {
                    level: 'low',
                    label: 'Low Confidence',
                    color: 'bg-red-500',
                    count: summary?.confidenceLevels?.low || 0,
                  },
                ].map((conf) => (
                  <div key={conf.level} className="text-center p-4 bg-gray-50 rounded-lg">
                    <div
                      className={`w-12 h-12 ${conf.color} rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-lg`}
                    >
                      {conf.count}
                    </div>
                    <div className="font-medium text-gray-900">{conf.label}</div>
                    <div className="text-sm text-gray-600">
                      {results.length > 0 ? ((conf.count / results.length) * 100).toFixed(0) : 0}%
                      of results
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality Insights */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quality Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2 flex items-center">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    Strengths
                  </h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>
                      • {results.filter((r) => r.scores.semantic > 0.7).length} results with strong
                      semantic match
                    </li>
                    <li>
                      • {results.filter((r) => r.scores.quality > 0.7).length} high-quality content
                      pieces
                    </li>
                    <li>
                      • {results.filter((r) => r.visualization.confidenceLevel === 'high').length}{' '}
                      highly confident matches
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2 flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                    Areas for Improvement
                  </h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>
                      • {results.filter((r) => r.scores.keyword < 0.3).length} results with low
                      keyword match
                    </li>
                    <li>
                      • {results.filter((r) => r.scores.quality < 0.5).length} results may have
                      quality issues
                    </li>
                    <li>
                      • {results.filter((r) => r.visualization.confidenceLevel === 'low').length}{' '}
                      low-confidence matches
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
