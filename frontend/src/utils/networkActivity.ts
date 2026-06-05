type Listener = () => void;

let activeRequestCount = 0;
const listeners = new Set<Listener>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const networkActivity = {
  begin() {
    activeRequestCount += 1;
    emit();
  },

  end() {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    emit();
  },

  getSnapshot() {
    return activeRequestCount;
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
