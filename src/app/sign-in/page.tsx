import { AuthForm } from "@/components/auth/auth-form";
import { isGoogleAuthConfigured } from "@/lib/auth";

export default function SignInPage() {
  return <AuthForm mode="sign-in" googleEnabled={isGoogleAuthConfigured} />;
}
