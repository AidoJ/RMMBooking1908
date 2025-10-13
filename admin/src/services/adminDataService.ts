/**
 * Admin Data Service
 * 
 * Secure client-side wrapper for admin panel data operations.
 * Mimics Supabase client API but routes all requests through secure Netlify proxy function.
 * 
 * Usage:
 *   const { data, error } = await adminDataService.from('bookings').select('*');
 */

const ADMIN_DATA_ENDPOINT = '/.netlify/functions/admin-data';

interface QueryBuilder {
  select: (columns?: string) => QueryBuilder;
  insert: (data: any) => QueryBuilder;
  update: (data: any) => QueryBuilder;
  delete: () => QueryBuilder;
  upsert: (data: any) => QueryBuilder;
  eq: (column: string, value: any) => QueryBuilder;
  neq: (column: string, value: any) => QueryBuilder;
  gt: (column: string, value: any) => QueryBuilder;
  gte: (column: string, value: any) => QueryBuilder;
  lt: (column: string, value: any) => QueryBuilder;
  lte: (column: string, value: any) => QueryBuilder;
  like: (column: string, value: any) => QueryBuilder;
  ilike: (column: string, value: any) => QueryBuilder;
  is: (column: string, value: any) => QueryBuilder;
  in: (column: string, value: any[]) => QueryBuilder;
  contains: (column: string, value: any) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  range: (from: number, to: number) => QueryBuilder;
  single: () => Promise<{ data: any; error: any; }>;
  maybeSingle: () => Promise<{ data: any; error: any; }>;
  then: (resolve: (value: { data: any; error: any; }) => void, reject?: (reason: any) => void) => Promise<{ data: any; error: any; }>;
}

class AdminQueryBuilder implements QueryBuilder {
  private table: string;
  private operation: string = 'select';
  private queryParams: any = {};

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*'): QueryBuilder {
    this.operation = 'select';
    this.queryParams.select = columns;
    return this;
  }

  insert(data: any): QueryBuilder {
    this.operation = 'insert';
    this.queryParams.data = data;
    return this;
  }

  update(data: any): QueryBuilder {
    this.operation = 'update';
    this.queryParams.data = data;
    return this;
  }

  delete(): QueryBuilder {
    this.operation = 'delete';
    return this;
  }

  upsert(data: any): QueryBuilder {
    this.operation = 'upsert';
    this.queryParams.data = data;
    return this;
  }

  eq(column: string, value: any): QueryBuilder {
    if (!this.queryParams.eq) this.queryParams.eq = {};
    this.queryParams.eq[column] = value;
    return this;
  }

  neq(column: string, value: any): QueryBuilder {
    if (!this.queryParams.neq) this.queryParams.neq = {};
    this.queryParams.neq[column] = value;
    return this;
  }

  gt(column: string, value: any): QueryBuilder {
    if (!this.queryParams.gt) this.queryParams.gt = {};
    this.queryParams.gt[column] = value;
    return this;
  }

  gte(column: string, value: any): QueryBuilder {
    if (!this.queryParams.gte) this.queryParams.gte = {};
    this.queryParams.gte[column] = value;
    return this;
  }

  lt(column: string, value: any): QueryBuilder {
    if (!this.queryParams.lt) this.queryParams.lt = {};
    this.queryParams.lt[column] = value;
    return this;
  }

  lte(column: string, value: any): QueryBuilder {
    if (!this.queryParams.lte) this.queryParams.lte = {};
    this.queryParams.lte[column] = value;
    return this;
  }

  like(column: string, value: any): QueryBuilder {
    if (!this.queryParams.like) this.queryParams.like = {};
    this.queryParams.like[column] = value;
    return this;
  }

  ilike(column: string, value: any): QueryBuilder {
    if (!this.queryParams.ilike) this.queryParams.ilike = {};
    this.queryParams.ilike[column] = value;
    return this;
  }

  is(column: string, value: any): QueryBuilder {
    if (!this.queryParams.is) this.queryParams.is = {};
    this.queryParams.is[column] = value;
    return this;
  }

  in(column: string, value: any[]): QueryBuilder {
    if (!this.queryParams.in) this.queryParams.in = {};
    this.queryParams.in[column] = value;
    return this;
  }

  contains(column: string, value: any): QueryBuilder {
    if (!this.queryParams.contains) this.queryParams.contains = {};
    this.queryParams.contains[column] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder {
    if (!this.queryParams.order) this.queryParams.order = [];
    this.queryParams.order.push({
      column,
      ascending: options?.ascending !== false
    });
    return this;
  }

  limit(count: number): QueryBuilder {
    this.queryParams.limit = count;
    return this;
  }

  range(from: number, to: number): QueryBuilder {
    this.queryParams.range = { from, to };
    return this;
  }

  single(): Promise<{ data: any; error: any; }> {
    this.queryParams.single = true;
    return this.execute();
  }

  maybeSingle(): Promise<{ data: any; error: any; }> {
    this.queryParams.maybeSingle = true;
    return this.execute();
  }

  then(resolve: (value: { data: any; error: any; }) => void, reject?: (reason: any) => void): Promise<{ data: any; error: any; }> {
    return this.execute().then(resolve, reject);
  }

  private async execute(): Promise<{ data: any; error: any; }> {
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        return {
          data: null,
          error: { message: 'Not authenticated', code: 'UNAUTHENTICATED' }
        };
      }

      // Call admin-data proxy function
      const response = await fetch(ADMIN_DATA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          operation: this.operation,
          table: this.table,
          query: this.queryParams
        })
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle token expiration
        if (result.error === 'Token expired' || result.error === 'Invalid token') {
          // Clear auth data and redirect to login
          localStorage.removeItem('adminToken');
          localStorage.removeItem('user');
          window.location.href = '/admin/login';
          
          return {
            data: null,
            error: { message: result.error, code: 'TOKEN_EXPIRED' }
          };
        }

        return {
          data: null,
          error: { message: result.error || 'Request failed', details: result.details }
        };
      }

      if (!result.success) {
        return {
          data: null,
          error: { message: result.error, details: result.details }
        };
      }

      return {
        data: result.data,
        error: null
      };

    } catch (error: any) {
      console.error('Admin data service error:', error);
      return {
        data: null,
        error: { message: error.message || 'Network error' }
      };
    }
  }
}

class AdminDataService {
  from(table: string): QueryBuilder {
    return new AdminQueryBuilder(table);
  }

  /**
   * Direct authentication method
   */
  static async authenticate(email: string, password: string): Promise<{ success: boolean; user?: any; token?: string; error?: string; }> {
    try {
      const response = await fetch('/.netlify/functions/admin-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Authentication failed'
        };
      }

      // Store token and user info
      localStorage.setItem('adminToken', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));

      return {
        success: true,
        user: result.user,
        token: result.token
      };

    } catch (error: any) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: error.message || 'Network error'
      };
    }
  }

  /**
   * Logout - clear stored credentials
   */
  static logout(): void {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('user');
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!(localStorage.getItem('adminToken') && localStorage.getItem('user'));
  }

  /**
   * Get current user
   */
  static getCurrentUser(): any {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
}

// Create singleton instance
const adminDataService = new AdminDataService();

export default adminDataService;
export { AdminDataService };

