import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type UnsubscribeState = "loading" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<UnsubscribeState>("loading");
  const [title, setTitle] = useState("Processing unsubscribe");
  const [message, setMessage] = useState("Please wait while we update your email preferences.");

  const id = searchParams.get("id");
  const token = searchParams.get("token");

  const query = useMemo(() => {
    if (!id || !token) return "";
    return `id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
  }, [id, token]);

  useEffect(() => {
    const unsubscribe = async () => {
      if (!query) {
        setState("error");
        setTitle("Invalid unsubscribe link");
        setMessage("This unsubscribe link is missing required information.");
        return;
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unsubscribe?${query}`, {
          method: "GET",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Accept: "application/json",
          },
        });

        const data = await response.json();
        setState(data.ok ? "success" : "error");
        setTitle(data.title || (data.ok ? "You have been unsubscribed" : "Invalid unsubscribe link"));
        setMessage(data.message || "Your request has been processed.");
      } catch {
        setState("error");
        setTitle("Something went wrong");
        setMessage("Please try again later or contact the sender directly.");
      }
    };

    unsubscribe();
  }, [query]);

  const isSuccess = state === "success";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6 py-12">
      <section className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${isSuccess ? "bg-success/10 text-success" : state === "loading" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
          {state === "loading" ? "…" : isSuccess ? "✓" : "!"}
        </div>
        <h1 className="mb-3 text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      </section>
    </main>
  );
};

export default Unsubscribe;