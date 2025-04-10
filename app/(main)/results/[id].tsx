import { ResultsView } from '@/components/conversation/ResultsView';
import { AppBar } from '@/components/layout/AppBar';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/styles';
import { useConversation } from '@/hooks/useConversation';
import { useConversationResult } from '@/hooks/useConversationResult';
import useStore from '@/state';
import type { StoreState } from '@/state/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

export default function Results() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const conversationId = id as string;

  const { conversation, isLoading: conversationLoading, isError: conversationError } = useConversation(conversationId);
  const resultHook = useConversationResult(conversationId);
  const resultData = resultHook?.data;
  const isResultLoading = resultHook?.isLoading ?? true;
  const resultError = resultHook?.error;
  const refetchResult = resultHook?.refetch;

  const { uploadProgressMap, uploadResultsMap } = useStore(
    useShallow((state: StoreState) => ({
      uploadProgressMap: state.uploadProgress,
      uploadResultsMap: state.uploadResults,
    }))
  );

  const requiredUploadKeys = useMemo(() => {
      if (conversation?.recordingType === 'separate') return ['1', '2'];
      return ['live'];
  }, [conversation?.recordingType]);

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
              break;
          } else if (progress !== undefined && progress >= 0) {
              totalProgress += progress;
          } else {}
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


  const isLoading = conversationLoading || (uploadStatus.completed && isResultLoading);
  const finalError: string | null = resultError || uploadStatus.error || (conversationError ? 'Failed to load conversation details' : null);
  const finalStatus = uploadStatus.failed ? 'error' : 
                      !uploadStatus.completed ? 'uploading' : 
                      (resultData?.status || 'processing');

  const handleGoToHome = useCallback(() => {
    router.replace('../home');
  }, [router]);

  const retryUpload = useStore(state => state.retryUpload);

  const handleRetry = useCallback(() => {
      if (uploadStatus.failed) {
           for (const key of requiredUploadKeys) {
                const uploadId = `${conversationId}_${key}`;
                const result = uploadResultsMap[uploadId];
                 if (result?.error) {
                   retryUpload(uploadId);
                   break;
                 }
           }
      } else if (resultError && refetchResult) {
        refetchResult();
      }
  }, [uploadStatus.failed, requiredUploadKeys, conversationId, uploadResultsMap, resultError, refetchResult, retryUpload]);

  const accentColor = useMemo(() => {
    return conversation?.mode === 'mediator' ? '#58BD7D' :
           conversation?.mode === 'counselor' ? '#3B71FE' :
           colors.primary;
  }, [conversation?.mode]);

  if (!conversationId) {
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
    let loadingText = 'Loading...';
    let progressValue = 0;
    if (finalStatus === 'uploading') {
        loadingText = `Uploading audio... (${uploadStatus.progress}%)`;
        progressValue = uploadStatus.progress;
    } else if (finalStatus === 'processing') {
        loadingText = 'Processing your conversation...';
        progressValue = resultData?.progress ?? 0;
        if (progressValue === 0)
          loadingText = "Processing started...";
    }

    return (
      <Container withSafeArea>
        <AppBar title="Processing" showBackButton onBackPress={handleGoToHome} />
        <View style={styles.centeredMessageContainer}>
           <ActivityIndicator size="large" color={accentColor} />
           <Text style={styles.processingText}>{loadingText}</Text>
            {}
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

  return (
    <Container withSafeArea>
      <AppBar
        title="Results"
        showBackButton
        onBackPress={handleGoToHome}
      />
      <View style={{ flex: 1 }}>
         {}
        <ResultsView
          isLoading={false}
          result={finalStatus === 'completed' ? {
            status: 'completed',
            summary: resultData?.analysis || '',
            recommendations: [],
            progress: 100
          } : null}
          error={finalError}
          accentColor={accentColor}
          onNewConversation={handleGoToHome}
          onRetry={handleRetry}
          progress={finalStatus === 'completed' ? 100 : (resultData?.progress ?? 0)}
        />
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  centeredMessageContainer: { flex: 1,
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
    width: '80%',
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
});