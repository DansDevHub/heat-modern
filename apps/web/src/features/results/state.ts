// apps/web/src/features/results/state.ts

import { create } from "zustand";
import { API_BASE } from "../../utils/apiBase";

type ParcelLookup =
  | { type: "point"; point: { x: number; y: number; spatialReference?: { wkid?: number } } }
  | { type: "folio"; folio: string }
  | { type: "locator"; text: string; magicKey?: string }; // NEW: autocomplete + composite locator

export type ResultRow = { label: string; value: string };

export type ParcelGeometry = {
  rings?: number[][][];
  x?: number;
  y?: number;
  spatialReference?: { wkid?: number };
};

export type Results = {
  // Option A: use sections as the primary container for grouped results
  sections?: Record<string, ResultRow[]>;
  rows: ResultRow[];
  error?: string;
  parcel?: {
    geometry: ParcelGeometry;
    attributes: any;
  };
};

type ResultsState = {
  lookup: ParcelLookup | null;
  results: Results | null;
  loading: boolean;
  panelActive: boolean; // Whether the Results panel is open

  setLastClick: (l: ParcelLookup) => void;
  runLookup: (l: ParcelLookup) => Promise<void>;
  clearResults: () => void;
  setPanelActive: (active: boolean) => void;
};

export const useResultsStore = create<ResultsState>((set) => ({
  lookup: null,
  results: null,
  loading: false,
  panelActive: false,

  setPanelActive: (active) => set({ panelActive: active }),

  setLastClick: (l) => {
    console.log("State: setLastClick called with:", l);
    set({ lookup: l });
  },

  runLookup: async (l) => {
    // NOTE: do NOT set lookup here; ResultsPanel watches lookup and calls runLookup.
    // This prevents double-submits when the panel triggers a lookup.
    console.log("State: runLookup called with:", l);
    set({ loading: true, results: null });

    try {
      console.log("State: fetching /api/results");
      const resp = await fetch(`${API_BASE}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(l),
      });

      const json = await resp.json();
      console.log("State: API response:", resp.ok, json);
      if (!resp.ok) throw new Error(json?.error?.message ?? json?.error ?? "No parcel found at that location.");

      console.log("State: setting results");
      set({
        results: {
          // Pull Site Info from sections.SiteInfo (Option A contract)
          sections: json.sections ?? {},
          rows: json.rows ?? [],
          parcel: json.parcel ?? null,
        },
        loading: false,
      });
    } catch (e: any) {
      console.log("State: error in runLookup:", e);
      set({
        results: { rows: [], sections: {}, error: e?.message ?? String(e) },
        loading: false,
      });
    }
  },

  clearResults: () => {
    set({ lookup: null, results: null, loading: false });
  },
}));

