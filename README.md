# Vibe - Voice Assistant App

This is an [Expo](https://expo.dev) project that provides voice-based AI interactions.

## Comprehensive Setup Guide

### Prerequisites
- Node.js (recommended: v18+)
- PNPM package manager (v10.6.3+)
- Expo CLI: `npm install -g expo-cli eas-cli`
- Expo account (create at [expo.dev](https://expo.dev))
- Xcode (for iOS builds)
- Android Studio (for Android builds)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd vibe
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory with:
   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
   ```

4. **Run the development server**
   ```bash
   pnpm start
   # or
   expo start
   ```

### Local Development

- **iOS Simulator**: Press `i` in terminal or select iOS from Expo DevTools
- **Android Emulator**: Press `a` in terminal or select Android from Expo DevTools
- **Web**: `pnpm web`

### Building with EAS (Expo Application Services)

1. **Login to Expo**
   ```bash
   eas login
   ```

2. **Configure your project**
   The project already has an `eas.json` file with build profiles

3. **Run a development build**
   ```bash
   eas build --profile development --platform [ios|android]
   ```

4. **Run a preview build**
   ```bash
   eas build --profile preview --platform [ios|android]
   ```

5. **Run a production build**
   ```bash
   eas build --profile production --platform [ios|android]
   ```

6. **Submit to app stores**
   ```bash
   eas submit --platform [ios|android] --latest
   ```

### Additional Commands

- **iOS build**: `pnpm ios`
- **Android build**: `pnpm android`
- **Web build**: `pnpm web`
- **Run linting**: `pnpm lint`
- **Run tests**: `pnpm test`
- **Reset project**: `pnpm reset-project`

### Project Architecture
- Expo Router for navigation
- Zustand + immer for state management
- React Hook Form with Zod validation
- WebSocket for real-time communication
- Expo modules for device features
- Clerk for authentication

## Troubleshooting

- **Environment Variables**: If Clerk authentication fails, ensure your Clerk publishable key is correctly set
- **Native Module Issues**: Refer to `registerNativeModules.js` if experiencing native module problems
- **Build Errors**: Check Expo's documentation for platform-specific build requirements

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
- [EAS Build documentation](https://docs.expo.dev/build/introduction/)