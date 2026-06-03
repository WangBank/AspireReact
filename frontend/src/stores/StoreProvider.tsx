/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';
import { rootStore } from './RootStore';

const StoreContext = createContext(rootStore);

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <StoreContext.Provider value={rootStore}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return store;
};
