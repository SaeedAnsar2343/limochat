import { App as CapApp } from '@capacitor/app';

type CloseHandler = () => boolean | void;

interface ModalEntry {
  id: string;
  close: CloseHandler;
  priority: number;
}

class NavigationManager {
  private modalStack: ModalEntry[] = [];
  private backHandlers: (() => boolean)[] = [];
  private initialized = false;

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Android Capacitor Back Button listener
    try {
      CapApp.addListener('backButton', () => {
        this.handleBack();
      });
    } catch (e) {
      console.warn('Capacitor App listener notice:', e);
    }

    // 2. Desktop Keyboard Escape listener
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          // If active element is an input and has text, allow Esc to close modal
          this.handleBack();
        }
      });
    }
  }

  /**
   * Register an open modal or drawer.
   * Higher priority modals close first.
   * Returns an unregister cleanup function.
   */
  public registerModal(id: string, close: CloseHandler, priority = 10): () => void {
    // Remove if already exists with same id
    this.modalStack = this.modalStack.filter(m => m.id !== id);
    this.modalStack.push({ id, close, priority });

    return () => {
      this.modalStack = this.modalStack.filter(m => m.id !== id);
    };
  }

  /**
   * Register a custom back-action handler (e.g. mobile active chat view back to sidebar).
   * Handler should return true if it consumed the back event.
   */
  public registerCustomBackHandler(handler: () => boolean): () => void {
    this.backHandlers.unshift(handler);
    return () => {
      this.backHandlers = this.backHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Central back action dispatcher:
   * 1. Closes topmost modal / drawer if any is open.
   * 2. Runs registered custom back handlers (e.g. mobile chat -> sidebar).
   * 3. If on home screen or login page, closes/exits native app without navigating browser history.
   */
  public handleBack(): boolean {
    // 1. Check topmost modal in modalStack
    if (this.modalStack.length > 0) {
      // Sort by priority descending (highest priority first)
      this.modalStack.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      const top = this.modalStack.pop();
      if (top) {
        try {
          top.close();
          return true;
        } catch (e) {
          console.warn('Error closing modal:', e);
        }
      }
    }

    // 2. Check custom back handlers (e.g. mobileView === 'chat')
    for (const handler of this.backHandlers) {
      try {
        const handled = handler();
        if (handled) return true;
      } catch (e) {
        console.warn('Back handler error:', e);
      }
    }

    // 3. Root / Home screen or Login screen: Close native app cleanly
    try {
      CapApp.exitApp();
      return true;
    } catch {
      // Running on web browser fallback
      return false;
    }
  }
}

export const navigationManager = new NavigationManager();
