import {
  LearningProgress,
  PaperPortfolio,
  PaperPosition,
  PaperTrade,
  VerificationReport,
} from '../types';

const STORAGE_KEYS = {
  PROGRESS: 'artha_learning_progress_v1',
  NOTES: 'artha_learning_notes_v1',
  BOOKMARKS: 'artha_learning_bookmarks_v1',
  QUIZ_HISTORY: 'artha_learning_quiz_history_v1',
  WATCHLIST: 'artha_market_watchlist_v1',
  PAPER_PORTFOLIO: 'artha_paper_portfolio_v1',
  REPORT_HISTORY: 'artha_report_history_v1',
  SAVED_TUTOR: 'artha_saved_tutor_v1',
};

// Safe JSON parser helper
function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSetJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to save to localStorage key "${key}":`, err);
  }
}

// Learning Progress Management
export function getLearningProgress(): LearningProgress {
  return safeGetJSON<LearningProgress>(STORAGE_KEYS.PROGRESS, {
    completedLessonIds: [],
    quizScores: {},
    savedNotes: {},
    bookmarkedLessonIds: [],
    streakDays: 0,
    lastActiveDate: new Date().toISOString().split('T')[0],
  });
}

export function saveLearningProgress(progress: LearningProgress): void {
  safeSetJSON(STORAGE_KEYS.PROGRESS, progress);
}

export function getOverallProgressPercentage(): number {
  const p = getLearningProgress();
  const totalLessons = 16; // approximate total lessons across tracks
  const completed = p.completedLessonIds.length;
  if (completed === 0) return 0;
  return Math.min(100, Math.round((completed / totalLessons) * 100));
}

export function saveUserProgress(data: {
  trackId: string;
  moduleId: string;
  lessonId: string;
  completed: boolean;
  quizScore: number;
  completedAt: string;
}): void {
  const current = getLearningProgress();
  const completedIds = current.completedLessonIds.includes(data.lessonId)
    ? current.completedLessonIds
    : [...current.completedLessonIds, data.lessonId];

  const updated: LearningProgress = {
    ...current,
    completedLessonIds: completedIds,
    quizScores: {
      ...current.quizScores,
      [data.lessonId]: Math.max(current.quizScores[data.lessonId] || 0, data.quizScore),
    },
    lastActiveLessonId: data.lessonId,
  };

  saveLearningProgress(updated);
}

export function getModuleProgress(moduleId: string): number {
  const current = getLearningProgress();
  // Filter lessons completed in this module
  const completed = current.completedLessonIds.filter((id) => id.includes(moduleId)).length;
  return completed;
}

export function markLessonCompleted(lessonId: string): LearningProgress {
  const current = getLearningProgress();
  if (!current.completedLessonIds.includes(lessonId)) {
    const today = new Date().toISOString().split('T')[0];
    const updated: LearningProgress = {
      ...current,
      completedLessonIds: [...current.completedLessonIds, lessonId],
      lastActiveLessonId: lessonId,
      lastActiveDate: today,
      streakDays: current.lastActiveDate === today ? current.streakDays : current.streakDays + 1,
    };
    saveLearningProgress(updated);
    return updated;
  }
  return current;
}

export function recordQuizScore(lessonId: string, scorePercent: number): LearningProgress {
  const current = getLearningProgress();
  const updated: LearningProgress = {
    ...current,
    quizScores: {
      ...current.quizScores,
      [lessonId]: Math.max(current.quizScores[lessonId] || 0, scorePercent),
    },
  };
  saveLearningProgress(updated);
  return updated;
}

export function toggleBookmarkLesson(lessonId: string): boolean {
  const current = getLearningProgress();
  const exists = current.bookmarkedLessonIds.includes(lessonId);
  const updatedBookmarks = exists
    ? current.bookmarkedLessonIds.filter((id) => id !== lessonId)
    : [...current.bookmarkedLessonIds, lessonId];

  saveLearningProgress({
    ...current,
    bookmarkedLessonIds: updatedBookmarks,
  });
  return !exists;
}

export function saveLessonNote(lessonId: string, noteText: string): void {
  const current = getLearningProgress();
  saveLearningProgress({
    ...current,
    savedNotes: {
      ...current.savedNotes,
      [lessonId]: noteText,
    },
  });
}

// Watchlist Management
export function getMarketWatchlist(): string[] {
  return safeGetJSON<string[]>(STORAGE_KEYS.WATCHLIST, ['AAPL', 'MSFT', 'SPY', 'BTC-USD']);
}

export function getWatchlist(): string[] {
  return getMarketWatchlist();
}

export function saveWatchlist(list: string[]): void {
  safeSetJSON(STORAGE_KEYS.WATCHLIST, list);
}

export function toggleMarketWatchlist(symbol: string): string[] {
  const current = getMarketWatchlist();
  const exists = current.includes(symbol);
  const updated = exists ? current.filter((s) => s !== symbol) : [...current, symbol];
  safeSetJSON(STORAGE_KEYS.WATCHLIST, updated);
  return updated;
}

// Paper Trading Portfolio Management (Simulation Only)
export function getPaperPortfolio(): PaperPortfolio {
  return safeGetJSON<PaperPortfolio>(STORAGE_KEYS.PAPER_PORTFOLIO, {
    cashBalance: 100000,
    initialBalance: 100000,
    positions: [],
    trades: [],
  });
}

export function savePaperPortfolio(portfolio: any): void {
  safeSetJSON(STORAGE_KEYS.PAPER_PORTFOLIO, portfolio);
}

export function executePaperTrade(
  symbol: string,
  name: string,
  assetType: string,
  side: 'buy' | 'sell',
  quantity: number,
  price: number
): { success: boolean; message: string; portfolio: PaperPortfolio } {
  const portfolio = getPaperPortfolio();
  const totalAmount = quantity * price;

  if (side === 'buy') {
    if (portfolio.cashBalance < totalAmount) {
      return {
        success: false,
        message: `Insufficient virtual cash. Required: $${totalAmount.toFixed(2)}, Available: $${portfolio.cashBalance.toFixed(2)}`,
        portfolio,
      };
    }

    portfolio.cashBalance -= totalAmount;
    const existingPosIndex = portfolio.positions.findIndex((p) => p.symbol === symbol);

    if (existingPosIndex >= 0) {
      const existing = portfolio.positions[existingPosIndex];
      const newQty = existing.quantity + quantity;
      const newAvgCost = (existing.quantity * existing.averageCost + totalAmount) / newQty;

      portfolio.positions[existingPosIndex] = {
        ...existing,
        quantity: newQty,
        averageCost: newAvgCost,
        currentPrice: price,
      };
    } else {
      portfolio.positions.push({
        symbol,
        name,
        assetType,
        quantity,
        averageCost: price,
        currentPrice: price,
      });
    }
  } else {
    // Sell Order
    const existingPosIndex = portfolio.positions.findIndex((p) => p.symbol === symbol);
    if (existingPosIndex < 0 || portfolio.positions[existingPosIndex].quantity < quantity) {
      const currentQty = existingPosIndex >= 0 ? portfolio.positions[existingPosIndex].quantity : 0;
      return {
        success: false,
        message: `Insufficient shares to sell. Required: ${quantity}, Available: ${currentQty}`,
        portfolio,
      };
    }

    const existing = portfolio.positions[existingPosIndex];
    portfolio.cashBalance += totalAmount;
    const remainingQty = existing.quantity - quantity;

    if (remainingQty <= 0) {
      portfolio.positions.splice(existingPosIndex, 1);
    } else {
      portfolio.positions[existingPosIndex] = {
        ...existing,
        quantity: remainingQty,
        currentPrice: price,
      };
    }
  }

  const newTrade: PaperTrade = {
    id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    symbol,
    side,
    quantity,
    price,
    totalAmount,
  };

  portfolio.trades.unshift(newTrade);
  safeSetJSON(STORAGE_KEYS.PAPER_PORTFOLIO, portfolio);

  return {
    success: true,
    message: `Executed virtual ${side.toUpperCase()} for ${quantity} shares of ${symbol} @ $${price.toFixed(2)}`,
    portfolio,
  };
}

export function resetPaperPortfolio(): PaperPortfolio {
  const resetState: PaperPortfolio = {
    cashBalance: 100000,
    initialBalance: 100000,
    positions: [],
    trades: [],
  };
  safeSetJSON(STORAGE_KEYS.PAPER_PORTFOLIO, resetState);
  return resetState;
}

// Report History Management
export function getReportHistory(): VerificationReport[] {
  return safeGetJSON<VerificationReport[]>(STORAGE_KEYS.REPORT_HISTORY, []);
}

export function saveReportToHistory(report: VerificationReport): void {
  const current = getReportHistory();
  const filtered = current.filter((r) => r.id !== report.id);
  const updated = [report, ...filtered].slice(0, 50); // keep max 50 reports
  safeSetJSON(STORAGE_KEYS.REPORT_HISTORY, updated);
}

// Reset All Learning & Storage Data
export function resetAllStorageData(): void {
  localStorage.removeItem(STORAGE_KEYS.PROGRESS);
  localStorage.removeItem(STORAGE_KEYS.NOTES);
  localStorage.removeItem(STORAGE_KEYS.BOOKMARKS);
  localStorage.removeItem(STORAGE_KEYS.QUIZ_HISTORY);
  localStorage.removeItem(STORAGE_KEYS.WATCHLIST);
  localStorage.removeItem(STORAGE_KEYS.PAPER_PORTFOLIO);
  localStorage.removeItem(STORAGE_KEYS.REPORT_HISTORY);
  localStorage.removeItem(STORAGE_KEYS.SAVED_TUTOR);
}
