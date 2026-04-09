import { useState, useEffect } from "react";
import { bitrix } from "../api/bitrix";

export function useBitrixDeals(filter: Record<string, any> = {}, limit = 500) {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await bitrix.getDeals(filter, limit);
        setDeals(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter), limit]);

  return { deals, loading, error, refetch: async () => {
    setLoading(true);
    try {
      setDeals(await bitrix.getDeals(filter, limit));
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }};
}

export function useBitrixContacts(filter: Record<string, any> = {}, limit = 500) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await bitrix.getContacts(filter, limit);
        setContacts(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter), limit]);

  return { contacts, loading, error };
}

export function useBitrixActivities(filter: Record<string, any> = {}, limit = 500) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await bitrix.getActivities(filter, limit);
        setActivities(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter), limit]);

  return { activities, loading, error };
}
