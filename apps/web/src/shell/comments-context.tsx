"use client";

import { createContext, useContext, useState } from "react";

interface CommentsContextType {
  setShowComments: (show: boolean) => void;
  showComments: boolean;
}

const CommentsContext = createContext<CommentsContextType | null>(null);

const fallback: CommentsContextType = {
  showComments: false,
  // biome-ignore lint/suspicious/noEmptyBlockStatements: noop fallback for SSR
  setShowComments: () => {},
};

export function useCommentsContext() {
  const context = useContext(CommentsContext);
  return context ?? fallback;
}

export function CommentsProvider({ children }: { children: React.ReactNode }) {
  const [showComments, setShowComments] = useState(false);

  return (
    <CommentsContext.Provider value={{ showComments, setShowComments }}>
      {children}
    </CommentsContext.Provider>
  );
}
