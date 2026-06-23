import { supabaseConfigured } from "./lib/supabase";

function App() {
  return (
    <div className="min-h-svh flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Coatings CRM
        </h1>
        <p
          className={`text-sm font-medium ${
            supabaseConfigured ? "text-green-600" : "text-red-500"
          }`}
        >
          Supabase: {supabaseConfigured ? "connected" : "missing env"}
        </p>
      </div>
    </div>
  );
}

export default App;
