import { supabase } from "@/lib/supabase";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.length > 0 && password.length > 0 && !submitting;

  async function signIn() {
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    // On success AuthProvider's onAuthStateChange flips status to signedIn and
    // this group's layout redirects -- nothing to navigate to by hand.
    if (signInError) setError(signInError.message);
    setSubmitting(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-start gap-4 p-6 pt-32 web:mx-auto web:w-full web:max-w-[400px]">
        <Text className="text-2xl font-semibold">AnteCat</Text>
        <Text className="text-base text-neutral-500">
          Sign in with a seeded account.
        </Text>

        <TextInput
          className="rounded-lg border border-neutral-300 px-3 py-3"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
        />
        <TextInput
          className="rounded-lg border border-neutral-300 px-3 py-3"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          onSubmitEditing={() => {
            if (canSubmit) signIn();
          }}
        />

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={signIn}
          className={`flex-row items-center justify-center rounded-lg px-4 py-3 ${
            canSubmit ? "bg-blue-600" : "bg-neutral-300"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-white">Sign in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
