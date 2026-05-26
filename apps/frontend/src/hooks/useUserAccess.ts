import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchUserAccess, type UserAccessSnapshot } from "../services/access";

type UseUserAccessResult = {
  access: UserAccessSnapshot | null;
  isLoading: boolean;
  refreshAccess: () => Promise<void>;
};

export function useUserAccess(): UseUserAccessResult {
  const { token } = useAuth();
  const [access, setAccess] = useState<UserAccessSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  const refreshAccess = useCallback(async () => {
    if (!token) {
      setAccess(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const snapshot = await fetchUserAccess();
      setAccess(snapshot);
    } catch {
      setAccess(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  return { access, isLoading, refreshAccess };
}
