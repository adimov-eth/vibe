// services/recordingService.ts
import {
    Audio,
    InterruptionModeAndroid, // Import directly
    InterruptionModeIOS // Import directly
} from 'expo-av';
import * as FileSystem from 'expo-file-system';

// Interface for internal tracking
interface RecordingInstance {
  recording: Audio.Recording;
  uri: string | null; // URI becomes available after stopping
}

// Module-level variable to hold the single active recording instance
let currentRecordingInstance: RecordingInstance | null = null;

/**
 * Checks microphone permissions and requests if necessary.
 * @returns {Promise<boolean>} True if permission granted, false otherwise.
 */
export const checkPermissions = async (): Promise<boolean> => {
  console.log("[RecordingService] Checking microphone permissions...");
  try {
    const { status: currentStatus } = await Audio.getPermissionsAsync();
    if (currentStatus === 'granted') {
      console.log("[RecordingService] Microphone permission already granted.");
      return true;
    }
    console.log("[RecordingService] Requesting microphone permission...");
    const { status: newStatus } = await Audio.requestPermissionsAsync();
    console.log(`[RecordingService] Permission request result: ${newStatus}`);
    return newStatus === 'granted';
  } catch (err) {
    console.error('[RecordingService] Permission check/request failed:', err);
    return false;
  }
};

/**
 * Configures the application's audio mode for recording.
 */
export const setupAudioMode = async (): Promise<void> => {
  console.log("[RecordingService] Setting up audio mode...");
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
    console.log("[RecordingService] Audio mode set successfully.");
  } catch (err) {
    console.error('[RecordingService] Failed to set audio mode:', err);
    // Propagate the error or handle it based on application needs
    throw new Error('Failed to initialize audio recording session');
  }
};

/**
 * Resets the application's audio mode when recording is no longer needed.
 */
export const cleanupAudioMode = async (): Promise<void> => {
  console.log("[RecordingService] Cleaning up audio mode...");
  try {
    // Reset to a default state or previous state if managed
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false, // Disable recording capability
      // Restore other settings to defaults if needed
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      // Reset interruption modes by not setting them (uses defaults)
    });
     console.log("[RecordingService] Audio mode cleaned up.");
  } catch (err) {
    console.error('[RecordingService] Failed to cleanup audio mode:', err);
    // Log error but don't necessarily block app flow
  }
};

/**
 * Starts a new audio recording. Cleans up any existing recording first.
 * @returns {Promise<Audio.Recording>} The active recording object.
 * @throws If permission is denied or recording fails to start.
 */
