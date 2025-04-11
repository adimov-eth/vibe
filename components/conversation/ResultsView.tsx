// /Users/adimov/Developer/final/vibe/components/conversation/ResultsView.tsx
import type { ConversationResult } from '@/state/types'; // Import ConversationResult type
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ErrorView } from './ErrorView';
import { LoadingView } from './LoadingView';

// Define the possible statuses more explicitly
type ResultStatus = 'uploading' | 'processing' | 'completed' | 'error';

interface ResultsViewProps {
  status: ResultStatus;
  resultData: ConversationResult | null; // Raw data from WS hook
  error: string | null;
  progress: number;
  accentColor: string;
  onNewConversation: () => void;
  onRetry?: () => void; // Make retry optional
  testID?: string;
}

interface RecommendationProps {
  text: string;
  index: number;
  accentColor: string;
}

const Recommendation: React.FC<RecommendationProps> = ({ text, index, accentColor }) => (
  <View style={styles.recommendationItem}>
    <View style={[styles.recommendationBullet, { backgroundColor: accentColor }]}>
      <Text style={styles.recommendationNumber}>{index + 1}</Text>
    </View>
    <Text style={styles.recommendationText}>{text}</Text>
  </View>
);

/**
 * Displays the analysis results of a conversation, including loading state,
 * errors, and the actual analysis content.
 */
export const ResultsView: React.FC<ResultsViewProps> = ({
  status,
  resultData,
  error,
  progress,
  accentColor,
  onNewConversation,
  onRetry,
  testID,
}) => {
  // Handle loading state (uploading or processing)
  if (status === 'uploading' || status === 'processing') {
    return (
      <LoadingView
        progress={progress}
        accentColor={accentColor}
        testID={testID}
      />
    );
  }

  // Handle error state
  if (status === 'error') {
    return (
      <ErrorView
        message={error || 'An unknown error occurred.'} // Use the error message passed in
        onRetry={onRetry} // Pass retry handler if available
        onNewConversation={onNewConversation}
        testID={testID}
      />
    );
  }

  // Handle completed state
  if (status === 'completed') {
    // Check if essential data exists for completed state
    if (!resultData || !resultData.analysis) {
      // Data is missing even though status is completed
      return (
        <ErrorView
          message="Analysis results are missing or incomplete. Please try starting a new conversation."
          title="Results Unavailable"
          icon="document-outline"
          iconColor="#64748b"
          onNewConversation={onNewConversation}
          testID={testID}
        />
      );
    }

    // --- Render Completed Results ---
    const summary = resultData.analysis; // Analysis should exist here
    // Assuming recommendations might be part of the analysis string or a separate field later
    const recommendations: string[] = []; // Placeholder - Adapt if recommendations become available

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        testID={testID}
      >
        <Card style={[styles.summaryCard, { borderColor: accentColor }]}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <Text style={styles.summaryText}>{summary}</Text>
        </Card>

        {recommendations.length > 0 && (
          <Card style={styles.recommendationsCard}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {recommendations.map((recommendation, index) => (
              <Recommendation
                key={index}
                text={recommendation}
                index={index}
                accentColor={accentColor}
              />
            ))}
          </Card>
        )}

        <Button
          title="New Conversation"
          onPress={onNewConversation}
          variant="primary"
          size="large"
          style={styles.newButton}
        />
      </ScrollView>
    );
  }

  // Fallback for unexpected status (shouldn't be reached with defined types)
  return (
      <ErrorView
        message="An unexpected state occurred while loading results."
        title="Unexpected State"
        onNewConversation={onNewConversation}
        testID={testID}
      />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    marginBottom: 24,
    borderLeftWidth: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
  },
  recommendationsCard: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  recommendationBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  recommendationNumber: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  recommendationText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
  },
  newButton: {
    marginTop: 16,
  },
});