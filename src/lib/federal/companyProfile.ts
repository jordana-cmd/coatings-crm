// Client-side re-export of the canonical company capabilities profile.
// The canonical module lives in supabase/functions/_shared/ because Edge
// Function deploys can only bundle imports from inside supabase/functions/,
// while Vite can import from anywhere. Do not add client-only logic there.
export * from "../../../supabase/functions/_shared/companyProfile";
