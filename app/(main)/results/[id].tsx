import { ResultsView } from '@/components/conversation/ResultsView';
import { AppBar } from '@/components/layout/AppBar';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/styles';
import { useConversation } from '@/hooks/useConversation';
import { useConversationResult } from '@/hooks/useConversationResult';
import useStore from '@/state'; // Import useStore
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function Results() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const conversationId = id as string; // This is the SERVER ID

  // --- Hooks ---
  const { conversation, isLoading: conversationLoading, isError: conversationError } = useConversation(conversationId);
  const resultHook = useConversationResult(conversationId);
  const resultData = resultHook?.data; // Data from WebSocket (transcript, analysis, status)
  const isResultLoading = resultHook?.isLoading ?? true; // Loading state from WebSocket hook
  const resultError = resultHook?.error;
  const refetchResult = resultHook?.refetch;

  // Get upload status from store
  const uploadProgressMap = useStore(state => state.uploadProgress);
  const uploadResultsMap = useStore(state => state.uploadResults);

  // --- State Calculation ---

  // Determine required upload keys based on conversation mode (fallback to 'live' if loading)
  const requiredUploadKeys = useMemo(() => {
      if (conversation?.recordingType === 'separate') return ['1', '2'];
      return ['live']; // Default to live or if conversation is loading
  }, [conversation?.recordingType]);

  // Calculate overall upload progress and status
  const uploadStatus = useMemo(() => {
      let totalProgress = 0;
      let completedCount = 0;
      let failed = false;
      let errorMessage: string | undefined;

      if (!conversationId) return { progress: 0, completed: false, failed: false };

      for (const key of requiredUploadKeys) {
          const uploadId = `${conversationId}_${key}`;
          const progress = uploadProgressMap[uploadId];
          const result = uploadResultsMap[uploadId];

          if (result?.success) {
              totalProgress += 100;
              completedCount++;
          } else if (result?.error) {
              failed = true;
              errorMessage = result.error;
              break; // Stop checking if one fails
          } else if (progress !== undefined && progress >= 0) {
              totalProgress += progress; // Add current progress if upload is ongoing
          } else {
              // No result, no progress -> assume 0% for this key
          }
      }

      const overallProgress = requiredUploadKeys.length > 0 ? Math.round(totalProgress / requiredUploadKeys.length) : 0;
      const allUploadsComplete = completedCount === requiredUploadKeys.length;

      return {
          progress: overallProgress,
          completed: allUploadsComplete && !failed,
          failed: failed,
          error: errorMessage
      };
  }, [conversationId, requiredUploadKeys, uploadProgressMap, uploadResultsMap]);


  // Determine overall state: Uploading -> Processing (WebSocket) -> Completed/Error
  const isLoading = conversationLoading || (uploadStatus.completed && isResultLoading);
  // Combine errors: WS result error OR upload error OR conversation fetch error
  const finalError: string | null = resultError || uploadStatus.error || (conversationError ? 'Failed to load conversation details' : null);
  // Determine status: Start with upload status, then WS status
  const finalStatus = uploadStatus.failed ? 'error' : 
                      !uploadStatus.completed ? 'uploading' : 
                      (resultData?.status || 'processing'); // If uploads done, use WS status (or 'processing' if WS hasn't reported yet)

  // --- Handlers ---
  const handleGoToHome = React.useCallback(() => {
    router.replace('../home');
  }, [router]);

  const handleRetry = () => {
      if (uploadStatus.failed) {
           // Find the failed upload ID and retry it
           for (const key of requiredUploadKeys) {
                const uploadId = `${conversationId}_${key}`;
                const result = uploadResultsMap[uploadId];
                 if (result?.error) {
                    console.log(`[ResultsScreen] Retrying failed upload: ${uploadId}`);
                    useStore.getState().retryUpload(uploadId);
                    break; // Retry one at a time
                 }
           }
      } else if (resultError) {
          console.log(`[ResultsScreen] Retrying WebSocket connection/fetch for: ${conversationId}`);
          refetchResult && refetchResult();
      }
  };

  // --- UI ---
  const accentColor = React.useMemo(() => {
    return conversation?.mode === 'mediator' ? '#58BD7D' :
           conversation?.mode === 'counselor' ? '#3B71FE' :
           colors.primary;
  }, [conversation?.mode]);

  // Loading/Error States
  if (!conversationId) {
      // Render error for missing ID
       return (
           <Container withSafeArea>
              <AppBar title="Error" showBackButton onBackPress={handleGoToHome} />
              <View style={styles.centeredMessageContainer}>
                 <Text style={styles.errorTitle}>Missing ID</Text>
                 <Text style={styles.errorMessage}>Cannot load results without a conversation ID.</Text>
                 <Button title="Go Home" onPress={handleGoToHome} variant="primary" />
              </View>
           </Container>
       );
  }

  if (isLoading && !finalError && finalStatus !== 'completed') {
    // Render loading indicator (Upload or Processing)
    let loadingText = 'Loading...';
    let progressValue = 0;
    if (finalStatus === 'uploading') {
        loadingText = `Uploading audio... (${uploadStatus.progress}%)`;
        progressValue = uploadStatus.progress;
    } else if (finalStatus === 'processing') {
        loadingText = 'Processing your conversation...';
        // Use resultData.progress if available from WebSocket, otherwise show indeterminate/simple message
        progressValue = resultData?.progress ?? 0; // Default to 0 if no specific progress from WS yet
        if (progressValue === 0) loadingText = "Processing started..."; // More specific message if progress is 0
    }

    return (
       <Container withSafeArea>
          <AppBar title="Processing" showBackButton onBackPress={handleGoToHome} />
          <View style={styles.centeredMessageContainer}>
             <ActivityIndicator size="large" color={accentColor} />
             <Text style={styles.processingText}>{loadingText}</Text>
              {/* Show progress bar only if progress > 0 */}
             {progressValue > 0 && (
                <View style={styles.progressContainer}>
                   <View style={styles.progressBackground}>
                      <View style={[styles.progressBar, { width: `${progressValue}%`, backgroundColor: accentColor }]} />
                   </View>
                   <Text style={[styles.progressText, typography.label2]}>{progressValue}%</Text>
                </View>
             )}
          </View>
       </Container>
    );
  }

  // Render ResultsView (Completed or Error)
  return (
    <Container withSafeArea>
      <AppBar
        title="Results"
        showBackButton
        onBackPress={handleGoToHome}
      />
      <View style={{ flex: 1 }}>
         {/* Pass calculated status and potentially merged error message */}
        <ResultsView
          isLoading={false} // Already handled loading state above
          result={finalStatus === 'completed' ? {
            status: 'completed',
            summary: resultData?.analysis || '', // Use analysis from resultData
            recommendations: [], // Add recommendations if available later
            progress: 100
          } : null}
          error={finalError} // Pass combined error string (already a string or null)
          accentColor={accentColor}
          onNewConversation={handleGoToHome}
          onRetry={handleRetry} // Pass unified retry handler
          // Provide a default progress value for the final state
          progress={finalStatus === 'completed' ? 100 : (resultData?.progress ?? 0)}
        />
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  centeredMessageContainer: { // Renamed from errorContainer/processingContainer
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.heading2,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  errorMessage: {
    ...typography.body1,
    marginBottom: spacing.xl,
    textAlign: 'center',
    color: colors.text.secondary,
  },
  processingText: {
    ...typography.body1,
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.text.secondary,
  },
  progressContainer: {
    width: '80%', // Adjust width as needed
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  progressBackground: {
    width: '100%',
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  progressText: {
    marginTop: spacing.xs,
    color: colors.text.secondary,
  },
  // Removed unused styles like container, connectionInfoContainer etc.
});