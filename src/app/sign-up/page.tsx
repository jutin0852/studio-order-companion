import { AuthForm } from "@/components/auth/auth-form";
import { isGoogleAuthConfigured } from "@/lib/auth";

export default function SignUpPage() {
  return <AuthForm mode="sign-up" googleEnabled={isGoogleAuthConfigured} />;
}
