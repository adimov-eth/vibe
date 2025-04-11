import { useAuthentication } from "@/hooks/useAuthentication";
import { Redirect } from 'expo-router';

export default function Index() {
  console.warn("[Index] Component rendering...");
  const { isAuthenticated, isLoading } = useAuthentication();
  
  if (isLoading) {
    return null;
  }
  
  if (isAuthenticated) {
    return <Redirect href="/(main)/home" />;
  }
  
  return <Redirect href="/(auth)/authenticate" />;
}