export const startRecording = async (): Promise<Audio.Recording> => {
  console.log("[RecordingService] Attempting to start recording...");
  
  // 1. Cleanup any existing recording instance
  if (currentRecordingInstance) {
    console.warn("[RecordingService] Existing recording instance found. Cleaning up before starting new one.");
    await cleanupCurrentRecording(); // Use internal cleanup
  }

  // 2. Check Permissions
  const hasPermission = await checkPermissions();
  if (!hasPermission) {
    throw new Error('Microphone permission denied');
  }

  // 3. Prepare and Start Recording
  try {
    console.log('[RecordingService] Creating and preparing new recording instance...');
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      android: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
        numberOfChannels: 1,
      },
      ios: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
        numberOfChannels: 1,
        // Sample rate and bit depth could be specified for more control if needed
        // sampleRate: 44100,
        // bitRate: 128000, 
      }
    });
    console.log('[RecordingService] Recording prepared. Starting...');

    await recording.startAsync();
    console.log('[RecordingService] Recording started successfully.');
    
    // Store the new instance
    currentRecordingInstance = { recording, uri: null }; 
    return recording; // Return the active recording object

  } catch (err) {
    console.error('[RecordingService] Failed to start recording:', err);
    // Ensure cleanup if start fails
    await cleanupCurrentRecording(); 
    throw new Error(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`);
  }
};

/**
 * Stops the current recording, unloads resources, and returns the URI.
 * @returns {Promise<string | null>} The URI of the recorded file, or null if no recording was active or failed.
 */
export const stopRecording = async (): Promise<string | null> => {
  if (!currentRecordingInstance) {
    console.warn("[RecordingService] Stop called but no active recording instance found.");
    return null;
  }
  console.log("[RecordingService] Stopping recording...");

  const { recording } = currentRecordingInstance;
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    console.log(`[RecordingService] Recording stopped and unloaded. URI: ${uri}`);
    
    // Store URI in the (now inactive) instance temporarily if needed, then clear
    // currentRecordingInstance.uri = uri; // Not strictly needed if we return it directly
    
    currentRecordingInstance = null; // Clear the active instance
    
    return uri;
  } catch (err) {
    console.error('[RecordingService] Failed to stop or unload recording:', err);
    // Attempt cleanup even if stop failed
    await cleanupCurrentRecording(); // Clears the potentially broken instance
    return null;
  }
};

/**
 * Cleans up the current recording instance (stops, unloads) and optionally deletes a specified audio file.
 * Ensures the module-level `currentRecordingInstance` is cleared.
 * @param {string} [fileUriToDelete] - Optional URI of the audio file to delete.
 */
export const cleanupCurrentRecording = async (fileUriToDelete?: string): Promise<void> => {
  console.log(`[RecordingService] Cleanup requested. URI to delete: ${fileUriToDelete || 'None'}`);
  const instanceToClean = currentRecordingInstance; // Capture instance before clearing
  currentRecordingInstance = null; // Clear immediately

  // 1. Stop and Unload Recording Object if it exists
  if (instanceToClean) {
    console.log("[RecordingService] Cleaning up active/previous recording object...");
    try {
      const status = await instanceToClean.recording.getStatusAsync();
      if (status.isRecording) {
        await instanceToClean.recording.stopAndUnloadAsync();
        console.log("[RecordingService] Stopped and unloaded active recording.");
      } else if (status.canRecord) { // It might be prepared but not recording, or stopped but not unloaded
        // Attempt unload using stopAndUnloadAsync if necessary, 
        // but usually stopAndUnloadAsync is called during stopRecording.
        // If status.canRecord is true after stopAndUnloadAsync was presumably called,
        // it might indicate an issue, but calling unloadAsync is incorrect.
        // Consider logging a warning instead or relying on stopAndUnloadAsync during stop.
        // await instanceToClean.recording.unloadAsync(); // REMOVED incorrect call
         console.log("[RecordingService] Recording object was inactive but potentially not fully unloaded.");
      }
    } catch (err) {
      // Use _cleanupForUnloadedRecorder as a fallback if available and needed
      // @ts-ignore - Check if internal cleanup exists
      if (typeof instanceToClean.recording._cleanupForUnloadedRecorder === 'function') {
        try {
           // @ts-ignore - Call internal cleanup
          await instanceToClean.recording._cleanupForUnloadedRecorder();
          console.log("[RecordingService] Called internal recorder cleanup as fallback.");
        } catch (cleanupErr) {
           console.warn('[RecordingService] Error during fallback internal cleanup:', cleanupErr);
        }
      } else {
           console.warn('[RecordingService] Error stopping/unloading recording object during cleanup:', err);
      }
    }
  }

  // 2. Delete specified file URI if provided
  if (fileUriToDelete) {
    console.log(`[RecordingService] Attempting to delete specified file: ${fileUriToDelete}`);
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUriToDelete);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUriToDelete, { idempotent: true });
        console.log(`[RecordingService] Deleted file: ${fileUriToDelete}`);
      } else {
        console.log(`[RecordingService] File not found for deletion: ${fileUriToDelete}`);
      }
    } catch (deleteErr) {
      console.error(`[RecordingService] Failed to delete file ${fileUriToDelete}:`, deleteErr);
    }
  }
   console.log("[RecordingService] Cleanup finished.");
};