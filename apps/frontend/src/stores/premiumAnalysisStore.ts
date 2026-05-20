import axios from "axios";
import { create } from "zustand";
import {
  getPremiumCatch,
  getPremiumPersonalFit,
  getPremiumStory,
  getPremiumTwins,
  getPremiumVerdict,
  type PremiumCatchResponse,
  type PremiumPersonalFitResponse,
  type PremiumStoryResponse,
  type PremiumTwinsResponse,
  type PremiumVerdictResponse,
} from "../services/api";

type PremiumScreen = 1 | 2 | 3 | 4 | 5;

type LoadingState = {
  verdict: boolean;
  personalFit: boolean;
  story: boolean;
  twins: boolean;
  catch: boolean;
};

type ErrorState = {
  verdict: string | null;
  personalFit: string | null;
  story: string | null;
  twins: string | null;
  catch: string | null;
};

interface PremiumAnalysisState {
  ticker: string | null;
  verdict: PremiumVerdictResponse | null;
  personalFit: PremiumPersonalFitResponse | null;
  story: PremiumStoryResponse | null;
  twins: PremiumTwinsResponse | null;
  catchData: PremiumCatchResponse | null;
  currentScreen: PremiumScreen;
  isLoading: LoadingState;
  errors: ErrorState;

  loadAnalysis: (ticker: string, userId: string, language?: string) => Promise<void>;
  navigateToScreen: (n: number) => void;
  reset: () => void;
}

const initialLoading: LoadingState = {
  verdict: false,
  personalFit: false,
  story: false,
  twins: false,
  catch: false,
};

const initialErrors: ErrorState = {
  verdict: null,
  personalFit: null,
  story: null,
  twins: null,
  catch: null,
};

function toError(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 429) {
    return "Monthly premium analysis limit reached. Upgrade to Pro for more.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Request failed";
}

export const usePremiumAnalysisStore = create<PremiumAnalysisState>((set) => ({
  ticker: null,
  verdict: null,
  personalFit: null,
  story: null,
  twins: null,
  catchData: null,
  currentScreen: 1,
  isLoading: initialLoading,
  errors: initialErrors,

  async loadAnalysis(ticker: string, userId: string, language = "en") {
    const normalized = ticker.toUpperCase();
    set({
      ticker: normalized,
      currentScreen: 1,
      isLoading: {
        verdict: true,
        personalFit: true,
        story: true,
        twins: true,
        catch: true,
      },
      errors: initialErrors,
      verdict: null,
      personalFit: null,
      story: null,
      twins: null,
      catchData: null,
    });

    const verdictTask = getPremiumVerdict(normalized)
      .then((payload) => set((state) => ({ verdict: payload, isLoading: { ...state.isLoading, verdict: false } })))
      .catch((error) =>
        set((state) => ({
          errors: { ...state.errors, verdict: toError(error) },
          isLoading: { ...state.isLoading, verdict: false },
        })),
      );

    const personalTask = new Promise<void>((resolve) => {
      setTimeout(() => {
        void getPremiumPersonalFit(normalized, userId)
          .then((payload) =>
            set((state) => ({
              personalFit: payload,
              isLoading: { ...state.isLoading, personalFit: false },
            })),
          )
          .catch((error) =>
            set((state) => ({
              errors: { ...state.errors, personalFit: toError(error) },
              isLoading: { ...state.isLoading, personalFit: false },
            })),
          )
          .finally(resolve);
      }, 100);
    });

    const storyTask = new Promise<void>((resolve) => {
      setTimeout(() => {
        void getPremiumStory(normalized, language, "intermediate")
          .then((payload) => set((state) => ({ story: payload, isLoading: { ...state.isLoading, story: false } })))
          .catch((error) =>
            set((state) => ({
              errors: { ...state.errors, story: toError(error) },
              isLoading: { ...state.isLoading, story: false },
            })),
          )
          .finally(resolve);
      }, 500);
    });

    const twinsTask = new Promise<void>((resolve) => {
      setTimeout(() => {
        void getPremiumTwins(normalized)
          .then((payload) => set((state) => ({ twins: payload, isLoading: { ...state.isLoading, twins: false } })))
          .catch((error) =>
            set((state) => ({
              errors: { ...state.errors, twins: toError(error) },
              isLoading: { ...state.isLoading, twins: false },
            })),
          )
          .finally(resolve);
      }, 1000);
    });

    const catchTask = new Promise<void>((resolve) => {
      setTimeout(() => {
        void getPremiumCatch(normalized)
          .then((payload) => set((state) => ({ catchData: payload, isLoading: { ...state.isLoading, catch: false } })))
          .catch((error) =>
            set((state) => ({
              errors: { ...state.errors, catch: toError(error) },
              isLoading: { ...state.isLoading, catch: false },
            })),
          )
          .finally(resolve);
      }, 1500);
    });

    await Promise.all([verdictTask, personalTask, storyTask, twinsTask, catchTask]);
  },

  navigateToScreen(n: number) {
    const clamped = Math.min(5, Math.max(1, Math.round(n))) as PremiumScreen;
    set({ currentScreen: clamped });
  },

  reset() {
    set({
      ticker: null,
      verdict: null,
      personalFit: null,
      story: null,
      twins: null,
      catchData: null,
      currentScreen: 1,
      isLoading: initialLoading,
      errors: initialErrors,
    });
  },
}));
