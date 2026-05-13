// @ts-nocheck
import { createContext, useContext, useEffect, useState } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const REVENUECAT_IOS_KEY = 'appl_zlUegbbvyGZTwuwbSvIoDhrEKsH';

interface SubscriptionContextType {
  isPremium: boolean;
  loading: boolean;
  showPaywall: boolean;
  setShowPaywall: (v: boolean) => void;
  restorePurchases: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPremium: false,
  loading: true,
  showPaywall: false,
  setShowPaywall: () => {},
  restorePurchases: async () => {},
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });

        const customerInfo = await Purchases.getCustomerInfo();
        setIsPremium(customerInfo.entitlements.active['premium'] !== undefined);
      } catch {
        // Placeholder key — treat as free tier
        setIsPremium(false);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function restorePurchases() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      setIsPremium(customerInfo.entitlements.active['premium'] !== undefined);
    } catch {
      // ignore
    }
  }

  return (
    <SubscriptionContext.Provider value={{ isPremium, loading, showPaywall, setShowPaywall, restorePurchases }}>
      {children}
    </SubscriptionContext.Provider>
  );
}
