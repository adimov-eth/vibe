# Vibe Project Guidelines

## Commands
- Development: `pnpm start` or `expo start`
- iOS build: `pnpm ios`
- Android build: `pnpm android`
- Web build: `pnpm web`
- Testing: `pnpm test` (all tests), `pnpm test -- -t "test name"` (single test)
- Linting: `pnpm lint`
- Project reset: `pnpm reset-project`

## Code Style
- **TypeScript**: Use strict mode and proper typing
- **Imports**: Group by source (React first, then third-party, then local)
- **Components**: Functional components with hooks, typed props interfaces
- **Naming**: PascalCase for components/types, camelCase for functions/variables
- **Paths**: Use absolute paths with @/* alias
- **State**: Zustand for global state, React hooks for local state
- **Error Handling**: Try/catch for async operations, dedicated error components
- **File Structure**: Organized by feature type (ui/, forms/, conversation/, etc.)
- **Testing**: Jest/Expo testing library for component tests
- **Formatting**: Maintain consistent indentation and spacing

## Project Architecture
- Expo Router for navigation
- Zustand + immer for state management
- React Hook Form with Zod validation
- WebSocket for real-time communication
- Expo modules for device features