import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface RecordingInstance {
  recording: Audio.Recording;
  uri: string | null;
}

// Single recording instance to ensure proper resource management
let currentRecordingInstance: RecordingInstance | null = null;

/**
 * Check or request microphone permissions
 */
export const checkPermissions = async (): Promise<boolean> => {
  try {
    const { status: currentStatus } = await Audio.getPermissionsAsync();
    if (currentStatus === 'granted') {
      return true;
    }
    const { status: newStatus } = await Audio.requestPermissionsAsync();
    return newStatus === 'granted';
  } catch {
    return false;
  }
};

/**
 * Configure audio session for recording
 */
export const setupAudioMode = async (): Promise<void> => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    });
  } catch (err) {
    throw new Error('Failed to initialize audio recording session');
  }
};

/**
 * Reset audio session after recording
 */
export const cleanupAudioMode = async (): Promise<void> => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // Non-critical error - ignore
  }
};

/**
 * Start recording with proper initialization and error handling
 */
export const startRecording = async (): Promise<Audio.Recording> => {
  // Clean up any existing recording first
  await cleanupCurrentRecording();
  
  // Verify permissions
  const hasPermission = await checkPermissions();
  if (!hasPermission) {
    throw new Error('Microphone permission denied');
  }

  let newRecording: Audio.Recording | null = null;
  
  try {
    // Ensure audio mode is properly configured
    await setupAudioMode();
    
    // Create and prepare new recording
    newRecording = new Audio.Recording();
    await newRecording.prepareToRecordAsync({
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      android: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
        numberOfChannels: 1,
      },
      ios: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
        numberOfChannels: 1,
      }
    });
    
    // Start recording with timeout protection
    const startPromise = newRecording.startAsync();
    const timeoutPromise = new Promise<void>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Recording start timed out'));
      }, 3000);
      
      // The timeout will be cleared when either promise resolves/rejects
      startPromise.finally(() => clearTimeout(timeoutId));
    });
    
    // Race between the actual operation and timeout
    await Promise.race([startPromise, timeoutPromise]);
    
    // If successful, store the instance and return
    currentRecordingInstance = { recording: newRecording, uri: null };
    return newRecording;
  } catch (err) {
    // Clean up on error
    if (newRecording) {
      try {
        await cleanupSpecificInstance(newRecording);
      } catch {
        // Ignore cleanup errors
      }
    }
    
    currentRecordingInstance = null;
    throw new Error(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`);
  }
};

/**
 * Stop the current recording and return the file URI
 */
export const stopRecording = async (): Promise<string | null> => {
  const instanceToStop = currentRecordingInstance;
  if (!instanceToStop) {
    return null;
  }

  const { recording } = instanceToStop;
  currentRecordingInstance = null;

  try {
    const status = await recording.getStatusAsync();
    if (!status.isRecording) {
      await cleanupSpecificInstance(recording);
      return null;
    }

    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // If standard stop fails, try emergency cleanup
      if (typeof recording._cleanupForUnloadedRecorder === 'function') {
        await recording._cleanupForUnloadedRecorder();
      }
    }

    return recording.getURI();
  } catch {
    try {
      await cleanupSpecificInstance(recording);
    } catch {
      // Ignore cleanup errors
    }
    return null;
  }
};

/**
 * Clean up the current recording instance and optionally delete the file
 */
export const cleanupCurrentRecording = async (fileUriToDelete?: string): Promise<void> => {
  const instanceToClean = currentRecordingInstance;
  currentRecordingInstance = null;
  
  if (instanceToClean) {
    await cleanupSpecificInstance(instanceToClean.recording);
  }

  if (fileUriToDelete) {
    await deleteFile(fileUriToDelete);
  }
};

/**
 * Clean up a specific recording instance
 */
async function cleanupSpecificInstance(recording: Audio.Recording): Promise<void> {
  try {
    await recording.stopAndUnloadAsync();
  } catch {
    // If standard cleanup fails, try emergency cleanup
    if (typeof recording._cleanupForUnloadedRecorder === 'function') {
      try {
        await recording._cleanupForUnloadedRecorder();
      } catch {
        // Ignore further cleanup errors
      }
    }
  }
}

/**
 * Delete a file if it exists
 */
async function deleteFile(fileUri: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch {
    // Ignore file deletion errors
  }
}