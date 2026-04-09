export class BitrixClient {
  private get webhookUrl(): string {
    const fromStorage = localStorage.getItem('bitrix_webhook_url');
    const url = fromStorage || import.meta.env.VITE_BITRIX_WEBHOOK_URL || '';
    if (!url) {
      console.warn('Bitrix24 Webhook URL not configured. Go to Settings to set it.');
      return '';
    }
    return url.endsWith('/') ? url : `${url}/`;
  }

  /**
   * Helper for making requests to Bitrix REST API
   * Handles POST requests (safer for long payloads/filters in Bitrix)
   */
  private async request<T = any>(method: string, data: Record<string, any> = {}): Promise<T> {
    const url = this.webhookUrl;
    if (!url) throw new Error("Bitrix24 Webhook URL is missing");

    try {
      const response = await fetch(`${url}${method}.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Bitrix API Error: ${result.error_description || result.error}`);
      }

      return result;
    } catch (error) {
      console.error(`[Bitrix] Error method ${method}:`, error);
      throw error;
    }
  }

  /**
   * Fetch paginated list
   */
  private async fetchAllList(method: string, data: Record<string, any> = {}, maxLimit = 500): Promise<any[]> {
    let allItems: any[] = [];
    let start = 0;
    
    // Safety break to prevent infinite loops or massive fetching
    let loops = 0;

    while (start !== -1 && allItems.length < maxLimit && loops < 50) {
      const resp = await this.request(method, { ...data, start });
      
      if (!resp.result || !Array.isArray(resp.result)) break;
      
      allItems.push(...resp.result);
      start = resp.next ? resp.next : -1; // -1 means no more pages
      
      loops++;
    }

    return allItems;
  }

  // --------------------------------------------------------------------------
  // CRM API Methods
  // --------------------------------------------------------------------------

  public async getDeals(filter: Record<string, any> = {}, limit = 500) {
    return this.fetchAllList("crm.deal.list", {
      filter,
      select: ["ID", "TITLE", "STAGE_ID", "OPPORTUNITY", "CURRENCY_ID", "ASSIGNED_BY_ID", "COMPANY_ID", "CONTACT_ID", "DATE_CREATE", "DATE_MODIFY", "CLOSED"],
    }, limit);
  }

  public async getContacts(filter: Record<string, any> = {}, limit = 500) {
    return this.fetchAllList("crm.contact.list", {
      filter,
      select: ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "COMPANY_ID", "POST", "PHONE", "EMAIL", "DATE_CREATE"],
    }, limit);
  }

  public async getCompanies(filter: Record<string, any> = {}, limit = 500) {
    return this.fetchAllList("crm.company.list", {
      filter,
      select: ["ID", "TITLE", "COMPANY_TYPE", "REVENUE", "ASSIGNED_BY_ID", "DATE_CREATE"],
    }, limit);
  }

  public async getActivities(filter: Record<string, any> = {}, limit = 500) {
    return this.fetchAllList("crm.activity.list", {
      filter,
      select: ["ID", "OWNER_ID", "OWNER_TYPE_ID", "TYPE_ID", "PROVIDER_ID", "DIRECTION", "SUBJECT", "START_TIME", "END_TIME", "COMPLETED", "AUTHOR_ID", "RESPONSIBLE_ID"],
    }, limit);
  }

  public async getUsers(filter: Record<string, any> = {}) {
    // Note: user.get uses different pagination/keys than CRM entities sometimes, but usually `start` and `user.get` just returns arrays under `result`.
    // It doesn't support the 'select' param typically, returns all available fields.
    return this.fetchAllList("user.get", filter);
  }
}

export const bitrix = new BitrixClient();
