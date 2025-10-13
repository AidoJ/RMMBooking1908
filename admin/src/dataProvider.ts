/**
 * Custom Data Provider for Refine
 * Uses adminDataService instead of direct Supabase client
 * This ensures all data access goes through secure proxy
 */

import { DataProvider } from "@refinedev/core";
import adminDataService from "./services/adminDataService";

const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters, sorters, meta }) => {
    let query = adminDataService.from(resource).select(meta?.select || "*");

    // Apply filters
    if (filters) {
      filters.forEach((filter) => {
        if ("field" in filter) {
          const { field, operator, value } = filter;
          
          switch (operator) {
            case "eq":
              query = query.eq(field, value);
              break;
            case "ne":
              query = query.neq(field, value);
              break;
            case "lt":
              query = query.lt(field, value);
              break;
            case "lte":
              query = query.lte(field, value);
              break;
            case "gt":
              query = query.gt(field, value);
              break;
            case "gte":
              query = query.gte(field, value);
              break;
            case "in":
              query = query.in(field, value);
              break;
            case "contains":
              query = query.like(field, `%${value}%`);
              break;
            case "containss":
              query = query.ilike(field, `%${value}%`);
              break;
            case "null":
              query = query.is(field, null);
              break;
            default:
              break;
          }
        }
      });
    }

    // Apply sorters
    if (sorters && sorters.length > 0) {
      sorters.forEach((sorter) => {
        if (sorter.field) {
          query = query.order(sorter.field, { ascending: sorter.order === "asc" });
        }
      });
    }

    // Apply pagination
    if (pagination) {
      const { current = 1, pageSize = 10 } = pagination;
      const from = (current - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: data || [],
      total: data?.length || 0, // Note: Supabase count would need separate query
    };
  },

  getOne: async ({ resource, id, meta }) => {
    const { data, error } = await adminDataService
      .from(resource)
      .select(meta?.select || "*")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return {
      data: data,
    };
  },

  create: async ({ resource, variables, meta }) => {
    const { data, error } = await adminDataService
      .from(resource)
      .insert(variables)
      .select(meta?.select || "*")
      .single();

    if (error) {
      throw error;
    }

    return {
      data: data,
    };
  },

  update: async ({ resource, id, variables, meta }) => {
    const { data, error } = await adminDataService
      .from(resource)
      .update(variables)
      .eq("id", id)
      .select(meta?.select || "*")
      .single();

    if (error) {
      throw error;
    }

    return {
      data: data,
    };
  },

  deleteOne: async ({ resource, id }) => {
    const { data, error} = await adminDataService
      .from(resource)
      .delete()
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return {
      data: data,
    };
  },

  getApiUrl: () => {
    return "";
  },

  custom: async ({ url, method, filters, sorters, payload, query, headers }) => {
    // Custom method for special cases
    throw new Error("Custom method not implemented");
  },
};

export default dataProvider;

